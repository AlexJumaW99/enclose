import { describe, expect, it } from "vitest"

import { cutsOf, readCuts } from "./cuts"

const cut = {
  position: [1, 2, 3],
  turn: [0, 0, 0, 1],
  flipped: true,
}

describe("readCuts", () => {
  it("reads back what was kept", () => {
    expect(readCuts(JSON.stringify({ a: cut }))).toEqual({ a: cut })
  })

  it("has none where none was kept, or where what was kept cannot be read", () => {
    expect(readCuts(null)).toEqual({})
    expect(readCuts("not json")).toEqual({})
    expect(readCuts("[1, 2]")).toEqual({})
    expect(readCuts("null")).toEqual({})
  })

  it("drops a cut that does not read as one, and keeps the rest", () => {
    const kept = {
      whole: cut,
      short: { ...cut, position: [1, 2] },
      unturned: { ...cut, turn: null },
      neither: { ...cut, flipped: "yes" },
      odd: { ...cut, position: [1, "2", 3] },
      nothing: null,
    }
    expect(readCuts(JSON.stringify(kept))).toEqual({ whole: cut })
  })

  it("keeps nothing but the cut itself", () => {
    expect(readCuts(JSON.stringify({ a: { ...cut, extra: 1 } }))).toEqual({
      a: cut,
    })
  })
})

describe("cutsOf", () => {
  const cuts = readCuts(JSON.stringify({ a: cut, b: cut }))

  it("lets go of the cut of a project that is gone", () => {
    expect(cutsOf(cuts, [{ id: "b" }, { id: "c" }])).toEqual({ b: cut })
  })

  it("is the same cuts while every project is still there", () => {
    expect(cutsOf(cuts, [{ id: "a" }, { id: "b" }])).toBe(cuts)
  })
})
