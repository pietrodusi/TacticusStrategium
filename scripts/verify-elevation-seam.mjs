// Screenshot the dashed red elevation seams: place the 3-hex Tervigon over
// GB_01's elevation-4 peak at (5,2) so its footprint straddles levels.
// Run `npx vite preview` first. Usage: node scripts/verify-elevation-seam.mjs
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915 })

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem(
    'tacticus-strategium-plan',
    JSON.stringify({
      state: {
        bossUnitId: 'GuildBoss1Boss1TyranTervigonLeviathan',
        targetKind: 'boss',
        boardId: 'GB_01',
        team: [null, null, null, null, null],
        machineOfWar: null,
        currentTurn: 0,
        positions: { GuildBoss1Boss1TyranTervigonLeviathan: { 0: { q: 5, r: 2, rot: 0 } } },
        paint: {},
        instances: {},
        instanceSeq: 0,
        seededBoard: null,
        primesDefeated: 0,
      },
      version: 1,
    }),
  )
})
await page.goto('about:blank')
await page.setViewport({ width: 412, height: 915 })
await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: 'verify-seam.png' })

await browser.close()
console.log('wrote verify-seam.png')
