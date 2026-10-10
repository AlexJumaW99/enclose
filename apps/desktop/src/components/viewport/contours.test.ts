import { describe, expect, it } from "vitest"

import { contoursOf } from "./contours"

const always = () => true

/** Two triangles sharing the line from (0,0,0) to (0,1,0), the second lifted by `rise`. */
const hinge = (rise: number) => ({
  position: [0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, rise],
  index: [0, 1, 2, 3, 5, 4],
})

/** The side of a prism of `sides` sides standing on the ground, two triangles a side. */
function prism(sides: number) {
  const position: number[] = []
  const index: number[] = []
  const at = (i: number, z: number) => [
    Math.cos((i / sides) * 2 * Math.PI),
    Math.sin((i / sides) * 2 * Math.PI),
    z,
  ]
  for (let i = 0; i < sides; i++) {
    const base = position.length / 3
    // each side has corners of its own, as a mesh with a normal to each corner has
    position.push(...at(i, 0), ...at(i + 1, 0), ...at(i + 1, 1), ...at(i, 1))
    index.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  return { position, index }
}

describe("contoursOf", () => {
  it("keeps the line where two triangles of a bending surface meet", () => {
    const { position, index } = hinge(0.2)
    const { ends, ways } = contoursOf(position, index, always)
    expect(ends).toHaveLength(6)
    expect(ways).toHaveLength(6)
    expect([ends.slice(0, 3), ends.slice(3)].sort()).toEqual([
      [0, 0, 0],
      [0, 1, 0],
    ])
    // the two triangles face nearly, but not quite, the same way
    const dot = ways[0] * ways[3] + ways[1] * ways[4] + ways[2] * ways[5]
    expect(dot).toBeGreaterThan(0.9)
    expect(dot).toBeLessThan(1)
  })

  it("keeps none where they lie in one plane", () => {
    const { position, index } = hinge(0)
    expect(contoursOf(position, index, always).ends).toEqual([])
  })

  it("keeps none where the two are not of one surface", () => {
    const { position, index } = hinge(0.2)
    expect(contoursOf(position, index, () => false).ends).toEqual([])
  })

  it("finds the lines up the side of a cylinder, and not the ones across its sides", () => {
    const { position, index } = prism(24)
    const { ends } = contoursOf(position, index, always)
    expect(ends).toHaveLength(24 * 6)
    for (let line = 0; line < 24; line++) {
      const [x1, y1, z1, x2, y2, z2] = ends.slice(line * 6, line * 6 + 6)
      expect([x1, y1]).toEqual([x2, y2])
      expect(Math.abs(z2 - z1)).toBe(1)
    }
  })

  it("tells what it is asked of which two triangles, and how they are turned", () => {
    const { position, index } = hinge(1)
    const asked: number[][] = []
    contoursOf(position, index, (a, b, cos) => {
      asked.push([a, b, Math.round(cos * 1000) / 1000])
      return true
    })
    expect(asked).toEqual([[1, 0, 0.707]])
  })
})
