// Check tray ordering: turn S leads with main units (solid chips), later turns
// lead with the spawn palette (dashed chips), in both Allies and Enemies tabs.
// Run `npx vite preview` first. Usage: node scripts/verify-tray-order.mjs
/* global document -- page.evaluate callbacks run in the browser */
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const plan = (currentTurn) => ({
  state: {
    bossUnitId: 'GuildBoss6Boss1TyranScreamerKiller',
    targetKind: 'boss',
    boardId: 'GB_Screamer_01',
    team: ['necroSpyder', null, null, null, null],
    machineOfWar: null,
    currentTurn,
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

const clickTab = async (label) => {
  for (const b of await page.$$('button')) {
    if ((await b.evaluate((el) => el.textContent))?.trim() === label) {
      await b.click()
      await new Promise((r) => setTimeout(r, 250))
      return
    }
  }
  throw new Error(`tab not found: ${label}`)
}

const chipKinds = () =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('div.grid > div')].filter(
      (el) => !el.classList.contains('invisible'),
    )
    return [...rows[0].querySelectorAll(':scope > button')].map((b) =>
      b.className.includes('border-dashed') ? 'spawn' : 'main',
    )
  })

for (const turn of [0, 1]) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((p) => {
    localStorage.setItem('tacticus-strategium-plan', JSON.stringify(p))
  }, plan(turn))
  await page.goto('about:blank')
  await page.setViewport({ width: 412, height: 915 })
  await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1200))
  for (const tab of ['Allies', 'Enemies']) {
    await clickTab(tab)
    console.log(`turn ${turn === 0 ? 'S' : turn} ${tab}: ${(await chipKinds()).join(', ')}`)
  }
}

await browser.close()
