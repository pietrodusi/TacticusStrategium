// Live catalog fetchers for TacticusDB. CORS is open (Access-Control-Allow-Origin: *).
// We only pull identity + light metadata — this is a movement planner, not a damage calc.

const API = 'https://tacticusdb.com/api/data'

export interface TacticusCharacter {
  name: string
  FactionId: string
  GrandAllianceId: string
  BaseRarity: string
  Movement: number
  traits?: string[]
}
export type CharactersResponse = Record<string, TacticusCharacter>

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TacticusDB ${res.status} for ${url}`)
  // Endpoints serve application/octet-stream; parse as JSON regardless.
  return res.json() as Promise<T>
}

export const fetchCharacters = () => getJson<CharactersResponse>(`${API}/characters`)
