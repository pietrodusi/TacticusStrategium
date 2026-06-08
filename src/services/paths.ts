// URL helpers. Runtime assets live under public/ and must respect Vite's base path.

const BASE = import.meta.env.BASE_URL

/** Resolve a path inside public/ against the deployment base. */
export const asset = (path: string) => `${BASE}${path.replace(/^\//, '')}`

/** Bundled map background (dumped by scripts/dump-tacticusdb.mjs). */
export const mapImageUrl = (boardId: string) => asset(`images/maps/${boardId}_Visual.jpeg`)

/** Live map background straight from TacticusDB (fallback / refresh). */
export const liveMapImageUrl = (boardId: string) =>
  `https://tacticusdb.com/images/board/${boardId}_Visual.jpeg`

/** Boss portrait on the Snowprint CDN. */
export const bossPortraitUrl = (guildBossUnitKey: string) =>
  `https://cdn.ezekiel.snowprintstudios.com/${guildBossUnitKey}_BattlePreviewPopUp.png`
