// End-to-end undo check: drag an enemy token to another hex, press Undo, and
// confirm the token returns to its original spot (and the button disables).
// Run `npx vite preview` first. Usage: node scripts/verify-undo.mjs
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

const tokenCenter = async () => {
  const box = await (await page.$('[data-token-id^="inst-"]')).boundingBox()
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
}

const before = await tokenCenter()
// Drag the token ~2 hexes right.
await page.mouse.move(before.x, before.y)
await page.mouse.down()
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(before.x + i * 10, before.y)
  await new Promise((r) => setTimeout(r, 30))
}
await page.mouse.up()
await new Promise((r) => setTimeout(r, 400))
const moved = await tokenCenter()
console.log(`drag: (${before.x},${before.y}) -> (${moved.x},${moved.y})`)

const clickUndo = async () => {
  for (const b of await page.$$('button')) {
    if ((await b.evaluate((el) => el.textContent))?.trim() === 'Undo') {
      await b.click()
      await new Promise((r) => setTimeout(r, 300))
      return
    }
  }
  throw new Error('Undo button not found')
}
await page.screenshot({ path: 'verify-undo-before.png' })
await clickUndo()
const after = await tokenCenter()
console.log(`undo: token back at (${after.x},${after.y}) — expected (${before.x},${before.y})`)
const disabled = await page.evaluate(
  () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Undo')?.disabled,
)
console.log(`undo button disabled after last step: ${disabled}`)
await page.screenshot({ path: 'verify-undo-after.png' })

await browser.close()
