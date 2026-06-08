import { useQuery } from '@tanstack/react-query'
import { asset } from '../services/paths'
import type { BossIndex, ImageStems, Unit } from '../types/units'
import type { TacticusCharacter } from '../services/tacticusdb/client'
import { useCharacters } from './useTacticusData'

/** Bundled boss picker index (public/data/bosses.json). */
export const useBosses = () =>
  useQuery({
    queryKey: ['bosses'],
    queryFn: async (): Promise<BossIndex> => {
      const res = await fetch(asset('data/bosses.json'))
      if (!res.ok) throw new Error(`bosses ${res.status}`)
      return res.json()
    },
  })

/** Bundled unitId → portrait stem map (public/data/imageStems.json). */
export const useImageStems = () =>
  useQuery({
    queryKey: ['imageStems'],
    queryFn: async (): Promise<ImageStems> => {
      const res = await fetch(asset('data/imageStems.json'))
      if (!res.ok) throw new Error(`imageStems ${res.status}`)
      return res.json()
    },
  })

function toUnit(id: string, c: TacticusCharacter, stems: ImageStems): Unit {
  return { id, name: c.name, faction: c.FactionId ?? null, stem: stems.character[id] ?? null }
}

const isMachineOfWar = (c: TacticusCharacter) => (c.traits ?? []).includes('MachineOfWar')

/**
 * The live character roster split into regular characters and Machines of War,
 * each joined with its portrait stem. Sorted by name.
 */
export function useRoster() {
  const chars = useCharacters()
  const stems = useImageStems()

  let roster: Unit[] = []
  let machinesOfWar: Unit[] = []
  if (chars.data && stems.data) {
    const all = Object.entries(chars.data)
    const byName = (a: Unit, b: Unit) => a.name.localeCompare(b.name)
    roster = all
      .filter(([, c]) => !isMachineOfWar(c))
      .map(([id, c]) => toUnit(id, c, stems.data))
      .sort(byName)
    machinesOfWar = all
      .filter(([, c]) => isMachineOfWar(c))
      .map(([id, c]) => toUnit(id, c, stems.data))
      .sort(byName)
  }

  return {
    roster,
    machinesOfWar,
    isLoading: chars.isLoading || stems.isLoading,
    isError: chars.isError || stems.isError,
  }
}
