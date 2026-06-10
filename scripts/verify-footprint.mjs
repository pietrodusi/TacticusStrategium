// Visual check of merged multi-hex footprints: load a 3-hex boss (Tervigon on
// GB_01) and a 7-hex boss (Avatar of Khaine on GB_Khaine_01) and screenshot the
// board. Run `npx vite preview` first. Usage: node scripts/verify-footprint.mjs
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const plan = (bossUnitId, boardId) => ({
  state: {
    bossUnitId,
    targetKind: 'boss',
    boardId,
    team: [null, null, null, null, null],
    machineOfWar: null,
    currentTurn: 0,
    positions: {},
    paint: {},
    instances: {},
    instanceSeq: 0,
    seededBoard: null,
    primesDefeated: 2,
  },
  version: 1,
})

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915 })

for (const [name, bossUnitId, boardId] of [
  ['footprint-3hex', 'GuildBoss1Boss1TyranTervigonLeviathan', 'GB_01'],
  ['footprint-7hex', 'GuildBoss8Boss1EldarAvatar', 'GB_Khaine_01'],
]) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((p) => {
    localStorage.setItem('tacticus-strategium-plan', JSON.stringify(p))
  }, plan(bossUnitId, boardId))
  await page.goto('about:blank')
  await page.setViewport({ width: 412, height: 915 })
  await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: `verify-${name}.png` })
}

await browser.close()
console.log('wrote verify-footprint-3hex.png + verify-footprint-7hex.png')
