import { beforeEach, describe, expect, it, vi } from "vitest"

// The store is the window's: it keeps things in the window's storage, and tells the
// app's own process what of the view is used. Both are stood in for here, before the
// store is read, since it reads what was kept as it is made.
const { kept, used, sent } = vi.hoisted(() => {
  const kept = new Map<string, string>()
  const used: string[] = []
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  })
  vi.stubGlobal("location", { hash: "" })
  const sent: unknown[][] = []
  vi.stubGlobal("window", {
    cad: {
      analytics: { used: (name: string) => void used.push(name) },
      thread: {
        send: async (...given: unknown[]) => {
          sent.push(given)
          return "conversation"
        },
      },
    },
  })
  return { kept, used, sent }
})

import type { Vec3 } from "@shared/api"
import { useStore, type Section } from "./store"

const fresh = useStore.getState()
const state = () => useStore.getState()
const view = () => state().view

/** A cut across the model, a little way up it. */
const cut: Section = {
  position: [0, 0, 12],
  turn: [0, 0, 0, 1],
  flipped: false,
}

beforeEach(() => {
  useStore.setState(fresh, true)
  kept.clear()
  used.length = 0
  sent.length = 0
  state().activate("clock")
})

describe("what the view is put into", () => {
  it("is kept in the order it was gone into, and counted once as it is", () => {
    state().setView({ section: cut })
    state().setView({ only: { kind: "part", id: "lid" } })
    state().setView({ hidden: ["base"] })
    expect(state().entered).toEqual(["section", "only", "hidden"])
    // changed while it is on, it is not gone into again
    state().setView({ section: { ...cut, flipped: true } })
    expect(state().entered).toEqual(["section", "only", "hidden"])
    expect(used).toEqual(["section", "only", "hidden"])
    // and got out of, it is no longer among them
    state().setView({ only: null })
    expect(state().entered).toEqual(["section", "hidden"])
  })

  it("has the blueprint and the guides take the view's place by turns", () => {
    state().setView({ blueprint: true })
    expect(view()).toMatchObject({ blueprint: true, assembly: false })
    state().setView({ assembly: true })
    expect(view()).toMatchObject({ blueprint: false, assembly: true })
    state().setView({ blueprint: true })
    expect(view()).toMatchObject({ blueprint: true, assembly: false })
    expect(state().entered).toEqual(["blueprint"])
  })

  it("shows a sheet by itself only while it is the blueprint that is looked at", () => {
    state().setPartsOpen(true)
    state().setView({ blueprint: true, sheet: 2 })
    expect(view().sheet).toBe(2)
    // (it has the view clear: the list of parts is put away)
    expect(state().partsOpen).toBe(false)
    state().setView({ assembly: true })
    expect(view().sheet).toBeNull()
  })

  it("lets go of what was picked out for a blueprint, and keeps it for the guides", () => {
    const lid = {
      id: "lid",
      label: "Lid",
      point: [0, 0, 20] as Vec3,
      normal: [0, 0, 1] as Vec3,
      face: 3,
    }
    state().select({ part: lid, at: null })
    state().setView({ assembly: true })
    expect(state().selection?.part).toEqual(lid)
    state().setView({ blueprint: true })
    expect(state().selection).toBeNull()
  })

  it("puts the lists away, and what was being looked for, for the guides", () => {
    state().setPartsOpen(true)
    state().find("leg")
    state().setView({ assembly: true })
    expect(state()).toMatchObject({ partsOpen: false, finding: null })
  })

  it("keeps how the view was left for the next time: its grid, and the cut of each project", () => {
    state().setView({ grid: true })
    state().setView({ section: cut })
    state().setView({ section: null })
    expect(kept.get("enclose:grid")).toBe("on")
    // cut open again, it is as it was left, and not as it would be made afresh
    state().cutOpen(() => ({ ...cut, position: [0, 0, 0] }))
    expect(view().section).toEqual(cut)
    // and another project's model, never cut, is cut afresh
    state().activate("stool")
    state().cutOpen(() => ({ ...cut, position: [0, 0, 0] }))
    expect(view().section?.position).toEqual([0, 0, 0])
  })

  it("opens another project as a model is first looked at, with nothing gone into", () => {
    state().setView({ section: cut, exploded: true, assembly: true })
    state().activate("stool")
    expect(view()).toMatchObject({
      section: null,
      exploded: false,
      assembly: false,
    })
    expect(state().entered).toEqual([])
  })
})

describe("what Esc steps back through", () => {
  /** Press it, and say whether there was anything for it to do. */
  const esc = () => state().leave()

  it("does nothing where there is nothing to get out of", () => {
    expect(esc()).toBe(false)
  })

  it("puts the search away first, and then whichever list is up", () => {
    state().setView({ section: cut })
    state().setPartsOpen(true)
    state().find("leg")
    expect(esc()).toBe(true)
    expect(state()).toMatchObject({ finding: null, partsOpen: true })
    expect(esc()).toBe(true)
    expect(state().partsOpen).toBe(false)
    // and only then anything of the view itself
    expect(view().section).toEqual(cut)
    expect(esc()).toBe(true)
    expect(view().section).toBeNull()
    expect(esc()).toBe(false)
  })

  it("puts a model that is pulled apart together before anything else, whenever it was", () => {
    state().setView({ exploded: true })
    state().setView({ section: cut })
    state().setView({ only: { kind: "part", id: "lid" } })
    esc()
    expect(view()).toMatchObject({ exploded: false, section: cut })
    expect(view().only).not.toBeNull()
  })

  it("then gets out of what was gone into, the last first", () => {
    state().setView({ section: cut })
    state().setView({ hidden: ["base"] })
    state().setView({ only: { kind: "part", id: "lid" } })
    esc()
    expect(view()).toMatchObject({ only: null, hidden: ["base"] })
    esc()
    expect(view().hidden).toEqual([])
    expect(view().section).toEqual(cut)
    esc()
    expect(view().section).toBeNull()
  })

  it("puts a sheet back among the others before it leaves the blueprint", () => {
    state().setView({ blueprint: true, sheet: 1 })
    esc()
    expect(view()).toMatchObject({ blueprint: true, sheet: null })
    esc()
    expect(view().blueprint).toBe(false)
  })

  it("gets out of the guides before what was gone into under them", () => {
    state().setView({ section: cut })
    state().setView({ assembly: true })
    esc()
    expect(view()).toMatchObject({ assembly: false, section: cut })
  })
})

describe("the view with the window to itself", () => {
  it("has the cards and buttons put away, and leaves the conversation as it is", () => {
    state().setThreadOpen(true)
    state().setBare(true)
    expect(state()).toMatchObject({ bare: true, threadOpen: true })
    state().setBare(false)
    expect(state()).toMatchObject({ bare: false, threadOpen: true })
  })

  it("is not what Esc gets out of", () => {
    state().setBare(true)
    expect(state().leave()).toBe(false)
    expect(state().bare).toBe(true)
  })
})

describe("words picked out of the conversation", () => {
  const quotes = () => state().quotes.clock ?? []

  it("are kept for the next message, with what was said of them or nothing", () => {
    state().quote({ quote: "Which screws?" })
    expect(state().quoting).toEqual({ id: null, quote: "Which screws?" })
    const asked = state().writeRequests
    const first = state().keepQuote("  M3, four of them ")
    expect(quotes()).toMatchObject([
      { id: first, quote: "Which screws?", text: "M3, four of them" },
    ])
    // where they have gone is pointed out, and the message box takes the typing
    expect(state()).toMatchObject({ quoting: null, noted: first })
    expect(state().writeRequests).toBe(asked + 1)
    // words alone are something to send
    state().quote({ quote: "Shall it have a lid?" })
    const second = state().keepQuote("")
    expect(quotes().map((one) => one.text)).toEqual(["M3, four of them", ""])
    expect(second).not.toBe(first)
    // and with none picked out, nothing is kept
    expect(state().keepQuote("Nothing")).toBeNull()
    state().quote({ quote: "" })
    expect(state().quoting).toBeNull()
    expect(quotes()).toHaveLength(2)
  })

  it("can have what was said of them changed, and be taken back", () => {
    state().quote({ quote: "Which screws?" })
    const id = state().keepQuote("M3") as string
    state().quote({ id })
    expect(state().quoting).toEqual({ id, quote: "Which screws?" })
    expect(state().keepQuote("M4, on second thoughts")).toBe(id)
    expect(quotes()).toMatchObject([
      { id, quote: "Which screws?", text: "M4, on second thoughts" },
    ])
    // left with nothing said, the words are still quoted
    state().quote({ id })
    state().keepQuote(" ")
    expect(quotes()).toMatchObject([{ id, text: "" }])
    // one that is not there is not gone back to
    state().quote({ id: "nothing" })
    expect(state().quoting).toBeNull()
    state().quote({ id })
    state().dropQuote(id)
    expect(quotes()).toEqual([])
    expect(state().quoting).toBeNull()
  })

  it("go with the message, and are then no longer waiting", () => {
    useStore.setState({
      projects: [{ id: "clock", conversations: [] }] as never,
    })
    state().quote({ quote: "Which screws?" })
    state().keepQuote("M3")
    state().quote({ quote: "Something else" })
    state().send()
    expect(sent).toHaveLength(1)
    expect(sent[0][0]).toBe("clock")
    expect(sent[0].at(-1)).toEqual([{ quote: "Which screws?", text: "M3" }])
    // (what was being said of other words when it went is let go of)
    expect(state()).toMatchObject({ quoting: null, quotes: { clock: [] } })
    // nothing waiting is nothing to send
    state().send()
    expect(sent).toHaveLength(1)
  })
})
