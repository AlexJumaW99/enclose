import { describe, expect, it } from "vitest"

import { oneFile, partFile, readModel, sizeOf, type Download } from "./model"

const part = (id: string, extra: object = {}) => ({
  id,
  file: `${id}.glb`,
  ...extra,
})

describe("readModel", () => {
  it("reads a manifest that declares its groups", () => {
    const model = readModel({
      title: "Bracket",
      groups: [
        { id: "body", label: "Body", shell: true },
        { id: "fasteners", label: "Fasteners" },
      ],
      parts: [
        part("plate", { group: "body", color: "#ff0000", explode: [0, 0, 10] }),
        part("bolt", { group: "fasteners", finish: "metal" }),
      ],
    })
    expect(model.title).toBe("Bracket")
    expect(model.groups).toEqual([
      { id: "body", label: "Body", shell: true },
      { id: "fasteners", label: "Fasteners", shell: false },
    ])
    expect(model.parts[0]).toMatchObject({
      label: "plate",
      paint: "all",
      explode: [0, 0, 10],
    })
    expect(model.parts[1]).toMatchObject({
      paint: "bare",
      metal: true,
      color: null,
    })
    expect(model.keepoutsLabel).toBe("Keep-outs")
  })

  it("knows a part that is made of something clear", () => {
    const model = readModel({
      parts: [{ ...part("window"), finish: "glass" }, part("frame")],
    })
    expect(model.parts.map((one) => [one.clear, one.metal])).toEqual([
      [true, false],
      [false, false],
    ])
  })

  it("reads the reference scene a model names, where it names one", () => {
    expect(readModel({ reference: "room", parts: [part("a")] }).reference).toBe(
      "room"
    )
    expect(readModel({ parts: [part("a")] }).reference).toBeNull()
  })

  it("lists a group that a part names but nobody declared", () => {
    const model = readModel({
      // "control": "shell" is how the first version of the format marked the outside
      layers: [{ id: "case", control: "shell" }],
      parts: [part("a", { layer: "odd_bits" }), part("b", { layer: "case" })],
    })
    expect(model.groups).toEqual([
      { id: "case", label: "Case", shell: true },
      { id: "odd_bits", label: "Odd bits", shell: false },
    ])
  })

  it("reads a manifest from before groups, the way its first viewer did", () => {
    const model = readModel({
      parts: [
        part("top", { group: "enclosure", color: "#f4f4f2" }),
        part("battery", { group: "inside", color: "#9aa3ad" }),
        part("scr", { group: "screws", color: "#232528" }),
      ],
      keepouts: [
        {
          id: "usb",
          label: "USB-C plug",
          min: [0, 0, 0],
          max: [1, 2, 3],
          hits: [],
        },
        {
          id: "jst",
          min: [0, 0, 0],
          max: [1, 1, 1],
          hits: [{ part: "top", overlap: 2 }],
        },
        { id: "broken", min: [0, 0], max: [1, 1, 1] },
      ],
    })
    expect(model.groups.map((l) => [l.label, l.shell])).toEqual([
      ["Enclosure", true],
      ["Electronics", false],
      ["Screws", false],
    ])
    // electronics keep the colours of their own files; the colour only fills the gaps
    expect(model.parts.map((p) => p.paint)).toEqual(["all", "bare", "all"])
    expect(model.parts[2].metal).toBe(true)
    expect(model.keepoutsLabel).toBe("Cables")
    expect(model.keepouts.map((k) => [k.id, k.blocked])).toEqual([
      ["usb", false],
      ["jst", true],
    ])
  })

  it("puts parts that name no group into one", () => {
    expect(readModel({ parts: [part("a"), part("b")] }).groups).toEqual([
      { id: "model", label: "Model", shell: false },
    ])
  })

  it("matches a download to its part", () => {
    const model = readModel({
      parts: [part("top")],
      downloads: [
        { file: "step/top.step", part: "top", bytes: 12 },
        { name: "no file" },
      ],
    })
    expect(model.downloads).toEqual([
      {
        file: "step/top.step",
        name: "top.step",
        label: "top.step",
        detail: "",
        kind: "part",
        bytes: 12,
        part: "top",
      },
    ])
  })

  it("says what is wrong with a manifest it cannot use", () => {
    expect(() => readModel(null)).toThrow("no list of parts")
    expect(() => readModel({ parts: [] })).toThrow("lists no parts")
    expect(() => readModel({ parts: [{ id: "a" }] })).toThrow(
      'Part 1 needs an "id" and a "file"'
    )
    expect(() => readModel({ parts: [part("a"), part("a")] })).toThrow(
      'share the id "a"'
    )
  })
})

const file = (name: string, extra: Partial<Download> = {}): Download => ({
  file: `step/${name}.step`,
  name: `${name}.step`,
  label: name,
  detail: "",
  kind: "part",
  bytes: 1000,
  part: name,
  ...extra,
})

describe("oneFile", () => {
  it("is the file with every part in it", () => {
    const all = file("all", { kind: "full", part: null })
    expect(oneFile([file("lid"), all, file("base")])).toBe(all)
  })

  it("is the one file there is, for a model of one part", () => {
    const lid = file("lid")
    expect(oneFile([lid])).toBe(lid)
  })

  it("is none where the parts were written apart and nothing of the whole", () => {
    expect(oneFile([file("lid"), file("base")])).toBeNull()
    expect(oneFile([])).toBeNull()
  })
})

describe("partFile", () => {
  it("goes by the part, and failing that by what the file is called", () => {
    const lid = file("lid")
    const base = file("Base", { part: null })
    expect(partFile([lid, base], "lid", "Lid")).toBe(lid)
    expect(partFile([lid, base], "base", "base")).toBe(base)
    expect(partFile([lid, base], "screw", "Screw")).toBeUndefined()
  })

  it("does not take the whole model for a part of the same name", () => {
    const all = file("Cube", { kind: "full", part: null })
    expect(partFile([all], "cube", "Cube")).toBeUndefined()
  })
})

describe("sizeOf", () => {
  it("says a size shortly", () => {
    expect(sizeOf(2_931_005)).toBe("2.9 MB")
    expect(sizeOf(155_741)).toBe("156 kB")
    expect(sizeOf(300)).toBe("1 kB")
  })

  it("says nothing of a size that is not known", () => {
    expect(sizeOf(0)).toBe("")
  })
})
