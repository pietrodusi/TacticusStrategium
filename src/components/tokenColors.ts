export type TokenKind = 'character' | 'mow' | 'boss' | 'summon' | 'npc'

/**
 * Ring/footprint colour per token kind.
 * Ally side (blue family): squad teal, allied summon light blue.
 * Enemy side (purple family): boss purple, enemy summon light purple. MoW brass.
 */
export const RING_COLOR: Record<TokenKind, string> = {
  character: '#2cd0d8',
  mow: '#b88f4d',
  boss: '#a855f7',
  summon: '#7dd3fc',
  npc: '#c4b5fd',
}

const ALLY_SELECTED = '#66f0f5'

/** Ring colour while selected: bright teal for allies, a brighter purple for enemies. */
export const SELECTED_RING_COLOR: Record<TokenKind, string> = {
  character: ALLY_SELECTED,
  mow: ALLY_SELECTED,
  boss: '#c77dff',
  summon: ALLY_SELECTED,
  npc: '#b388ff',
}
