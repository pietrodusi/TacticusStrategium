// Check the tools dock keeps one height across Allies / Enemies / View tabs.
// Uses GB_Screamer_01 (2 primes, 10 initial adds) so the View tab shows both
// the elevation toggle and the Primes-defeated stepper (its tallest state).
// Run `npx vite preview` first. Usage: node scripts/verify-dock-tabs.mjs
/* global document -- page.evaluate callbacks run in the browser */
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
        bossUnitId: 'GuildBoss6Boss1TyranScreamerKiller',
        targetKind: 'boss',
        boardId: 'GB_Screamer_01',
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
    }),
  )
})
await page.goto('about:blank')
await page.setViewport({ width: 412, height: 915 })
await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))

const clickTab = async (label) => {
  const btns = await page.$$('button')
  for (const b of btns) {
    const t = (await b.evaluate((el) => el.textContent))?.trim()
    if (t === label) {
      await b.click()
      await new Promise((r) => setTimeout(r, 250))
      return
    }
  }
  throw new Error(`tab not found: ${label}`)
}

const dockHeight = () =>
  page.evaluate(() => {
    const grids = [...document.querySelectorAll('div.grid')]
    const tray = grids[grids.length - 1]
    return Math.round(tray.getBoundingClientRect().height)
  })

for (const label of ['Allies', 'Enemies', 'View']) {
  await clickTab(label)
  console.log(`${label}: tray ${await dockHeight()}px`)
  await page.screenshot({ path: `verify-tab-${label.toLowerCase()}.png` })
}

await browser.close()
