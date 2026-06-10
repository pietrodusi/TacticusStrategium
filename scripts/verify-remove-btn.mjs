// Screenshot the floating Remove button: load GB_Screamer_01 (its 10 initial
// adds seed automatically), tap one enemy token to select it, capture the
// button on the board edge. Run `npx vite preview` first.
// Usage: node scripts/verify-remove-btn.mjs
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

// Tap an enemy add to select it (shows the Remove button).
const token = await page.$('[data-token-id^="inst-"]')
const box = await token.boundingBox()
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: 'verify-remove-btn.png' })

await browser.close()
console.log('wrote verify-remove-btn.png')
