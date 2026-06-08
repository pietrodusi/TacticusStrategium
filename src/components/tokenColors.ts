export type TokenKind = 'character' | 'mow' | 'boss' | 'summon' | 'npc'

/** Ring colour per token kind: squad teal, MoW brass, boss red, summon green, enemy NPC orange. */
export const RING_COLOR: Record<TokenKind, string> = {
  character: '#2cd0d8',
  mow: '#b88f4d',
  boss: '#cf4632',
  summon: '#4ade80',
  npc: '#f0883e',
}
