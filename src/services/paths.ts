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

/**
 * Unit portrait (character/summon/boss/npc) by image stem. Round is best for tokens.
 *
 * TacticusDB moved portraits from `/images/characters/{name}.png` to
 * `/images/generated/characters/{name}.webp` (2026-07); the stems are unchanged.
 */
export const unitPortraitUrl = (stem: string, round = false) =>
  `https://tacticusdb.com/images/generated/characters/${round ? 'RoundPortrait_' : 'portrait_'}${stem}.webp`

/** Character/summon/boss headshot on the Snowprint CDN (175×230 PNG, square-ish crop needed). */
export const cdnPortraitUrl = (stem: string) =>
  `https://cdn.ezekiel.snowprintstudios.com/ui_image_portrait_${stem}_01.png`

/**
 * Portrait URLs to try, best first. The CDN has every character but only ~80%
 * of summons/bosses/NPCs, so TacticusDB stays as the fallback.
 */
export const unitPortraitSources = (stem: string, round = false) => [
  cdnPortraitUrl(stem),
  ...(round ? [unitPortraitUrl(stem, true)] : []),
  unitPortraitUrl(stem, false),
]

/** Bundled keyword/tile-effect icon (e.g. "tile_effect_fire"). */
export const keywordIconUrl = (name: string) => asset(`images/keywords/${name}.png`)
