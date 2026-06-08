/** "AdeptusMechanicus" → "Adeptus Mechanicus". */
export function spaceCamel(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

// A few boss names come out raw from the camelCase split; fix the awkward ones.
const BOSS_OVERRIDES: Record<string, string> = {
  BelisariusRW: 'Belisarius Cawl',
  ScreamerKiller: 'Screamer-Killer',
  AvatarOfKhaine: 'Avatar of Khaine',
}

export function bossDisplayName(bossType: string | null, fallback: string): string {
  if (bossType && BOSS_OVERRIDES[bossType]) return BOSS_OVERRIDES[bossType]
  return fallback.replace(/\bOf\b/g, 'of').replace(/\bThe\b/g, 'the')
}

export function factionLabel(faction: string | null): string {
  return faction ? spaceCamel(faction) : 'Unknown'
}
