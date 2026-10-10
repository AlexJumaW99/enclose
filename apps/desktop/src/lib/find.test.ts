import { describe, expect, it } from "vitest"

import { howMany, lookFor } from "./find"

const part = (id: string, label: string, group: string) => ({
  id,
  label,
  group,
  file: `${id}.glb`,
  edges: null,
  color: null,
  paint: "bare" as const,
  matrix: null,
  explode: [0, 0, 0] as [number, number, number],
  glass: null,
  metal: false,
  clear: false,
})

const model = {
  groups: [
    { id: "enclosure", label: "Enclosure", shell: true },
    { id: "buttons", label: "Buttons", shell: false },
    { id: "main_board", label: "Main board", shell: false },
    { id: "spare", label: "Spare", shell: false },
  ],
  parts: [
    part("lid", "Lid", "enclosure"),
    part("bottom_shell", "Bottom shell", "enclosure"),
    part("record_button_cap", "Record button cap", "buttons"),
    part("power_button_cap", "Power button cap", "buttons"),
    part("cm4_processor_lid", "CM4 processor lid", "main_board"),
    part("u3", "Regulator", "main_board"),
  ],
}

const named = (name: string) =>
  lookFor(model, name).things.map((thing) => `${thing.kind}:${thing.id}`)

describe("lookFor", () => {
  it("finds nothing until something is typed", () => {
    expect(lookFor(model, "")).toEqual({ things: [], parts: [] })
    expect(lookFor(model, "   ")).toEqual({ things: [], parts: [] })
  })

  it("finds a part by what it is called, however it is cased", () => {
    expect(named("regul")).toEqual(["part:u3"])
    expect(named("REGUL")).toEqual(["part:u3"])
  })

  it("finds a part by its id, which is what Claude calls it", () => {
    expect(named("u3")).toEqual(["part:u3"])
  })

  it("puts what begins with the name before what only has it in it", () => {
    expect(named("lid")).toEqual(["part:lid", "part:cm4_processor_lid"])
  })

  it("finds a group, and puts it before parts as near the name", () => {
    expect(named("button")).toEqual([
      "group:buttons",
      "part:record_button_cap",
      "part:power_button_cap",
    ])
  })

  it("takes every part of a group that is found as found", () => {
    expect(lookFor(model, "main").parts).toEqual(["cm4_processor_lid", "u3"])
  })

  it("gives the parts once each, in the order the model has them", () => {
    expect(lookFor(model, "b").parts).toEqual([
      "bottom_shell",
      "record_button_cap",
      "power_button_cap",
      "cm4_processor_lid",
      "u3",
    ])
  })

  it("does not find a group that has nothing in it", () => {
    expect(named("spare")).toEqual([])
  })

  it("finds nothing by a name nothing goes by", () => {
    expect(lookFor(model, "zzz")).toEqual({ things: [], parts: [] })
  })
})

describe("howMany", () => {
  it("says how many groups and parts were found", () => {
    expect(howMany(lookFor(model, "button").things)).toBe("1 group, 2 parts")
    expect(howMany(lookFor(model, "regul").things)).toBe("1 part")
    expect(howMany(lookFor(model, "b").things)).toBe("2 groups, 3 parts")
  })
})
