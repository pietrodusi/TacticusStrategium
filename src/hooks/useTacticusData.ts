import { useQuery } from '@tanstack/react-query'
import { fetchCharacters, fetchGuildBossUnits } from '../services/tacticusdb/client'

export const useCharacters = () =>
  useQuery({ queryKey: ['characters'], queryFn: fetchCharacters })

export const useGuildBossUnits = () =>
  useQuery({ queryKey: ['guildBossUnits'], queryFn: fetchGuildBossUnits })
