import { useQuery } from '@tanstack/react-query'
import type { BoardData, BoardsManifest } from '../types/boardData'
import { parseBoard, type ParsedBoard } from '../services/boards/boardService'
import { asset } from '../services/paths'

/** The bundled list of all maps (public/data/boards-manifest.json). */
export const useBoardsManifest = () =>
  useQuery({
    queryKey: ['boards-manifest'],
    queryFn: async (): Promise<BoardsManifest> => {
      const res = await fetch(asset('data/boards-manifest.json'))
      if (!res.ok) throw new Error(`manifest ${res.status}`)
      return res.json()
    },
  })

/** Load + parse a single board by id (public/data/boards/{id}.json). */
export const useBoard = (boardId: string | null) =>
  useQuery({
    queryKey: ['board', boardId],
    enabled: !!boardId,
    queryFn: async (): Promise<ParsedBoard> => {
      const res = await fetch(asset(`data/boards/${boardId}.json`))
      if (!res.ok) throw new Error(`board ${boardId} ${res.status}`)
      const data = (await res.json()) as BoardData
      return parseBoard(data)
    },
  })
