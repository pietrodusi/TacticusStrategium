// Screenshot the board-edge action notches: a size-1 add shows Remove, the
// size-3 boss shows Rotate (stacked slot under the Paint notch).
// Run `npx vite preview` first. Usage: node scripts/verify-side-actions.mjs
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

const tap = async (selector) => {
  const el = await page.$(selector)
  const box = await el.boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await new Promise((r) => setTimeout(r, 400))
}

await tap('[data-token-id^="inst-"]') // size-1 add → Remove notch
await page.screenshot({ path: 'verify-side-remove.png' })
await tap('[data-token-id^="inst-"]') // deselect
await tap('[data-token-id^="GuildBoss"]') // size-3 boss → Rotate notch
await page.screenshot({ path: 'verify-side-rotate.png' })

await browser.close()
console.log('wrote verify-side-remove.png + verify-side-rotate.png')
