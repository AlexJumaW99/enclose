import { describe, expect, it } from "vitest"

import { asideFor, carried } from "./versions"

const turned = (from: string | null, to: string, restored: boolean) => ({
  from,
  to,
  restored,
})

describe("carried", () => {
  it("puts aside what a project had for the conversation that is left, and keeps it for one that begins there", () => {
    const all = { p1: { lid: "red" }, p2: { base: "blue" } }
    expect(carried(all, "p1", turned("a", "b", false), false)).toEqual({
      p1: { lid: "red" },
      [asideFor("p1", "a")]: { lid: "red" },
      p2: { base: "blue" },
    })
  })

  it("has back what was put aside for the conversation turned to", () => {
    const all = {
      p1: { lid: "red" },
      [asideFor("p1", "b")]: { lid: "green" },
    }
    expect(carried(all, "p1", turned("a", "b", true), true)).toEqual({
      p1: { lid: "green" },
      [asideFor("p1", "a")]: { lid: "red" },
      [asideFor("p1", "b")]: { lid: "green" },
    })
  })

  it("has nothing back where that conversation had nothing", () => {
    const all = { p1: { lid: "red" } }
    expect(carried(all, "p1", turned("a", "b", true), true)).toEqual({
      [asideFor("p1", "a")]: { lid: "red" },
    })
  })

  it("keeps what a project has where nothing was put aside for the conversation turned to", () => {
    const all = { p1: { lid: "red" } }
    expect(carried(all, "p1", turned("a", "b", true), false)).toEqual({
      p1: { lid: "red" },
      [asideFor("p1", "a")]: { lid: "red" },
    })
  })

  it("puts aside that much for a project that had nothing, where it is to be known that anything was", () => {
    expect(carried({}, "p1", turned("a", "b", false), false, {})).toEqual({
      [asideFor("p1", "a")]: {},
    })
    expect(carried({}, "p1", turned("a", "b", false), false)).toEqual({})
  })

  it("puts nothing aside for a folder that was nobody's", () => {
    const all: Record<string, Record<string, string>> = { p1: { lid: "red" } }
    expect(carried(all, "p1", turned(null, "a", false), false, {})).toEqual(all)
  })
})
