// Screenshot hazard decay: GB_Belisarius_02 seeds fire + contaminated initial
// tiles (Turns 4 = 2 rounds) and the plan seeds a painted fire@2 at phase 1.
// Phases 1 / 3 / 5 should show counts 2 / 1 / gone.
// Run `npx vite preview` first. Usage: node scripts/verify-hazard-decay.mjs
import puppeteer from 'puppeteer-core'

const BASE = 'http://localhost:4173/TacticusStrategium/#'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 412, height: 915 })

for (const phase of [1, 3, 5]) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((p) => {
    localStorage.setItem(
      'tacticus-strategium-plan',
      JSON.stringify({
        state: {
          bossUnitId: 'GuildBoss10Boss1AdmecBelisarius',
          targetKind: 'boss',
          boardId: 'GB_Belisarius_02',
          team: [null, null, null, null, null],
          machineOfWar: null,
          currentTurn: p,
          positions: {},
          paint: { 1: { '3,3': 'fire@2' } },
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
  await new Promise((r) => setTimeout(r, 1500))
  await page.screenshot({ path: `verify-decay-p${phase}.png` })
}

await browser.close()
console.log('wrote verify-decay-p{1,3,5}.png')
