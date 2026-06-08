// URL helpers. Runtime assets live under public/ and must respect Vite's base path.

const BASE = import.meta.env.BASE_URL

/** Resolve a path inside public/ against the deployment base. */
export const asset = (path: string) => `${BASE}${path.replace(/^\//, '')}`

/** Bundled map background (dumped by scripts/dump-tacticusdb.mjs). */
export const mapImageUrl = (boardId: string) => asset(`images/maps/${boardId}_Visual.jpeg`)

/** Live map background straight from TacticusDB (fallback / refresh). */
export const liveMapImageUrl = (boardId: string) =>
  `https://tacticusdb.com/images/board/${boardId}_Visual.jpeg`

/** Boss splash art on the Snowprint CDN (large preview). */
export const bossSplashUrl = (guildBossUnitKey: string) =>
  `https://cdn.ezekiel.snowprintstudios.com/${guildBossUnitKey}_BattlePreviewPopUp.png`

/** Unit portrait (character/summon/boss/npc) by image stem. Round is best for tokens. */
export const unitPortraitUrl = (stem: string, round = false) =>
  `https://tacticusdb.com/images/characters/${round ? 'RoundPortrait_' : 'portrait_'}${stem}.png`
