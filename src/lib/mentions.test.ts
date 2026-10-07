import { describe, expect, it } from "vitest"

import { matching, putIn, stretches, tokenAt } from "./mentions"

describe("tokenAt", () => {
  it("finds a part being named", () => {
    expect(tokenAt("make @li", 8)).toEqual({
      kind: "part",
      from: 5,
      to: 8,
      query: "li",
    })
  })

  it("finds one as soon as its mark is written", () => {
    expect(tokenAt("@", 1)).toMatchObject({ kind: "part", query: "" })
    expect(tokenAt("use $", 5)).toMatchObject({ kind: "skill", query: "" })
  })

  it("takes a command only at the start of the message", () => {
    expect(tokenAt("/comp", 5)).toMatchObject({
      kind: "command",
      query: "comp",
    })
    expect(tokenAt("see /comp", 9)).toBeNull()
    expect(tokenAt("a path/to", 9)).toBeNull()
  })

  it("is over once a space follows the name", () => {
    expect(tokenAt("/compact ", 9)).toBeNull()
    expect(tokenAt("@lid and", 8)).toBeNull()
  })

  it("wants the mark at the start of a word", () => {
    expect(tokenAt("me@home", 7)).toBeNull()
    expect(tokenAt("costs $5.00!", 12)).toBeNull()
  })

  it("takes the rest of the word with it when the caret is inside one", () => {
    expect(tokenAt("@tube_3 here", 3)).toEqual({
      kind: "part",
      from: 0,
      to: 7,
      query: "tu",
    })
  })

  it("takes names with a plugin in front", () => {
    expect(tokenAt("$vercel:ai-", 11)).toMatchObject({ query: "vercel:ai-" })
  })
})

describe("putIn", () => {
  it("writes the name out, with a space after it", () => {
    const token = tokenAt("make @li", 8)!
    expect(putIn("make @li", token, "lid")).toEqual({
      text: "make @lid ",
      caret: 10,
    })
  })

  it("does not double a space that is there", () => {
    const token = tokenAt("make @li taller", 8)!
    expect(putIn("make @li taller", token, "lid")).toEqual({
      text: "make @lid taller",
      caret: 10,
    })
  })

  it("replaces all of the word the caret was in", () => {
    const token = tokenAt("@tube_3 here", 3)!
    expect(putIn("@tube_3 here", token, "tube_9").text).toBe("@tube_9 here")
  })
})

describe("matching", () => {
  const list = [
    { name: "cube", also: "Cube" },
    { name: "tube_1", also: "Tube 1" },
    { name: "lid", also: "Lid" },
    { name: "vercel:ai-sdk" },
    { name: "kicad-pcb" },
  ]
  const names = (query: string) => matching(list, query).map((x) => x.name)

  it("gives all of them when nothing is written", () => {
    expect(names("")).toHaveLength(5)
  })

  it("puts what begins with it first, then words within, then the rest", () => {
    expect(names("c")).toEqual(["cube", "vercel:ai-sdk", "kicad-pcb"])
    expect(names("a")).toEqual(["vercel:ai-sdk", "kicad-pcb"])
    expect(names("pcb")).toEqual(["kicad-pcb"])
    expect(names("ub")).toEqual(["cube", "tube_1"])
  })

  it("finds by the other name too, whatever the case", () => {
    expect(names("TUBE 1")).toEqual(["tube_1"])
  })
})

describe("stretches", () => {
  it("picks the names out of a message", () => {
    expect(stretches("make @lid taller with $kicad-pcb.")).toEqual([
      { text: "make ", kind: null },
      { text: "@lid", kind: "part" },
      { text: " taller with ", kind: null },
      { text: "$kicad-pcb", kind: "skill" },
      { text: ".", kind: null },
    ])
  })

  it("takes a command only at the start", () => {
    expect(stretches("/compact keep the sizes")[0]).toEqual({
      text: "/compact",
      kind: "command",
    })
    expect(stretches("a/b or /c").every((s) => s.kind === null)).toBe(true)
  })

  it("leaves prices and addresses alone", () => {
    expect(stretches("$5 to me@home.org")).toEqual([
      { text: "$5 to me@home.org", kind: null },
    ])
  })
})
