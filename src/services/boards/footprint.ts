import type { HexCoord, Point } from '../../types/strategium'
import { hexKey } from '../hex/hexUtils'
import type { ParsedCell } from './boardService'

export interface Segment {
  a: Point
  b: Point
}

const HEX_DIRS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

/** Index of `c`'s edge facing neighbour `n` — the edge whose midpoint is
 *  nearest the midpoint of the two centres. */
function facingEdge(c: ParsedCell, n: ParsedCell): number {
  const tx = (c.center.x + n.center.x) / 2
  const ty = (c.center.y + n.center.y) / 2
  let bi = -1
  let bd = Infinity
  for (let i = 0; i < 6; i++) {
    const a = c.cornersFull[i]
    const b = c.cornersFull[(i + 1) % 6]
    const dd = ((a.x + b.x) / 2 - tx) ** 2 + ((a.y + b.y) / 2 - ty) ** 2
    if (dd < bd) {
      bd = dd
      bi = i
    }
  }
  return bi
}

/** Boundary edges of a set of cells: every edge not shared with another cell in the set. */
function footprintEdges(cells: ParsedCell[]): Segment[] {
  const byKey = new Map(cells.map((c) => [hexKey({ q: c.q, r: c.r }), c]))
  const segs: Segment[] = []
  for (const c of cells) {
    const internal = new Set<number>()
    for (const d of HEX_DIRS) {
      const n = byKey.get(hexKey({ q: c.q + d.q, r: c.r + d.r }))
      if (n) internal.add(facingEdge(c, n))
    }
    for (let i = 0; i < 6; i++) {
      if (internal.has(i)) continue
      const a = c.cornersFull[i]
      const b = c.cornersFull[(i + 1) % 6]
      segs.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } })
    }
  }
  return segs
}

/**
 * Internal edges between adjacent footprint cells of DIFFERENT elevation — in
 * game a multi-hex unit cannot straddle elevations, so these seams get a
 * warning treatment. The two cells' facing edges don't share exact corners
 * (tiling gap + elevation shift), so each seam averages them, endpoint-matched
 * by proximity.
 */
export function elevationSeams(cells: ParsedCell[]): Segment[] {
  const byKey = new Map(cells.map((c) => [hexKey({ q: c.q, r: c.r }), c]))
  const segs: Segment[] = []
  for (const c of cells) {
    for (const d of HEX_DIRS) {
      const n = byKey.get(hexKey({ q: c.q + d.q, r: c.r + d.r }))
      if (!n || n.elevation === c.elevation) continue
      if (hexKey({ q: c.q, r: c.r }) > hexKey({ q: n.q, r: n.r })) continue // each pair once
      const ci = facingEdge(c, n)
      const ni = facingEdge(n, c)
      const ca = c.cornersFull[ci]
      const cb = c.cornersFull[(ci + 1) % 6]
      const na = n.cornersFull[ni]
      const nb = n.cornersFull[(ni + 1) % 6]
      // The neighbour traverses its edge in the opposite direction — match ends.
      const flip = d2(ca, na) > d2(ca, nb)
      const pa = flip ? nb : na
      const pb = flip ? na : nb
      segs.push({
        a: { x: (ca.x + pa.x) / 2, y: (ca.y + pa.y) / 2 },
        b: { x: (cb.x + pb.x) / 2, y: (cb.y + pb.y) / 2 },
      })
    }
  }
  return segs
}

const d2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

/**
 * Single closed outline of a multi-hex footprint, as an SVG path.
 *
 * The hex tiles don't quite interlock — the cell shape leaves a small gap
 * between rows, and elevation shifts cells vertically — so boundary edges from
 * adjacent cells don't share exact endpoints. Chain the edges greedily,
 * averaging each junction shut, and emit one path so the footprint fills and
 * strokes as a uniform shape (no per-cell seams or gaps).
 */
export function footprintPath(cells: ParsedCell[]): string {
  const segs = footprintEdges(cells)
  if (segs.length === 0) return ''
  // Junction tolerance: well under a hex edge (~40px at 1024 scale), well over
  // the gaps we bridge (~3px tiling gap, ~14px with one elevation step).
  const minLen = Math.min(...segs.map((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)))
  const tol2 = (minLen * 0.45) ** 2

  const remaining = [...segs]
  const loops: Point[][] = []
  while (remaining.length > 0) {
    const first = remaining.shift() as Segment
    const loop: Point[] = [{ ...first.a }, { ...first.b }]
    for (;;) {
      const end = loop[loop.length - 1]
      let bi = -1
      let flip = false
      let bd = tol2
      remaining.forEach((s, i) => {
        const da = d2(end, s.a)
        const db = d2(end, s.b)
        if (da < bd) {
          bd = da
          bi = i
          flip = false
        }
        if (db < bd) {
          bd = db
          bi = i
          flip = true
        }
      })
      if (bi < 0) break
      const s = remaining.splice(bi, 1)[0]
      const join = flip ? s.b : s.a
      end.x = (end.x + join.x) / 2
      end.y = (end.y + join.y) / 2
      loop.push(flip ? { ...s.a } : { ...s.b })
    }
    // Close the loop: merge the trailing point back into the first.
    const head = loop[0]
    const tail = loop[loop.length - 1]
    if (loop.length > 2 && d2(head, tail) < tol2) {
      head.x = (head.x + tail.x) / 2
      head.y = (head.y + tail.y) / 2
      loop.pop()
    }
    loops.push(loop)
  }
  return loops
    .map((loop) => `M${loop.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`)
    .join('')
}
