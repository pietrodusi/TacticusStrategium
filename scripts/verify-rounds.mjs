// Screenshot the rounds-left counter at phases S(0), 1, 3 (turn 2), 11 (turn 6).
// Run `npx vite preview` first. Usage: node scripts/verify-rounds.mjs
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915 })

for (const phase of [0, 1, 3, 11]) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((p) => {
    localStorage.setItem(
      'tacticus-strategium-plan',
      JSON.stringify({
        state: {
          bossUnitId: 'GuildBoss6Boss1TyranScreamerKiller',
          targetKind: 'boss',
          boardId: 'GB_Screamer_01',
          team: [null, null, null, null, null],
          machineOfWar: null,
          currentTurn: p,
          positions: {},
          paint: {},
          instances: {},
          instanceSeq: 0,
          seededBoard: null,
          primesDefeated: 0,
        },
        version: 1,
      }),
    )
  }, phase)
  await page.goto('about:blank')
  await page.setViewport({ width: 412, height: 915 })
  await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1200))
  await page.screenshot({ path: `verify-rounds-p${phase}.png` })
}

await browser.close()
console.log('wrote verify-rounds-p{0,1,3,11}.png')
