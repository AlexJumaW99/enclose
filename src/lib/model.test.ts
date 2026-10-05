import { describe, expect, it } from "vitest"

import { readModel } from "./model"

const part = (id: string, extra: object = {}) => ({
  id,
  file: `${id}.glb`,
  ...extra,
})

describe("readModel", () => {
  it("reads a manifest that declares its layers", () => {
    const model = readModel({
      title: "Bracket",
      layers: [
        { id: "body", label: "Body", control: "shell" },
        { id: "fasteners", label: "Fasteners" },
      ],
      parts: [
        part("plate", { layer: "body", color: "#ff0000", explode: [0, 0, 10] }),
        part("bolt", { layer: "fasteners", finish: "metal" }),
      ],
    })
    expect(model.title).toBe("Bracket")
    expect(model.layers).toEqual([
      { id: "body", label: "Body", control: "shell" },
      { id: "fasteners", label: "Fasteners", control: "toggle" },
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

  it("gives a layer nobody declared a switch of its own", () => {
    const model = readModel({
      layers: [],
      parts: [part("a", { layer: "odd_bits" })],
    })
    expect(model.layers).toEqual([
      { id: "odd_bits", label: "Odd bits", control: "toggle" },
    ])
  })

  it("reads a manifest from before layers, the way its first viewer did", () => {
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
    expect(model.layers.map((l) => [l.label, l.control])).toEqual([
      ["Enclosure", "shell"],
      ["Electronics", "toggle"],
      ["Screws", "always"],
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

  it("has nothing to switch when everything is one undeclared layer", () => {
    expect(readModel({ parts: [part("a"), part("b")] }).layers).toEqual([
      { id: "model", label: "Model", control: "always" },
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
