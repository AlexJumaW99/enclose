import { describe, expect, it } from "vitest"

import {
  back,
  coloured,
  forth,
  later,
  NO_HISTORY,
  record,
  recolour,
  saidOf,
  type Colours,
} from "./undo"

const given: Colours = { lid: "red", base: "blue" }

describe("recolour", () => {
  it("says what the parts had, and what they are given", () => {
    expect(recolour(given, ["lid", "screw"], "green", 5)).toEqual({
      at: 5,
      undoneAt: null,
      before: { lid: "red", screw: null },
      after: { lid: "green", screw: "green" },
    })
  })

  it("takes no account of a part that has the colour already", () => {
    expect(recolour(given, ["lid", "base"], "red", 5)).toMatchObject({
      before: { base: "blue" },
      after: { base: "red" },
    })
  })

  it("is nothing where nothing changes", () => {
    expect(recolour(given, ["lid"], "red", 5)).toBeNull()
    expect(recolour(given, ["screw"], null, 5)).toBeNull()
    expect(recolour(given, [], "red", 5)).toBeNull()
  })

  it("gives a part the model's own colour back", () => {
    expect(recolour(given, ["lid"], null, 5)).toMatchObject({
      before: { lid: "red" },
      after: { lid: null },
    })
  })
})

describe("coloured", () => {
  it("puts parts to what a change says, and leaves the rest", () => {
    expect(coloured(given, { lid: "green", screw: "pink" })).toEqual({
      lid: "green",
      base: "blue",
      screw: "pink",
    })
  })

  it("takes a colour away from a part that is to have the model's own", () => {
    expect(coloured(given, { lid: null })).toEqual({ base: "blue" })
  })
})

describe("the history of what was done by hand", () => {
  const first = recolour(given, ["lid"], "green", 1)!
  const second = recolour(given, ["base"], null, 2)!

  it("takes back the latest first, and puts back in the order it was done", () => {
    const history = record(record(NO_HISTORY, first), second)
    const one = back(history, 10)!
    expect(one.change).toBe(second)
    const two = back(one.history, 11)!
    expect(two.change).toBe(first)
    expect(back(two.history, 12)).toBeNull()
    expect(two.history.undone.map((change) => change.undoneAt)).toEqual([
      10, 11,
    ])

    const again = forth(two.history)!
    expect(again.change).toMatchObject({ at: 1 })
    expect(again.history.done.at(-1)?.undoneAt).toBeNull()
    expect(forth(forth(again.history)!.history)).toBeNull()
  })

  it("lets go of what was taken back once something else is done", () => {
    const { history } = back(record(NO_HISTORY, first), 10)!
    expect(record(history, second)).toEqual({ done: [second], undone: [] })
  })

  it("has nothing to take back or put back to begin with", () => {
    expect(back(NO_HISTORY, 1)).toBeNull()
    expect(forth(NO_HISTORY)).toBeNull()
  })
})

describe("later", () => {
  it("is whichever was done last", () => {
    expect(later(5, 3)).toBe("mine")
    expect(later(3, 5)).toBe("claudes")
  })

  it("is the one there is, where there is only one", () => {
    expect(later(5, null)).toBe("mine")
    expect(later(null, 5)).toBe("claudes")
    expect(later(null, null)).toBeNull()
  })
})

describe("saidOf", () => {
  it("says what was taken back, and what was put back", () => {
    expect(saidOf("undo", { ok: true, what: "Make it taller" })).toBe(
      "Undid: Make it taller"
    )
    expect(saidOf("redo", { ok: true, what: "Make it taller" })).toBe(
      "Redid: Make it taller"
    )
  })

  it("says why not, where it could not be", () => {
    expect(saidOf("undo", { ok: false, why: "busy", files: [] })).toBe(
      "Claude is at work: nothing can be undone until it is through"
    )
    expect(
      saidOf("undo", { ok: false, why: "changed", files: ["model.py"] })
    ).toBe("Not undone: model.py changed since")
    expect(
      saidOf("redo", {
        ok: false,
        why: "changed",
        files: ["model.py", "a.glb", "b.glb"],
      })
    ).toBe("Not redone: model.py and 2 more changed since")
  })

  it("says nothing where there was nothing to do", () => {
    expect(saidOf("undo", { ok: false, why: "nothing", files: [] })).toBeNull()
  })
})
