import { describe, expect, it } from "vitest"

import { contoursOf } from "@/components/viewport/contours"
import { drawnNow, type Body, type Looking, type Stroke } from "./lines"

const HERE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const NO_CONTOURS = { ends: [], ways: [] }

/** From the front: the eye at -Y, x to the right and z up. */
const FRONT: Looking = { right: [1, 0, 0], up: [0, 0, 1], back: [0, -1, 0] }
/** From behind: the eye at +Y, so that the model's right is to the left. */
const BACK: Looking = { right: [-1, 0, 0], up: [0, 0, 1], back: [0, 1, 0] }
/** From above: x to the right, and the model's back at the top. */
const TOP: Looking = { right: [1, 0, 0], up: [0, 1, 0], back: [0, 0, 1] }
/** From a corner: the three faces that meet at +x -y +z all in sight. */
const CORNER: Looking = (() => {
  const s = Math.SQRT1_2
  const t = 1 / Math.sqrt(3)
  const u = 1 / Math.sqrt(6)
  return { right: [s, s, 0], up: [-u, u, 2 * u], back: [t, -t, t] }
})()

/** A box, from one corner to the opposite one, with its twelve edges. */
function box(low: number[], high: number[]): Body {
  const at = (i: number) => [
    i & 1 ? high[0] : low[0],
    i & 2 ? high[1] : low[1],
    i & 4 ? high[2] : low[2],
  ]
  const position = Array.from({ length: 8 }, (_, i) => at(i)).flat()
  // each face as two triangles, facing out
  const index = [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
  ].flatMap(([a, b, c, d]) => [a, b, c, a, c, d])
  const edges: number[] = []
  for (let i = 0; i < 8; i++)
    for (const bit of [1, 2, 4])
      if (!(i & bit)) edges.push(...at(i), ...at(i | bit))
  return {
    skins: [{ position, index }],
    edges,
    contours: NO_CONTOURS,
    place: HERE,
  }
}

/** The corners a closed stroke goes round, sorted, to a hundredth. */
const corners = (stroke: Stroke) => {
  const points: string[] = []
  for (let i = 0; i < stroke.points.length; i += 2)
    points.push(
      `${(stroke.points[i] + 0).toFixed(2)},${(stroke.points[i + 1] + 0).toFixed(2)}`
    )
  return points.sort()
}

/** How long a stroke is. */
const lengthOf = (stroke: Stroke) => {
  const { points, closed } = stroke
  let length = 0
  const many = points.length / 2
  for (let i = 0; i < (closed ? many : many - 1); i++) {
    const j = (i + 1) % many
    length += Math.hypot(
      points[j * 2] - points[i * 2],
      points[j * 2 + 1] - points[i * 2 + 1]
    )
  }
  return length
}
const total = (strokes: Stroke[]) =>
  strokes.reduce((sum, stroke) => sum + lengthOf(stroke), 0)

describe("drawn", () => {
  it("draws a box seen square on as the one rectangle", () => {
    const [strokes] = drawnNow([box([0, 0, 0], [30, 20, 10])], FRONT)
    expect(strokes).toHaveLength(1)
    expect(strokes[0].closed).toBe(true)
    // the far face is behind the near one, and the edges between them are seen end on
    expect(corners(strokes[0])).toEqual(
      ["0.00,0.00", "0.00,10.00", "30.00,0.00", "30.00,10.00"].sort()
    )
  })

  it("leaves out the three edges at the far corner of a box seen from a corner", () => {
    const [strokes] = drawnNow([box([0, 0, 0], [10, 10, 10])], CORNER)
    // nine edges show, each as long in the picture as the next
    expect(total(strokes)).toBeCloseTo(9 * 10 * Math.sqrt(2 / 3), 6)
    // three run out from the near corner, and three go round the outside between them
    expect(strokes).toHaveLength(6)
    expect(strokes.every((stroke) => !stroke.closed)).toBe(true)
  })

  it("draws nothing of a part that is behind another", () => {
    const [front, behind] = drawnNow(
      [box([0, 0, 0], [30, 5, 30]), box([10, 10, 10], [20, 15, 20])],
      FRONT
    )
    expect(front).toHaveLength(1)
    expect(behind).toHaveLength(0)
  })

  it("stops a line where it goes behind something", () => {
    const [, behind] = drawnNow(
      [box([0, 0, 0], [30, 5, 30]), box([20, 10, 10], [50, 15, 20])],
      FRONT
    )
    // what sticks out to the right of the nearer box: three sides of it, in one go
    expect(behind).toHaveLength(1)
    expect(behind[0].closed).toBe(false)
    expect(corners(behind[0])).toEqual(
      ["30.00,10.00", "50.00,10.00", "50.00,20.00", "30.00,20.00"].sort()
    )
  })

  it("draws a line two parts share once", () => {
    const [one, other] = drawnNow(
      [box([0, 0, 0], [10, 10, 10]), box([10, 0, 0], [20, 10, 10])],
      FRONT
    )
    expect(one).toHaveLength(1)
    expect(one[0].closed).toBe(true)
    // the second box's side along the first is the first's
    expect(other).toHaveLength(1)
    expect(other[0].closed).toBe(false)
    expect(total(other)).toBeCloseTo(30, 6)
  })

  it("draws a part where it is put", () => {
    const body = box([0, 0, 0], [10, 10, 10])
    const moved = { ...body, place: [...HERE.slice(0, 12), 100, 0, 50, 1] }
    const [strokes] = drawnNow([moved], FRONT)
    expect(corners(strokes[0])).toEqual(
      ["100.00,50.00", "110.00,50.00", "110.00,60.00", "100.00,60.00"].sort()
    )
  })

  it("draws what is under a part seen from above where it is not covered", () => {
    // a plate, and on it a smaller block: from above, the block's outline inside the plate's
    const [plate, block] = drawnNow(
      [box([0, 0, 0], [40, 40, 2]), box([10, 10, 2], [20, 20, 12])],
      TOP
    )
    expect(plate).toHaveLength(1)
    expect(total(plate)).toBeCloseTo(160, 6)
    expect(block).toHaveLength(1)
    expect(block[0].closed).toBe(true)
    expect(total(block)).toBeCloseTo(40, 6)
  })
})

describe("a round part", () => {
  /** A rod standing up, as many flat sides, with the edges of its two ends. */
  function rod(
    radius: number,
    height: number,
    sides: number,
    turned = 0
  ): Body {
    const position: number[] = []
    const ring = (z: number) =>
      Array.from({ length: sides }, (_, i) => {
        const angle = ((i + turned) / sides) * Math.PI * 2
        return [radius * Math.cos(angle), radius * Math.sin(angle), z]
      })
    const foot = ring(0)
    const head = ring(height)
    position.push(...foot.flat(), ...head.flat(), 0, 0, 0, 0, 0, height)
    const index: number[] = []
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides
      index.push(i, j, sides + j, i, sides + j, sides + i)
      index.push(2 * sides, j, i, 2 * sides + 1, sides + i, sides + j)
    }
    const edges: number[] = []
    for (const round of [foot, head])
      for (let i = 0; i < sides; i++)
        edges.push(...round[i], ...round[(i + 1) % sides])
    // its side is one face that goes round: its ends are faces of their own
    const side = (triangle: number) => triangle % 4 < 2
    const contours = contoursOf(
      position,
      index,
      (triangle, other) => side(triangle) && side(other)
    )
    return { skins: [{ position, index }], edges, contours, place: HERE }
  }

  it("is drawn from the side with the outline its side has from there", () => {
    const [strokes] = drawnNow([rod(10, 30, 16)], FRONT)
    expect(strokes).toHaveLength(1)
    expect(strokes[0].closed).toBe(true)
    expect(corners(strokes[0])).toEqual(
      ["-10.00,0.00", "-10.00,30.00", "10.00,0.00", "10.00,30.00"].sort()
    )
  })

  it("has an outline where one of its flat sides is seen dead edge on", () => {
    // turned half a side round, the rod has a side square to the eye at each edge of
    // the picture: both of that side's edges are where the rod ends, the one behind
    // the other, and it is the nearer that shows
    const flat = 10 * Math.cos(Math.PI / 16)
    const at = (x: number) => x.toFixed(2)
    for (const looking of [FRONT, BACK]) {
      const [strokes] = drawnNow([rod(10, 30, 16, 0.5)], looking)
      expect(strokes).toHaveLength(1)
      expect(strokes[0].closed).toBe(true)
      expect(corners(strokes[0])).toEqual(
        [
          `${at(-flat)},0.00`,
          `${at(-flat)},30.00`,
          `${at(flat)},0.00`,
          `${at(flat)},30.00`,
        ].sort()
      )
    }
  })

  it("is drawn from the end as the one circle", () => {
    const [strokes] = drawnNow([rod(10, 30, 16)], TOP)
    expect(strokes).toHaveLength(1)
    expect(strokes[0].closed).toBe(true)
    expect(strokes[0].points).toHaveLength(32)
  })
})
