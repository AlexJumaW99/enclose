import { describe, expect, it } from "vitest"

import { shellOf } from "./shell"

/** A cube of side 2 about the origin: each side a mesh of its own, as a CAD file has them. */
function cube(without = -1) {
  const corner = (x: number, y: number, z: number) => [x, y, z]
  const sides = [
    // each wound so that it faces out
    [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)],
    [
      corner(-1, -1, -1),
      corner(-1, -1, 1),
      corner(-1, 1, 1),
      corner(-1, 1, -1),
    ],
    [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [
      corner(-1, -1, -1),
      corner(1, -1, -1),
      corner(1, -1, 1),
      corner(-1, -1, 1),
    ],
    [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)],
    [
      corner(-1, -1, -1),
      corner(-1, 1, -1),
      corner(1, 1, -1),
      corner(1, -1, -1),
    ],
  ]
  return sides
    .filter((_, side) => side !== without)
    .map((side) => ({ position: side.flat(), index: [0, 1, 2, 0, 2, 3] }))
}

describe("shellOf", () => {
  it("finds a box closed, whichever of its faces a side is written in", () => {
    expect(shellOf(cube()).closed).toBe(true)
  })

  it("finds it open with a side missing", () => {
    expect(shellOf(cube(4)).closed).toBe(false)
  })

  it("finds nothing closed in nothing", () => {
    expect(shellOf([]).closed).toBe(false)
  })

  it("has every corner drawn in towards the middle", () => {
    const meshes = cube()
    const { inward } = shellOf(meshes)
    meshes.forEach(({ position }, m) => {
      for (let i = 0; i < position.length; i += 3) {
        const at = [position[i], position[i + 1], position[i + 2]]
        const way = [...inward[m].slice(i, i + 3)]
        // a corner of a cube is drawn in along the line from it to the middle
        at.forEach((value, axis) =>
          expect(way[axis]).toBeCloseTo(-value / Math.sqrt(3), 5)
        )
      }
    })
  })
})
