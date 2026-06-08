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
 *
 * Output:
 *   public/data/guildBossSeasonConfigs.json   (master index)
 *   public/data/boards/{boardId}.json         (per-map tile data)
 *   public/data/boards-manifest.json          (list of boards + metadata)
 *   public/images/maps/{boardId}_Visual.jpeg  (map backgrounds)
 *
 * Re-run any time to refresh. Idempotent: re-downloads everything by default,
 * pass --skip-existing to keep files already on disk.
 *
 * Usage:
 *   node scripts/dump-tacticusdb.mjs [--no-images] [--skip-existing] [--concurrency=8]
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
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
        boardsOk++;
        return { ...b, width: null, height: null, skipped: true };
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
