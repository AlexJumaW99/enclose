import * as THREE from "three"
import { describe, expect, it } from "vitest"

import { piecesOf, pieceWith, waysOut, wholeOf } from "./apart"

/** A part in a group, in a box from one corner to the other. */
const part = (
  group: string,
  low: [number, number, number],
  high: [number, number, number]
) => ({
  group,
  box: new THREE.Box3(new THREE.Vector3(...low), new THREE.Vector3(...high)),
})
const GROUPS = [
  { id: "case", shell: true },
  { id: "board", shell: false },
  { id: "screws", shell: false },
  { id: "parts", shell: false },
]
/** How many pieces there are, and which parts share one. */
const same = (pieces: number[], a: number, b: number) => pieces[a] === pieces[b]

describe("piecesOf", () => {
  // a board with a chip on it and a pin through it; a lid and a base that meet; two
  // screws far apart
  const model = [
    part("board", [0, 0, 0], [50, 30, 1.6]),
    part("board", [10, 10, 1.6], [15, 15, 3]),
    part("board", [40, 5, -3], [41, 6, 2]),
    part("case", [-5, -5, -5], [55, 35, 0]),
    part("case", [-5, -5, 0], [55, 35, 10]),
    part("screws", [-4, -4, 0], [-2, -2, 8]),
    part("screws", [52, 32, 0], [54, 34, 8]),
  ]

  it("keeps the parts of a group that touch one another together", () => {
    const pieces = piecesOf(model, GROUPS, 100)
    expect(same(pieces, 0, 1)).toBe(true)
    expect(same(pieces, 0, 2)).toBe(true)
  })

  it("lets the parts of a group that do not touch go their own ways", () => {
    const pieces = piecesOf(model, GROUPS, 100)
    expect(same(pieces, 5, 6)).toBe(false)
  })

  it("takes the outside apart part by part, though its parts meet", () => {
    const pieces = piecesOf(model, GROUPS, 100)
    expect(same(pieces, 3, 4)).toBe(false)
  })

  it("never puts parts of different groups together", () => {
    const pieces = piecesOf(model, GROUPS, 100)
    // the screws are in among the case and by the board
    expect(new Set(pieces).size).toBe(5)
  })

  it("follows a chain: what touches something that touches a third goes with both", () => {
    const pieces = piecesOf(
      [
        part("board", [0, 0, 0], [10, 10, 1]),
        part("board", [20, 0, 0], [30, 10, 1]),
        part("board", [10, 0, 0], [20, 10, 1]),
        part("screws", [0, 0, 5], [1, 1, 6]),
      ],
      GROUPS,
      40
    )
    expect(same(pieces, 0, 1)).toBe(true)
    expect(same(pieces, 0, 2)).toBe(true)
  })

  it("counts as touching what is drawn a hair apart, and further in a large model", () => {
    const pair = (gap: number) => [
      part("board", [0, 0, 0], [10, 10, 1]),
      part("board", [0, 0, 1 + gap], [10, 10, 2 + gap]),
      part("screws", [0, 0, 5], [1, 1, 6]),
    ]
    expect(same(piecesOf(pair(0.2), GROUPS, 20), 0, 1)).toBe(true)
    expect(same(piecesOf(pair(1), GROUPS, 20), 0, 1)).toBe(false)
    expect(same(piecesOf(pair(1), GROUPS, 1000), 0, 1)).toBe(true)
  })

  it("takes a model that is all one group, or in no group, apart part by part", () => {
    const stacked = (group: string) => [
      part(group, [0, 0, 0], [10, 10, 1]),
      part(group, [0, 0, 1], [10, 10, 2]),
    ]
    expect(piecesOf(stacked("board"), GROUPS, 20)).toEqual([0, 1])
    const mixed = [...stacked("parts"), part("board", [0, 0, 2], [10, 10, 3])]
    expect(new Set(piecesOf(mixed, GROUPS, 20)).size).toBe(3)
  })
})

describe("wholeOf", () => {
  // a board with two chips on it, a lid and a screw
  const parts = [
    { id: "lid", piece: 0 },
    { id: "board", piece: 1 },
    { id: "chip", piece: 1 },
    { id: "screw", piece: 3 },
    { id: "socket", piece: 1 },
  ]

  it("takes the rest of a piece with any part of it", () => {
    expect(wholeOf(parts, ["chip"])).toEqual(["board", "chip", "socket"])
  })

  it("takes a part that is a piece of its own alone", () => {
    expect(wholeOf(parts, ["lid"])).toEqual(["lid"])
    expect(wholeOf(parts, [])).toEqual([])
  })

  it("gives them in the model's order, each once, whatever order they were asked for in", () => {
    expect(wholeOf(parts, ["screw", "socket", "chip", "lid"])).toEqual([
      "lid",
      "board",
      "chip",
      "screw",
      "socket",
    ])
  })

  it("leaves out what is no part of the model", () => {
    expect(wholeOf(parts, ["gone", "screw"])).toEqual(["screw"])
  })
})

describe("pieceWith", () => {
  const GROUPS = [
    { id: "case", label: "Case" },
    { id: "board", label: "Main board" },
    { id: "buttons", label: "Buttons" },
  ]
  const part = (id: string, group: string, piece: number, across = 1) => ({
    id,
    label: id.replaceAll("_", " "),
    group,
    piece,
    across,
  })
  // a lid; a board with a chip and a socket on it, which is all of its group; and two
  // buttons, each a cap on a switch, which are one group between them
  const parts = [
    part("lid", "case", 0, 90),
    part("pcb", "board", 1, 60),
    part("chip", "board", 1, 8),
    part("socket", "board", 1, 12),
    part("power_cap", "buttons", 4, 9),
    part("power_switch", "buttons", 4, 14),
    part("record_cap", "buttons", 6, 20),
    part("record_switch", "buttons", 6, 14),
  ]

  it("is nothing for a part that is a piece by itself, or no part at all", () => {
    expect(pieceWith(parts, GROUPS, "lid")).toBeNull()
    expect(pieceWith(parts, GROUPS, "gone")).toBeNull()
  })

  it("goes by its group's name when it is the whole of the group", () => {
    expect(pieceWith(parts, GROUPS, "chip")).toEqual({
      label: "Main board",
      parts: ["pcb", "chip", "socket"],
    })
  })

  it("goes by its widest part, and how many more, when it is only some of the group", () => {
    expect(pieceWith(parts, GROUPS, "power_cap")).toEqual({
      label: "power switch and 1 more",
      parts: ["power_cap", "power_switch"],
    })
    expect(pieceWith(parts, GROUPS, "record_switch")?.label).toBe(
      "record cap and 1 more"
    )
  })

  it("goes by its widest part where the model does not say what its group is called", () => {
    expect(pieceWith(parts, [], "socket")?.label).toBe("pcb and 2 more")
  })
})

describe("waysOut", () => {
  /** A piece in a box from one corner to the other, its stuff about the middle of that. */
  const piece = (
    low: [number, number, number],
    high: [number, number, number],
    /** where its stuff is, if that is not the middle of its box */
    centre?: [number, number, number]
  ) => {
    const box = new THREE.Box3(
      new THREE.Vector3(...low),
      new THREE.Vector3(...high)
    )
    return {
      box,
      centre: centre
        ? new THREE.Vector3(...centre)
        : box.getCenter(new THREE.Vector3()),
    }
  }
  type Piece = ReturnType<typeof piece>
  const MIDDLE = new THREE.Vector3(0, 0, 0)
  /** The pieces' boxes, where they are once the model is pulled this far apart. */
  const pulled = (pieces: Piece[], ways: THREE.Vector3[], far = 1) =>
    pieces.map(({ box }, index) =>
      box.clone().translate(ways[index].clone().multiplyScalar(far))
    )
  const anyInAnother = (boxes: THREE.Box3[]) =>
    boxes.some((a, i) => boxes.some((b, j) => j > i && a.intersectsBox(b)))

  it("sends pieces that are clear of one another straight out from the middle", () => {
    const pieces = [
      piece([10, 0, 0], [20, 10, 10]),
      piece([-20, 0, 0], [-10, 10, 10]),
    ]
    const ways = waysOut(pieces, MIDDLE, 50)
    expect(ways[0].toArray()).toEqual([15, 5, 5])
    expect(ways[1].toArray()).toEqual([-15, 5, 5])
  })

  it("lifts what lies on something clear of it, and lowers what it lay on", () => {
    const base = piece([-50, -30, -10], [50, 30, 2])
    const board = piece([-40, -20, -2], [40, 20, 0])
    const pieces = [base, board]
    const ways = waysOut(pieces, MIDDLE, 120)
    // only up and down: that is the short way out
    expect(ways[1].x).toBe(0)
    expect(ways[1].y).toBe(0)
    const [low, high] = pulled(pieces, ways)
    expect(high.min.z - low.max.z).toBeCloseTo(120 * 0.03, 6)
    // the one nearer the middle is the one that stays nearer it
    expect(Math.abs(ways[1].z)).toBeLessThan(Math.abs(ways[0].z))
  })

  it("takes a board up out of the shell it lies in, not down through its floor", () => {
    // the shell is a floor with walls: its stuff is low in its box, under the board,
    // though the middle of the box is over it
    const shell = piece([-50, -30, -10], [50, 30, 0], [0, 0, -8.5])
    const board = piece([-40, -20, -8], [40, 20, -6])
    const pieces = [shell, board]
    const ways = waysOut(pieces, MIDDLE, 120)
    const [under, over] = pulled(pieces, ways)
    expect(over.min.z).toBeGreaterThan(under.max.z)
  })

  it("leaves no piece in another, however many are laid one on the next", () => {
    const pieces = [
      piece([-50, -30, -10], [50, 30, 0], [0, 0, -9]),
      piece([-45, -25, -8], [45, 25, -6]),
      piece([-30, -20, -6], [30, 20, 3]),
      piece([-50, -30, 0], [50, 30, 10], [0, 0, 9]),
      // a screw down through all of them, near a corner
      piece([40, 20, -10], [43, 23, 10]),
    ]
    const ways = waysOut(pieces, MIDDLE, 125)
    expect(anyInAnother(pulled(pieces, ways))).toBe(false)
    // and they are in the order they were, from the bottom up
    const heights = pulled(pieces, ways)
      .slice(0, 4)
      .map((box) => box.min.z)
    expect(heights).toEqual([...heights].sort((a, b) => a - b))
  })

  it("moves a piece out sideways where that is the short way", () => {
    // a cap on the end of a long body, and a button that comes through it
    const body = piece([-50, -10, -10], [50, 10, 10])
    const cap = piece([50, -12, -12], [54, 12, 12])
    const button = piece([46, -2, -2], [56, 2, 2])
    const pieces = [body, cap, button]
    const ways = waysOut(pieces, MIDDLE, 110)
    expect(anyInAnother(pulled(pieces, ways))).toBe(false)
    expect(ways[1].z).toBe(0)
    expect(ways[2].z).toBe(0)
  })

  it("only parts them further when the model is pulled further apart", () => {
    const pieces = [
      piece([-50, -30, -10], [50, 30, 2], [0, 0, -8]),
      piece([-40, -20, -2], [40, 20, 0]),
      piece([-10, -10, -1], [10, 10, 6]),
    ]
    const ways = waysOut(pieces, MIDDLE, 120)
    for (const far of [1, 1.5, 2.5, 4])
      expect(anyInAnother(pulled(pieces, ways, far))).toBe(false)
  })
})
