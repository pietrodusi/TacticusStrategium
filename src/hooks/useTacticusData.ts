import { useQuery } from '@tanstack/react-query'
import { fetchCharacters } from '../services/tacticusdb/client'

export const useCharacters = () =>
  useQuery({ queryKey: ['characters'], queryFn: fetchCharacters })
