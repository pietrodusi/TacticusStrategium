import { describe, expect, it } from 'vitest'
import { extractStemMap, findChunkPaths } from './imageStems'

describe('extractStemMap', () => {
  it('picks the literal holding both character and boss maps', () => {
    const js = `a=JSON.parse('{"other":1}');b=JSON.parse('{"character":{"x":"y"},"boss":{},"summon":{},"npc":{}}')`
    expect(extractStemMap(js)?.character).toEqual({ x: 'y' })
  })

  it("unescapes quotes inside the literal", () => {
    const js = String.raw`JSON.parse('{"character":{"zkar":"z\'kar"},"boss":{}}')`
    expect(extractStemMap(js)?.character.zkar).toBe("z'kar")
  })

  it('skips malformed literals and returns null when absent', () => {
    expect(extractStemMap(`JSON.parse('{oops}');JSON.parse('{"a":1}')`)).toBeNull()
  })
})

describe('findChunkPaths', () => {
  it('dedupes paths, including ones escaped inside flight data', () => {
    const html = String.raw`<script src="/_next/static/chunks/a-1.js"></script>self.push("\"static/chunks/b-2.js\",\"static/chunks/a-1.js\"")`
    expect(findChunkPaths(html)).toEqual(['static/chunks/a-1.js', 'static/chunks/b-2.js'])
  })
})
