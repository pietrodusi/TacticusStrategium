#!/usr/bin/env node
/**
 * dump-tacticusdb.mjs
 *
 * Dumps all Guild Raid map data from TacticusDB into the repo so the app can
 * ship a self-contained snapshot (the volatile unit catalog is fetched live at
 * runtime; the stable board geometry lives in-repo).
 *
 * Pipeline (reverse-engineered from https://tacticusdb.com/gamemodes/GR):
 *   1. GET /api/data/guildBossSeasonConfigsConverted  -> master index of every
 *      season -> tier -> set -> encounter. Each encounter carries boardId,
 *      bossType, unitId, npc1id/enemies, spawnPointsSet, encounter type, etc.
 *   2. For each unique boardId: GET /board/{boardId}.json -> Unity board dump
 *      (Width/Height, Tiles[][] with TileId/Elevation/Rotation/ForceUnplayable,
 *      SpawnPoints/SpawnPointGroups/SpawnPointSets).
 *   3. For each boardId: GET /images/board/{boardId}_Visual.jpeg -> map background.
 *   4. GET the /bosses page chunk -> extract the static unitId->portrait-stem map
 *      (nested by character/summon/boss/npc). Portraits live at
 *      /images/characters/portrait_{stem}.png and RoundPortrait_{stem}.png.
 *   5. Build a boss picker index from the "Boss" encounters (distinct boss unit ->
 *      its maps, faction, image stem, size).
 *   6. Build per-unit spawn lists from ability `constants` (each character/boss ->
 *      the units it summons) + boss encounter NPCs -> public/data/spawns.json.
 *
 * Output:
 *   public/data/guildBossSeasonConfigs.json   (master index)
 *   public/data/boards/{boardId}.json         (per-map tile data)
 *   public/data/boards-manifest.json          (list of boards + metadata)
 *   public/data/imageStems.json               (unitId -> portrait stem, by type)
 *   public/data/bosses.json                   (boss picker index)
 *   public/data/spawns.json                   (unit -> spawnable units + identities)
 *   public/images/maps/{boardId}_Visual.jpeg  (map backgrounds)
 *
 * Re-run any time to refresh. Idempotent: re-downloads everything by default,
 * pass --skip-existing to keep files already on disk.
 *
 * Usage:
 *   node scripts/dump-tacticusdb.mjs [--no-images] [--skip-existing] [--concurrency=8]
 */

import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://tacticusdb.com';
const SEASON_CONFIG_ENDPOINT = '/api/data/guildBossSeasonConfigsConverted';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const BOARDS_DIR = join(DATA_DIR, 'boards');
const MAPS_IMG_DIR = join(ROOT, 'public', 'images', 'maps');

// --- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const NO_IMAGES = args.includes('--no-images');
const SKIP_EXISTING = args.includes('--skip-existing');
const CONCURRENCY = Number(
  (args.find((a) => a.startsWith('--concurrency=')) ?? '').split('=')[1] || 8,
);

// --- helpers ----------------------------------------------------------------
async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, { binary = false, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return binary ? Buffer.from(await res.arrayBuffer()) : await res.json();
    } catch (err) {
      lastErr = err;
      if (err.status === 404) throw err; // don't retry a definitive miss
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw lastErr;
}

/** Run async tasks with a bounded concurrency pool. */
async function pool(items, worker, concurrency) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Walk the season config and collect every unique boardId + how it's used. */
function collectBoards(seasonConfig) {
  /** @type {Map<string, {boardId: string, encounters: any[]}>} */
  const byBoard = new Map();
  for (const season of seasonConfig) {
    for (const tier of season.tiers ?? []) {
      for (const set of tier.sets ?? []) {
        for (const enc of set.encounters ?? []) {
          if (!enc.boardId) continue;
          if (!byBoard.has(enc.boardId)) {
            byBoard.set(enc.boardId, { boardId: enc.boardId, encounters: [] });
          }
          byBoard.get(enc.boardId).encounters.push({
            season: season.season,
            rarity: tier.rarity,
            set: set.set,
            encounterIndex: enc.encounterIndex,
            type: enc.guildBossEncounterType,
            bossType: enc.bossType,
            unitId: enc.unitId,
            npc1id: enc.npc1id,
            enemies: enc.enemies,
            spawnPointsSet: enc.spawnPointsSet,
            maxNrOfTurns: enc.maxNrOfTurns,
            disallowedFactions: enc.disallowedFactions,
          });
        }
      }
    }
  }
  return [...byBoard.values()].sort((a, b) => a.boardId.localeCompare(b.boardId));
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Extract the static `unitId -> portrait stem` map that TacticusDB embeds in
 * the /bosses page chunk (`JSON.parse('{...}')`, nested by character/summon/
 * boss/npc). The chunk hash changes between deploys, so discover it from the
 * page HTML rather than hard-coding it.
 */
async function fetchImageStems() {
  const html = await fetchText(`${BASE}/bosses`);
  const chunk = html.match(/static\/chunks\/app\/bosses\/page-[a-f0-9]+\.js/);
  if (!chunk) throw new Error('could not locate the /bosses page chunk in HTML');
  const js = await fetchText(`${BASE}/_next/${chunk[0]}`);
  // Each embedded map is a JS string literal: JSON.parse('{...}'). Single quotes
  // inside are escaped as \'. Pick the object that has both `character` and `boss`.
  const re = /JSON\.parse\('(\{(?:[^'\\]|\\.)*\})'\)/g;
  let m;
  while ((m = re.exec(js)) !== null) {
    let obj;
    try {
      obj = JSON.parse(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
    } catch {
      continue;
    }
    if (obj && obj.character && obj.boss) return obj;
  }
  throw new Error('image-stem map not found in /bosses chunk');
}

/** "TervigonLeviathan" -> "Tervigon Leviathan". */
function splitCamel(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

/**
 * Build the boss picker index: one entry per distinct unit that appears in a
 * "Boss" encounter, with the maps it's fought on, faction, image stem and size.
 */
async function buildBossIndex(seasonConfig, stems) {
  const byUnit = new Map();
  for (const season of seasonConfig) {
    for (const tier of season.tiers ?? []) {
      for (const set of tier.sets ?? []) {
        for (const enc of set.encounters ?? []) {
          if (enc.guildBossEncounterType !== 'Boss' || !enc.unitId) continue;
          const unitId = enc.unitId.split(':')[0]; // strip the ":1" rank suffix
          if (!byUnit.has(unitId)) {
            byUnit.set(unitId, { unitId, bossType: enc.bossType, boardIds: new Set() });
          }
          if (enc.boardId) byUnit.get(unitId).boardIds.add(enc.boardId);
        }
      }
    }
  }

  // Faction is handy for grouping the picker; pull it transiently (not saved —
  // unit stats stay live-fetched by the app).
  let units = {};
  try {
    units = await fetchWithRetry(`${BASE}/api/data/guildBossUnits`);
  } catch {
    /* faction is optional */
  }

  const bosses = [];
  for (const b of byUnit.values()) {
    const boardIds = [...b.boardIds].sort();
    let bossSize = null;
    for (const bid of boardIds) {
      const board = await readJson(join(BOARDS_DIR, `${bid}.json`));
      const size = board?.BossPlatforms?.[0]?.Size;
      if (size) {
        bossSize = size;
        break;
      }
    }
    bosses.push({
      unitId: b.unitId,
      bossType: b.bossType ?? null,
      name: b.bossType ? splitCamel(b.bossType) : b.unitId,
      faction: units[b.unitId]?.FactionId ?? null,
      imageStem: stems.boss?.[b.unitId] ?? null,
      bossSize,
      boardIds,
    });
  }
  return bosses.sort((a, b) => a.unitId.localeCompare(b.unitId));
}

/**
 * Build per-unit spawn lists: which units each character / boss can bring onto
 * the board, derived from ability `constants` (e.g. `unitToSpawn`) plus each
 * boss's encounter NPC(s). Also returns an identity catalog for every spawnable
 * unit so the app needs no live ability/npc fetch.
 */
async function buildSpawns(seasonConfig, stems) {
  const [abilities, characters, bossUnits, summons, npc] = await Promise.all([
    fetchWithRetry(`${BASE}/api/data/abilities`),
    fetchWithRetry(`${BASE}/api/data/characters`),
    fetchWithRetry(`${BASE}/api/data/guildBossUnits`),
    fetchWithRetry(`${BASE}/api/data/summons`),
    fetchWithRetry(`${BASE}/api/data/npc`),
  ]);
  const isUnit = (id) => !!(summons[id] || npc[id] || characters[id] || bossUnits[id]);

  // ability -> [spawned unit ids] (constants values can be comma-joined lists)
  const abilitySpawns = {};
  for (const [aid, a] of Object.entries(abilities)) {
    if (!a?.constants) continue;
    const ids = new Set();
    const scan = (v) => {
      if (typeof v === 'string') {
        for (const tok of v.split(',')) {
          const id = tok.trim();
          if (id && isUnit(id)) ids.add(id);
        }
      } else if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === 'object') Object.values(v).forEach(scan);
    };
    scan(a.constants);
    if (ids.size) abilitySpawns[aid] = [...ids];
  }

  const unitSpawnIds = (u) => {
    const abil = [...(u.activeAbilities ?? []), ...(u.passiveAbilities ?? [])];
    return [...new Set(abil.flatMap((a) => abilitySpawns[a] ?? []))];
  };

  const byUnit = {};
  for (const [id, c] of Object.entries(characters)) {
    const s = unitSpawnIds(c);
    if (s.length) byUnit[id] = s;
  }

  // boss encounter NPCs (the "initial" spawn for each boss)
  const bossEnc = {};
  for (const season of seasonConfig)
    for (const tier of season.tiers ?? [])
      for (const set of tier.sets ?? [])
        for (const e of set.encounters ?? []) {
          if (e.guildBossEncounterType !== 'Boss' || !e.unitId) continue;
          const bid = e.unitId.split(':')[0];
          (bossEnc[bid] ??= new Set());
          if (e.npc1id) bossEnc[bid].add(e.npc1id.split(':')[0]);
        }
  // Tyranid hive-fleet variants share an ability that lists every variant; keep
  // only the spawns matching this boss's own variant to avoid cross-variant noise.
  const VARIANTS = ['Leviathan', 'Kronos', 'Gorgon'];
  for (const [id, u] of Object.entries(bossUnits)) {
    const variant = VARIANTS.find((v) => id.endsWith(v));
    let abil = unitSpawnIds(u);
    if (variant) abil = abil.filter((sid) => sid.endsWith(variant));
    const all = [...new Set([...(bossEnc[id] ?? []), ...abil])];
    if (all.length) byUnit[id] = all;
  }

  // Identity for every referenced spawn unit.
  const deriveName = (id) => {
    const s = id
      .replace(/^GuildBoss\d+(?:MiniBoss|Boss|Npc)\d+/, '')
      .replace(/^[a-z]+(?=[A-Z])/, '')
      .replace(/^(Tyran|Necro|Astra|Adept|Ultra|Blood|Black|Death|Thous|Orks|Tau|Genes|Votan|Admec)/, '');
    return splitCamel(s) || id;
  };
  const stemFor = (id) =>
    stems.summon[id] ?? stems.npc[id] ?? stems.boss[id] ?? stems.character[id] ?? null;

  // Hex footprint: the game's "BigTarget" trait marks multi-hex (3-hex) units;
  // everything else is 1-hex. (No spawnable unit is 7-hex — those are bosses.)
  const traitsOf = (id) =>
    summons[id]?.traits ?? npc[id]?.traits ?? characters[id]?.traits ?? bossUnits[id]?.traits ?? [];

  const units = {};
  for (const ids of Object.values(byUnit)) {
    for (const id of ids) {
      if (units[id]) continue;
      const src = summons[id] ?? npc[id] ?? characters[id];
      units[id] = {
        name: src?.name ?? deriveName(id),
        faction: src?.FactionId ?? bossUnits[id]?.FactionId ?? null,
        stem: stemFor(id),
        kind: summons[id] ? 'summon' : 'npc',
        size: traitsOf(id).includes('BigTarget') ? 3 : 1,
      };
    }
  }

  return { byUnit, units };
}

// --- main -------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  await mkdir(BOARDS_DIR, { recursive: true });
  if (!NO_IMAGES) await mkdir(MAPS_IMG_DIR, { recursive: true });

  console.log(`▸ Fetching master index ${SEASON_CONFIG_ENDPOINT} ...`);
  const seasonConfig = await fetchWithRetry(BASE + SEASON_CONFIG_ENDPOINT);
  await writeFile(
    join(DATA_DIR, 'guildBossSeasonConfigs.json'),
    JSON.stringify(seasonConfig, null, 2),
  );

  const boards = collectBoards(seasonConfig);
  console.log(`▸ ${boards.length} unique boards across ${seasonConfig.length} seasons\n`);

  // 1) board tile JSON ------------------------------------------------------
  let boardsOk = 0;
  const missingBoards = [];
  const boardMeta = await pool(
    boards,
    async (b) => {
      const outPath = join(BOARDS_DIR, `${b.boardId}.json`);
      let board;
      if (SKIP_EXISTING && (await exists(outPath))) {
        const existing = await readJson(outPath);
        boardsOk++;
        return { ...b, width: existing?.Width ?? null, height: existing?.Height ?? null, skipped: true };
      }
      try {
        board = await fetchWithRetry(`${BASE}/board/${b.boardId}.json`);
        await writeFile(outPath, JSON.stringify(board, null, 2));
        boardsOk++;
        process.stdout.write(`  ✓ board ${b.boardId}\n`);
        return { ...b, width: board.Width, height: board.Height };
      } catch (err) {
        missingBoards.push(b.boardId);
        process.stdout.write(`  ✗ board ${b.boardId} (${err.message})\n`);
        return { ...b, width: null, height: null, missing: true };
      }
    },
    CONCURRENCY,
  );

  // 2) map background images ------------------------------------------------
  let imagesOk = 0;
  const missingImages = [];
  if (!NO_IMAGES) {
    console.log('');
    await pool(
      boards,
      async (b) => {
        const file = `${b.boardId}_Visual.jpeg`;
        const outPath = join(MAPS_IMG_DIR, file);
        if (SKIP_EXISTING && (await exists(outPath))) {
          imagesOk++;
          return;
        }
        try {
          const buf = await fetchWithRetry(`${BASE}/images/board/${file}`, { binary: true });
          await writeFile(outPath, buf);
          imagesOk++;
          process.stdout.write(`  ✓ image ${file}\n`);
        } catch (err) {
          missingImages.push(b.boardId);
          process.stdout.write(`  ✗ image ${file} (${err.message})\n`);
        }
      },
      CONCURRENCY,
    );
  }

  // 3) manifest -------------------------------------------------------------
  const manifest = {
    generatedFrom: BASE + SEASON_CONFIG_ENDPOINT,
    seasonCount: seasonConfig.length,
    boardCount: boards.length,
    boards: boardMeta.map(({ boardId, width, height, encounters }) => ({
      boardId,
      width,
      height,
      encounterCount: encounters.length,
      bossTypes: [...new Set(encounters.map((e) => e.bossType).filter(Boolean))],
      types: [...new Set(encounters.map((e) => e.type).filter(Boolean))],
    })),
  };
  await writeFile(join(DATA_DIR, 'boards-manifest.json'), JSON.stringify(manifest, null, 2));

  // 4) image-stem map + 5) boss index ---------------------------------------
  console.log('\n▸ Extracting portrait stems + boss index ...');
  let stems = null;
  let bossCount = 0;
  let bossesNoImage = 0;
  try {
    stems = await fetchImageStems();
    await writeFile(join(DATA_DIR, 'imageStems.json'), JSON.stringify(stems, null, 2));
    const counts = Object.entries(stems)
      .map(([k, v]) => `${k}:${Object.keys(v).length}`)
      .join(', ');
    console.log(`  ✓ imageStems.json (${counts})`);
  } catch (err) {
    console.log(`  ✗ image stems (${err.message})`);
  }
  if (stems) {
    const bosses = await buildBossIndex(seasonConfig, stems);
    bossCount = bosses.length;
    bossesNoImage = bosses.filter((b) => !b.imageStem).length;
    await writeFile(
      join(DATA_DIR, 'bosses.json'),
      JSON.stringify({ generatedFrom: BASE, bossCount, bosses }, null, 2),
    );
    console.log(
      `  ✓ bosses.json (${bossCount} bosses` +
        (bossesNoImage ? `, ${bossesNoImage} without an image stem` : '') +
        ')',
    );

    try {
      const spawns = await buildSpawns(seasonConfig, stems);
      await writeFile(join(DATA_DIR, 'spawns.json'), JSON.stringify(spawns, null, 2));
      console.log(
        `  ✓ spawns.json (${Object.keys(spawns.byUnit).length} summoners, ${Object.keys(spawns.units).length} spawnable units)`,
      );
    } catch (err) {
      console.log(`  ✗ spawns (${err.message})`);
    }
  }

  // summary -----------------------------------------------------------------
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n──────────────────────────────────────────`);
  console.log(`Boards:  ${boardsOk}/${boards.length} ok` + (missingBoards.length ? `  (missing: ${missingBoards.join(', ')})` : ''));
  if (!NO_IMAGES)
    console.log(`Images:  ${imagesOk}/${boards.length} ok` + (missingImages.length ? `  (missing: ${missingImages.join(', ')})` : ''));
  console.log(`Output:  public/data/  +  public/images/maps/`);
  console.log(`Done in ${secs}s`);
}

main().catch((err) => {
  console.error('\nDump failed:', err);
  process.exit(1);
});
