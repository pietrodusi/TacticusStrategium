/*
 * One-shot snapshot patch: add the boss/prime maps that exist on TacticusDB but
 * were never referenced by any of the 5 dumped seasons (boards are per-boss, not
 * per-season — a season just rolls a subset). Downloads the board JSON + visual,
 * wires each into the boss/prime map pool, and seeds adds by reusing the same
 * boss/prime's roster from a sibling board onto the new board's own enemy spawn
 * group (option b — positions are real, only the roster is borrowed).
 *
 * The dump script (buildBossIndex/buildPrimeIndex/buildSpawns) was updated to do
 * this automatically on future runs; this patch brings the committed snapshot up
 * to date without a full re-dump.
 *
 *   node scripts/patch-missing-boards.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://tacticusdb.com';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');
const BOARDS = join(DATA, 'boards');
const MAPS = join(ROOT, 'public', 'images', 'maps');

// Main boss maps → { boss unitId, sibling board to borrow the roster from (null =
// solo boss, no pre-deployed adds) }.
const MAIN = {
  GB_Lion_03: { boss: 'GuildBoss12Boss1DarkaLion', sibling: 'GB_Lion_02' },
  GB_Magnus_02: { boss: 'GuildBoss9Boss1ThousMagnus', sibling: 'GB_Magnus_03' },
  GB_Magnus_04: { boss: 'GuildBoss9Boss1ThousMagnus', sibling: 'GB_Magnus_03' },
  GB_SK_04: { boss: 'GuildBoss3Boss1NecroSilentKing', sibling: 'GB_SK_02' },
  GB_Screamer_02: { boss: 'GuildBoss6Boss1TyranScreamerKiller', sibling: 'GB_Screamer_03' },
  // Mortarion fights solo (its main encounters list zero adds) — no deployment.
  GB_Mortarion_01: { boss: 'GuildBoss5Boss1DeathMortarion', sibling: null },
  GB_Mortarion_02_1: { boss: 'GuildBoss5Boss1DeathMortarion', sibling: null },
  GB_Mortarion_04: { boss: 'GuildBoss5Boss1DeathMortarion', sibling: null },
  GB_Mortarion_05: { boss: 'GuildBoss5Boss1DeathMortarion', sibling: null },
};

// Prime (mini-boss) support maps → { prime unitId, sibling board }. The board
// JSON doesn't name its owner, so multi-prime bosses use the established naming
// pattern: Mortarion's Rotbone owns the odd maps (01,03,05…), Corrodius the even
// (02,04,06…); `_N_1` is a variant of map N. Silent King has a single prime.
const SUPPORT = {
  GB_SK_support_07: { prime: 'GuildBoss3Minion3NecroMenhir', sibling: 'GB_SK_support_06' },
  GB_SK_support_08: { prime: 'GuildBoss3Minion3NecroMenhir', sibling: 'GB_SK_support_05' },
  GB_Mortarion_support_05: { prime: 'GuildBoss5MiniBoss1DeathRotbone', sibling: 'GB_Mortarion_support_03' },
  GB_Mortarion_support_05_1: { prime: 'GuildBoss5MiniBoss1DeathRotbone', sibling: 'GB_Mortarion_support_03' },
  GB_Mortarion_support_06: { prime: 'GuildBoss5MiniBoss2DeathBlightbringer', sibling: 'GB_Mortarion_support_04' },
  GB_Mortarion_support_04_1: { prime: 'GuildBoss5MiniBoss2DeathBlightbringer', sibling: 'GB_Mortarion_support_04' },
};

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const writeJson = (p, o) => writeFile(p, JSON.stringify(o, null, 2));
const sortUniq = (a) => [...new Set(a)].sort();

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

/** Place a roster (ordered [{unitId, removeAtPrime}]) onto a board's enemy spawn
 *  group — mirrors the dump script's buildEnemies (positions from the board). */
function placeRoster(board, roster) {
  const group = board.SpawnPointSets?.[0]?.SpawnPointGroups?.find((g) => g.TeamWithPlayerIndex === 1);
  if (!group) return null;
  const enemies = [];
  let placed = 0;
  let dp = 0;
  for (const sp of group.SpawnPoints) {
    const deploymentOrder = sp.SpawnPointType !== 10 ? ++dp : null;
    if (placed >= roster.length) continue;
    const { unitId, removeAtPrime } = roster[placed++];
    enemies.push({ unitId, col: sp.Column, row: sp.Row, deploymentOrder, removeAtPrime: removeAtPrime ?? null });
  }
  return enemies;
}

async function main() {
  const bossesFile = await readJson(join(DATA, 'bosses.json'));
  const primesFile = await readJson(join(DATA, 'primes.json'));
  const spawns = await readJson(join(DATA, 'spawns.json'));
  const manifest = await readJson(join(DATA, 'boards-manifest.json'));
  const manifestById = new Map(manifest.boards.map((b) => [b.boardId, b]));

  const newBoards = [...Object.keys(MAIN), ...Object.keys(SUPPORT)];

  const onDisk = async (p) => {
    try {
      await readFile(p);
      return true;
    } catch {
      return false;
    }
  };

  // 1) download board JSON + visual image for each new board (skip if present so
  //    re-running after a dump is cheap and offline-safe) ----------------------
  const boardData = {};
  for (const id of newBoards) {
    const boardPath = join(BOARDS, `${id}.json`);
    let data;
    if (await onDisk(boardPath)) {
      data = await readJson(boardPath);
    } else {
      data = await fetchJson(`${BASE}/board/${id}.json`);
      await writeJson(boardPath, data);
    }
    boardData[id] = data;
    const imgPath = join(MAPS, `${id}_Visual.jpeg`);
    if (!(await onDisk(imgPath))) {
      const img = await fetch(`${BASE}/images/board/${id}_Visual.jpeg`);
      if (!img.ok) throw new Error(`image ${id} HTTP ${img.status}`);
      await writeFile(imgPath, Buffer.from(await img.arrayBuffer()));
    }
    console.log(`  ✓ ${id} (${data.Width}×${data.Height})`);
  }

  // 2) main boss maps: bosses.json boardIds + a reused-roster deployment -------
  for (const [id, { boss, sibling }] of Object.entries(MAIN)) {
    const b = bossesFile.bosses.find((x) => x.unitId === boss);
    if (!b) throw new Error(`boss ${boss} not in bosses.json`);
    b.boardIds = sortUniq([...b.boardIds, id]);

    let bossTypes = [b.bossType];
    // Skip seeding if a real encounter-backed deployment already exists (e.g. a
    // future season started using this map) — never clobber the real one.
    if (sibling && !spawns.deployments[id]) {
      const sib = spawns.deployments[sibling];
      if (!sib) throw new Error(`sibling deployment ${sibling} missing`);
      const roster = sib.enemies.map((e) => ({ unitId: e.unitId, removeAtPrime: e.removeAtPrime }));
      const enemies = placeRoster(boardData[id], roster);
      if (!enemies) throw new Error(`${id} has no enemy spawn group`);
      spawns.deployments[id] = {
        bossType: sib.bossType,
        bossUnitId: sib.bossUnitId,
        rarity: sib.rarity,
        enemies,
        primes: sib.primes,
      };
      bossTypes = [sib.bossType];
    }
    if (!manifestById.has(id))
      manifestById.set(id, {
        boardId: id,
        width: boardData[id].Width,
        height: boardData[id].Height,
        encounterCount: 0,
        bossTypes: bossTypes.filter(Boolean),
        types: ['Boss'],
      });
  }

  // 3) prime support maps: primes.json boardIds + a reused-roster deployment ---
  for (const [id, { prime, sibling }] of Object.entries(SUPPORT)) {
    const p = primesFile.primes.find((x) => x.unitId === prime);
    if (!p) throw new Error(`prime ${prime} not in primes.json`);
    p.boardIds = sortUniq([...p.boardIds, id]);

    if (!spawns.primeDeployments[prime]?.[id]) {
      const sib = spawns.primeDeployments[prime]?.[sibling];
      if (!sib) throw new Error(`sibling prime deployment ${prime}/${sibling} missing`);
      const roster = sib.enemies.map((e) => ({ unitId: e.unitId, removeAtPrime: e.removeAtPrime }));
      const enemies = placeRoster(boardData[id], roster);
      if (!enemies) throw new Error(`${id} has no enemy spawn group`);
      (spawns.primeDeployments[prime] ??= {})[id] = { rarity: sib.rarity, enemies };
    }

    if (!manifestById.has(id))
      manifestById.set(id, {
        boardId: id,
        width: boardData[id].Width,
        height: boardData[id].Height,
        encounterCount: 0,
        bossTypes: p.bossTypes,
        types: ['Crystal'],
      });
  }

  // 4) rewrite the index files ------------------------------------------------
  manifest.boards = [...manifestById.values()].sort((a, b) => a.boardId.localeCompare(b.boardId));
  manifest.boardCount = manifest.boards.length;

  await writeJson(join(DATA, 'bosses.json'), bossesFile);
  await writeJson(join(DATA, 'primes.json'), primesFile);
  await writeJson(join(DATA, 'spawns.json'), spawns);
  await writeJson(join(DATA, 'boards-manifest.json'), manifest);

  console.log(`\nAdded ${newBoards.length} boards. Manifest now ${manifest.boardCount}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
