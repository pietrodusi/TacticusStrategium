// Visual check that the newly-added maps render with an aligned overlay + seeded
// adds. Run `npx vite preview` first. Usage: node scripts/verify-new-boards.mjs
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const plan = (bossUnitId, boardId, targetKind = 'boss') => ({
  state: {
    bossUnitId,
    targetKind,
    boardId,
    team: [null, null, null, null, null],
    machineOfWar: null,
    currentTurn: 0,
    positions: {},
    paint: {},
    instances: {},
    instanceSeq: 0,
    seededBoard: null,
    primesDefeated: 0,
  },
  version: 1,
})

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' })
const page = await browser.newPage()
for (const [name, boss, board, kind] of [
  ['screamer-02', 'GuildBoss6Boss1TyranScreamerKiller', 'GB_Screamer_02', 'boss'],
  ['magnus-04', 'GuildBoss9Boss1ThousMagnus', 'GB_Magnus_04', 'boss'],
  ['sk-support-07', 'GuildBoss3Minion3NecroMenhir', 'GB_SK_support_07', 'prime'],
]) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((p) => localStorage.setItem('tacticus-strategium-plan', JSON.stringify(p)), plan(boss, board, kind))
  await page.goto('about:blank')
  await page.setViewport({ width: 412, height: 915 })
  await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1800))
  await page.screenshot({ path: `verify-${name}.png` })
}
await browser.close()
console.log('done')
