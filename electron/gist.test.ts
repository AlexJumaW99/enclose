import { describe, expect, it } from "vitest"

import { plain, tidy } from "./gist"

describe("plain", () => {
  it("puts a message in one line", () => {
    expect(
      plain("  The lid is in.\n\n- four spigots\n- nothing else moved ")
    ).toBe("The lid is in. - four spigots - nothing else moved")
  })

  it("drops what only marks a word out", () => {
    expect(plain("## Done\nRan `python3 model.py`, **no** errors")).toBe(
      "Done Ran python3 model.py, no errors"
    )
  })

  it("shows no more than a card could ever hold", () => {
    const shown = plain("word ".repeat(100))
    expect(shown).toHaveLength(201)
    expect(shown.endsWith("…")).toBe(true)
  })
})

describe("tidy", () => {
  it("keeps a summing up as one bare line", () => {
    expect(tidy(' "Lid thickened to 5 mm,\n spigots moved." ')).toBe(
      "Lid thickened to 5 mm, spigots moved"
    )
  })

  it("has none where nothing came back, or far too much", () => {
    expect(tidy("  ")).toBeNull()
    expect(tidy("word ".repeat(30))).toBeNull()
  })
})
