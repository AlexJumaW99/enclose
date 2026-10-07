import { describe, expect, it } from "vitest"

import {
  choreograph,
  ends,
  letter,
  LOOP,
  REST,
  rests,
  viewAt,
  type Move,
} from "./mark"

describe("ends", () => {
  it("puts each end of an axis exactly opposite its other", () => {
    const seen = ends({ azimuth: 20, elevation: 50 })
    expect(seen).toHaveLength(6)
    for (const axis of ["x", "y", "z"] as const) {
      const [a, b] = seen.filter((end) => end.axis === axis)
      expect(a.x).toBeCloseTo(-b.x, 9)
      expect(a.y).toBeCloseTo(-b.y, 9)
      expect(a.depth).toBeCloseTo(-b.depth, 9)
    }
  })

  it("lists the furthest first, so the nearer are drawn over them", () => {
    const depths = ends(REST).map((end) => end.depth)
    expect(depths).toEqual([...depths].sort((a, b) => a - b))
  })

  it("sets the six evenly round the middle where the mark rests", () => {
    const reach = ends(REST).map((end) => Math.hypot(end.x, end.y))
    for (const far of reach) expect(far).toBeCloseTo(reach[0], 3)
  })
})

describe("letter", () => {
  it("draws X and Y in two strokes and Z in one", () => {
    const strokes = (axis: "x" | "y" | "z") =>
      letter(axis, 0, 0, 10, 1, 2).split("M").length - 1
    expect(strokes("x")).toBe(2)
    expect(strokes("y")).toBe(2)
    expect(strokes("z")).toBe(1)
  })

  it("leaves out an upright that comes to no length", () => {
    // with no rise, a diagonal starts at the corner itself
    expect(letter("x", 0, 0, 10, 1, 0).split("L").length - 1).toBe(2)
  })
})

describe("choreograph", () => {
  const home = (moves: Move[]) => ({
    spin: moves.reduce((sum, move) => sum + move.spin, 0),
    tilted: moves.filter((move) => move.tilt).length % 2 === 1,
  })

  it("ends where it began, whatever the seed", () => {
    for (let seed = 0; seed < 40; seed++) {
      const moves = choreograph(seed, 3 + (seed % 6))
      expect(moves).toHaveLength(3 + (seed % 6))
      expect(Math.abs(home(moves).spin % 4)).toBe(0)
      expect(home(moves).tilted).toBe(false)
    }
  })

  it("never goes straight back the way it came", () => {
    const moves = choreograph(LOOP.seed, LOOP.moves)
    moves.slice(1).forEach((move, index) => {
      const last = moves[index]
      expect(move.spin === -last.spin && move.tilt === last.tilt).toBe(false)
    })
  })

  it("gives the same moves for the same seed", () => {
    expect(choreograph(7, 5)).toEqual(choreograph(7, 5))
  })
})

describe("viewAt", () => {
  const views = rests(REST, choreograph(LOOP.seed, LOOP.moves))
  const beat = LOOP.turn + LOOP.hold

  it("starts at rest and is at each rest in turn", () => {
    expect(viewAt(views, 0, LOOP.turn, LOOP.hold)).toEqual(views[0])
    // through with the first move, and holding
    const held = viewAt(views, LOOP.turn + LOOP.hold / 2, LOOP.turn, LOOP.hold)
    expect(held.azimuth).toBeCloseTo(views[1].azimuth, 9)
    expect(held.elevation).toBeCloseTo(views[1].elevation, 9)
  })

  it("comes round to the start again, seen from the same side", () => {
    const last = views[views.length - 1]
    expect(Math.abs((last.azimuth - views[0].azimuth) % 360)).toBe(0)
    expect(last.elevation).toBe(views[0].elevation)
    expect(viewAt(views, LOOP.moves * beat, LOOP.turn, LOOP.hold)).toEqual(
      views[0]
    )
  })
})
