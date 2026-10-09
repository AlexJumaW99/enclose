import { describe, expect, it } from "vitest"

import { sharpOf, thingsOf } from "./things"

/** The six sides of a box, each a face of its own with four corners, as a CAD file has them. */
function box(at: [number, number, number], side = 10) {
  const [x, y, z] = at
  const corner = (dx: number, dy: number, dz: number) => [
    x + dx * side,
    y + dy * side,
    z + dz * side,
  ]
  return [
    [corner(0, 0, 0), corner(1, 0, 0), corner(1, 1, 0), corner(0, 1, 0)],
    [corner(0, 0, 1), corner(1, 0, 1), corner(1, 1, 1), corner(0, 1, 1)],
    [corner(0, 0, 0), corner(1, 0, 0), corner(1, 0, 1), corner(0, 0, 1)],
    [corner(0, 1, 0), corner(1, 1, 0), corner(1, 1, 1), corner(0, 1, 1)],
    [corner(0, 0, 0), corner(0, 1, 0), corner(0, 1, 1), corner(0, 0, 1)],
    [corner(1, 0, 0), corner(1, 1, 0), corner(1, 1, 1), corner(1, 0, 1)],
  ].map((face) => face.flat())
}

describe("thingsOf", () => {
  it("takes the faces of a box for one thing", () => {
    expect(thingsOf(box([0, 0, 0]))).toEqual([0, 0, 0, 0, 0, 0])
  })

  it("tells two boxes that stand apart from each other", () => {
    expect(thingsOf([...box([0, 0, 0]), ...box([50, 0, 0])])).toEqual([
      0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
    ])
  })

  it("joins faces that meet only by way of others, in whatever order they come", () => {
    const [bottom, top, ...sides] = box([0, 0, 0])
    // the top and the bottom share no corner: a side between them joins the two
    expect(thingsOf([bottom, top])).toEqual([0, 1])
    expect(thingsOf([bottom, top, sides[0]])).toEqual([0, 0, 0])
  })

  it("takes corners a hair apart for one corner", () => {
    const [bottom, , front] = box([0, 0, 0])
    const nudged = front.map((along) => along + 0.001)
    expect(thingsOf([bottom, nudged])).toEqual([0, 0])
  })

  it("is nothing for no faces", () => {
    expect(thingsOf([])).toEqual([])
  })
})

describe("sharpOf", () => {
  /** A face with all of its corners facing one way. */
  const flat = (corners: number[], way: [number, number, number]) => ({
    corners,
    facing: corners.map((_, i) => way[i % 3]),
  })
  const [bottom, top, front] = box([0, 0, 0])

  it("finds the edges of a box sharp", () => {
    const faces = [flat(bottom, [0, 0, -1]), flat(front, [0, -1, 0])]
    expect([...sharpOf(faces, [0, 0])]).toEqual([0])
  })

  it("finds none on a surface whose faces agree where they meet", () => {
    // two faces of something round: at the corners they share, they face the same way
    const round = (corners: number[]) => ({
      corners,
      facing: corners.map((along, i) => (i % 3 === 2 ? 1 : along / 100)),
    })
    expect(sharpOf([round(bottom), round(front)], [0, 0]).size).toBe(0)
  })

  it("takes two things that touch for no edge of either", () => {
    const faces = [flat(bottom, [0, 0, -1]), flat(front, [0, -1, 0])]
    expect(sharpOf(faces, [0, 1]).size).toBe(0)
  })

  it("says which of several things the sharp ones are", () => {
    const faces = [
      flat(top, [0, 0, 1]),
      flat(bottom, [0, 0, -1]),
      flat(front, [0, -1, 0]),
    ]
    // the top is a thing by itself: the bottom and the front meet at an edge
    expect([...sharpOf(faces, [0, 1, 1])]).toEqual([1])
  })
})
