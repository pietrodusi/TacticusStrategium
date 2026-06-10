// One-off visual check: block tacticusdb.com so the live roster fetch fails,
// then screenshot the Setup page (step III open) and the Board page banner.
// Run `npx vite preview` first. Usage: node scripts/verify-error-ui.mjs
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915 })
await page.setRequestInterception(true)
page.on('request', (req) =>
  req.url().includes('tacticusdb.com') ? req.abort() : req.continue(),
)

// Setup page — open step III (Raid Team) where the roster error shows.
await page.goto(`${BASE}/plan`, { waitUntil: 'networkidle0' })
const buttons = await page.$$('section button')
for (const b of buttons) {
  const text = await b.evaluate((el) => el.textContent)
  if (text?.includes('Raid Team')) {
    await b.click()
    break
  }
}
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: 'verify-setup-error.png' })

// Board page — seed a minimal plan so /plan/board doesn't redirect, then check
// the compact "unit data" banner (board JSON is bundled, so the map itself loads).
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
// Leave the app entirely, then load the board URL fresh so the store hydrates
// from the seeded localStorage (a same-page hash change wouldn't rehydrate).
await page.goto('about:blank')
await page.setViewport({ width: 412, height: 915 })
await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: 'verify-board-error.png' })

await browser.close()
console.log('wrote verify-setup-error.png + verify-board-error.png')
