import { beforeEach, describe, expect, it, vi } from "vitest"

// The store is the window's: it keeps things in the window's storage, and tells the
// app's own process what of the view is used. Both are stood in for here, before the
// store is read, since it reads what was kept as it is made.
const { kept, used } = vi.hoisted(() => {
  const kept = new Map<string, string>()
  const used: string[] = []
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  })
  vi.stubGlobal("location", { hash: "" })
  vi.stubGlobal("window", {
    cad: { analytics: { used: (name: string) => void used.push(name) } },
  })
  return { kept, used }
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
