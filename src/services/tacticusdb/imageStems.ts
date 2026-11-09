import type { ImageStems } from '../../types/units'

const SITE = 'https://tacticusdb.com'

/** Find TacticusDB's `unitId -> stem` map among a chunk's `JSON.parse('{...}')` literals. */
export function extractStemMap(js: string): ImageStems | null {
  const literal = /JSON\.parse\('(\{(?:[^'\\]|\\.)*\})'\)/g
  for (const [, body] of js.matchAll(literal)) {
    try {
      const obj = JSON.parse(body.replace(/\\'/g, "'").replace(/\\\\/g, '\\'))
      if (obj?.character && obj?.boss) return obj as ImageStems
    } catch {
      // Some other embedded JSON literal; keep looking.
    }
  }
  return null
}

/** Unique `static/chunks/*.js` paths referenced by a Next.js page. */
export const findChunkPaths = (html: string): string[] => [
  ...new Set(html.match(/static\/chunks\/[^"'\\\s]+?\.js/g) ?? []),
]

async function getText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TacticusDB ${res.status} for ${url}`)
  return res.text()
}

/**
 * Current stem map, read straight from TacticusDB's /bosses page. Chunk names
 * change between their deploys, so every chunk on the page is scanned. Used only
 * for characters newer than the bundled public/data/imageStems.json.
 */
export async function fetchLiveImageStems(): Promise<ImageStems> {
  const chunks = findChunkPaths(await getText(`${SITE}/bosses`))
  for (const chunk of chunks) {
    const stems = extractStemMap(await getText(`${SITE}/_next/${chunk}`))
    if (stems) return stems
  }
  throw new Error('image-stem map not found on the TacticusDB /bosses page')
}
