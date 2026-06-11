// Regenerate the Guide & FAQ screenshots (public/images/guide/*.png) against
// the current UI. Scene: Belisarius Cawl on GB_Belisarius_01, first three
// roster units (picked through the real UnitPickerModal), three tokens placed,
// phase advanced to turn 5, paint panel open for the last shot.
// Run `npm run build && npx vite preview` first, then: node scripts/shot-guide.mjs
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'public/images/guide'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 })

// Seed boss + map (squad gets filled through the UI so the roster stays live).
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem(
    'tacticus-strategium-plan',
    JSON.stringify({
      state: {
        bossUnitId: 'GuildBoss10Boss1AdmecBelisarius',
        targetKind: 'boss',
        boardId: 'GB_Belisarius_01',
        team: [null, null, null, null, null],
        machineOfWar: null,
        currentTurn: 0,
        positions: {},
        paint: {},
        instances: {},
        instanceSeq: 0,
        seededBoard: null,
        primesDefeated: 2,
        cloudRef: null,
      },
      version: 2,
    }),
  )
})

// Hash navigation doesn't reload the app — reload so the store re-hydrates
// from the seeded localStorage, and wait for Firebase auth to resolve to
// signed-out (header "Sign In" appears) before navigating on within the SPA.
await page.reload({ waitUntil: 'networkidle0' })
await page
  .waitForFunction(() => /sign in/i.test(document.body.innerText), { timeout: 45000 })
  .catch(async () => {
    await page.screenshot({ path: 'shot-guide-debug.png' })
    throw new Error('auth never resolved — see shot-guide-debug.png')
  })

// ── setup.png — fill the first three squad slots via the picker ──
await page.goto(`${BASE}/plan`, { waitUntil: 'networkidle0' })
await sleep(800)
// The accordion opens on step I — expand step III (Raid Team).
for (const b of await page.$$('section button')) {
  const t = await b.evaluate((el) => el.textContent)
  if (t?.toLowerCase().includes('raid team')) {
    await b.click()
    break
  }
}
await page.waitForSelector('button.border-dashed', { timeout: 30000 }).catch(async () => {
  await page.screenshot({ path: 'shot-guide-debug.png' })
  throw new Error('no empty slot found — see shot-guide-debug.png')
})
await sleep(600)
for (let i = 0; i < 3; i++) {
  const slot = await page.$('button.border-dashed') // first empty squad slot
  await slot.click()
  // Scope to the picker overlay (z-50) — the page itself also has .grid containers.
  await page.waitForSelector('div.z-50 div.grid button:not([disabled]) img')
  await sleep(400) // let portraits paint
  const tile = await page.$('div.z-50 div.grid button:not([disabled])')
  await tile.click()
  await page.waitForSelector('div.z-50', { hidden: true })
  await sleep(200)
}
await sleep(1200) // slot portraits
await page.screenshot({ path: `${OUT}/setup.png` })
console.log('wrote setup.png')

// ── board.png — place the squad, advance to turn 5 ──
await page.goto(`${BASE}/plan/board`, { waitUntil: 'networkidle0' })
await sleep(1800) // board image + seeding
// Squad chips in the dock tray (PaletteChip is the dashed variant — skip it).
const chips = await page.$$('button.shrink-0.flex-col:not(.border-dashed)')
const spots = [
  [120, 380],
  [195, 345],
  [255, 395],
]
for (let i = 0; i < Math.min(3, chips.length); i++) {
  await chips[i].click()
  await sleep(450)
  await page.mouse.click(spots[i][0], spots[i][1])
  await sleep(500)
  // Placing auto-deselects; if the Remove notch is still up, the map click
  // raced the chip selection — click the spot again to actually place.
  if (await page.$('button[title^="Remove "]')) {
    await page.mouse.click(spots[i][0], spots[i][1])
    await sleep(500)
  }
}
for (let i = 0; i < 9; i++) {
  await page.click('[aria-label="Next phase"]')
  await sleep(120)
}
await sleep(600)
await page.screenshot({ path: `${OUT}/board.png` })
console.log('wrote board.png')

// ── paint.png — open the paint panel ──
for (const b of await page.$$('button')) {
  if ((await b.evaluate((el) => el.textContent))?.trim() === 'Paint') {
    await b.click()
    break
  }
}
await sleep(500)
await page.screenshot({ path: `${OUT}/paint.png` })
console.log('wrote paint.png')

await browser.close()
