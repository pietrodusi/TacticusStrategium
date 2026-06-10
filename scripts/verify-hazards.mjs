// Check hazard icons: initial fire/contaminated tiles render their keyword
// icons (GB_Belisarius_02 has both), and the Paint panel shows 4 colours, a
// separator, then the 3 hazard stamps. Run `npx vite preview` first.
// Usage: node scripts/verify-hazards.mjs
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
        bossUnitId: 'GuildBoss10Boss1AdmecBelisarius',
        targetKind: 'boss',
        boardId: 'GB_Belisarius_02',
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
    }),
  )
})
await page.goto('about:blank')
await page.setViewport({ width: 412, height: 915 })
await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: 'verify-hazards-board.png' })

// Open the Paint panel.
for (const b of await page.$$('button')) {
  if ((await b.evaluate((el) => el.textContent))?.trim() === 'Paint') {
    await b.click()
    break
  }
}
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: 'verify-hazards-panel.png' })

await browser.close()
console.log('wrote verify-hazards-board.png + verify-hazards-panel.png')
