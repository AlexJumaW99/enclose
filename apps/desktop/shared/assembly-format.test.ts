import { describe, expect, it } from "vitest"

import {
  fileNameOf,
  leftOut,
  partsIn,
  readGuide,
  troubleWith,
  writtenAs,
} from "./assembly-format"

const lamp = {
  title: "  Desk lamp ",
  summary: "A lamp with a weighted base.",
  needs: ["2.5 mm hex key", "", 3],
  steps: [
    { title: "Start with the base", text: "Lay it down.", parts: ["base"] },
    {
      title: "Fix the cover",
      text: "Set it over the weight.",
      parts: ["cover", "screws", "cover"],
      from: [0, 0, 70],
      view: [1, -1, 0.8],
      tip: "Not too tight.",
    },
  ],
}

describe("readGuide", () => {
  it("reads a guide as it is given, tidied", () => {
    expect(readGuide(lamp)).toEqual({
      title: "Desk lamp",
      version: 1,
      made: null,
      summary: "A lamp with a weighted base.",
      needs: ["2.5 mm hex key"],
      already: [],
      steps: [
        {
          title: "Start with the base",
          text: "Lay it down.",
          parts: ["base"],
          from: null,
          view: null,
          tip: null,
        },
        {
          title: "Fix the cover",
          text: "Set it over the weight.",
          // (a part named twice in a step is in it once)
          parts: ["cover", "screws"],
          from: [0, 0, 70],
          view: [1, -1, 0.8],
          tip: "Not too tight.",
        },
      ],
    })
  })

  it("reads back what it wrote, with which writing it is and when", () => {
    const guide = {
      ...readGuide({ ...lamp, already: ["post"] }),
      version: 3,
      made: Date.UTC(2026, 9, 12, 15, 30),
    }
    expect(readGuide(JSON.parse(writtenAs(guide)))).toEqual(guide)
    expect(writtenAs(guide)).toContain('"made": "2026-10-12T15:30:00.000Z"')
  })

  it("says what is wrong with what is no guide", () => {
    expect(() => readGuide(null)).toThrow("A guide is an object.")
    expect(() => readGuide({ steps: [] })).toThrow('needs a "title"')
    expect(() => readGuide({ title: "Lamp", steps: [] })).toThrow(
      "at least one"
    )
    expect(() =>
      readGuide({ title: "Lamp", steps: [{ title: "Fit it" }] })
    ).toThrow('Step 1 needs a "title" and a "text".')
    const step = { title: "Fit it", text: "Push it on.", parts: ["a"] }
    expect(() =>
      readGuide({ title: "Lamp", steps: [step, { ...step, from: [0, 60] }] })
    ).toThrow('Step 2: "from" is three numbers')
    expect(() =>
      readGuide({ title: "Lamp", steps: [{ ...step, view: [0, 0, 0] }] })
    ).toThrow('"view" has to point somewhere')
  })
})

describe("troubleWith", () => {
  const model = ["base", "weight", "cover", "screws"]
  const guide = (steps: string[][], already: string[] = []) =>
    readGuide({
      title: "Lamp",
      already,
      steps: steps.map((parts) => ({ title: "Do", text: "It.", parts })),
    })

  it("finds nothing wrong with a guide to parts the model has, each put on once", () => {
    expect(
      troubleWith(guide([["base"], [], ["cover", "screws"]]), model)
    ).toEqual([])
  })

  it("names the parts the model has not, and says which it has", () => {
    const [trouble] = troubleWith(guide([["base", "lid"]]), model)
    expect(trouble).toContain("no part with the id lid")
    expect(trouble).toContain("base, weight, cover, screws")
  })

  it("has a part go on once, and not be there already as well", () => {
    expect(troubleWith(guide([["base"], ["base"]]), model)).toEqual([
      "base goes on in step 1 and again in step 2: a part goes on once.",
    ])
    expect(troubleWith(guide([["base"]], ["base"]), model)[0]).toContain(
      "it is one or the other"
    )
  })

  it("wants some step to put a part on", () => {
    expect(troubleWith(guide([[]], ["base"]), model)).toEqual([
      "No step puts a part on: each names the parts it adds.",
    ])
  })
})

describe("the parts of a guide", () => {
  const guide = readGuide({
    title: "Cover",
    already: ["base"],
    steps: [{ title: "Fix it", text: "With the screws.", parts: ["cover"] }],
  })

  it("are those there to begin with, and then those its steps put on", () => {
    expect(partsIn(guide)).toEqual(["base", "cover"])
  })

  it("leave out the rest of the model", () => {
    expect(leftOut(guide, ["base", "weight", "cover"])).toEqual(["weight"])
  })
})

describe("fileNameOf", () => {
  it("makes a name a file can have of whatever a guide is to", () => {
    expect(fileNameOf("Counter stool")).toBe("counter-stool")
    expect(fileNameOf("  Café table, 2nd ")).toBe("cafe-table-2nd")
    expect(fileNameOf("***")).toBe("guide")
    expect(fileNameOf("a".repeat(90))).toHaveLength(60)
  })
})
