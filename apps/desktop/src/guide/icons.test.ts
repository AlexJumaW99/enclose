import { describe, expect, it } from "vitest"

import { iconFor } from "./icons"

describe("iconFor", () => {
  it("is the picture a guide gives a thing, where the page has that one", () => {
    expect(iconFor("Something to stand it on", "box")).toBe("box")
    // one it has not is made out from the name instead
    expect(iconFor("4 mm hex key", "allen")).toBe("hex-key")
  })

  it("makes a picture out from what a thing is called, where it is given none", () => {
    const read = (name: string) => iconFor(name, null)
    expect(read("2.5 mm hex key")).toBe("hex-key")
    expect(read("Allen key, 4 mm")).toBe("hex-key")
    expect(read("Phillips screwdriver, PH1")).toBe("screwdriver")
    expect(read("10 mm spanner")).toBe("wrench")
    expect(read("Rubber mallet")).toBe("hammer")
    expect(read("Contact adhesive, for the cushion")).toBe("glue")
    expect(read("Epoxy glue, for the leg plates and glides")).toBe("glue")
    expect(read("Two clamps or a strap")).toBe("clamp")
    expect(read("Blanket or soft cloth")).toBe("cloth")
    expect(read("Soldering iron")).toBe("soldering-iron")
    expect(read("Four M3 × 8 screws")).toBe("screw")
    expect(read("Sturdy box or stack of books, 150 mm high")).toBe("box")
    expect(read("A second pair of hands")).toBe("helper")
  })

  it("takes what is measured with for a rule, though it is called a tape", () => {
    expect(iconFor("Tape measure", null)).toBe("ruler")
    expect(iconFor("Masking tape", null)).toBe("tape")
  })

  it("gives a thing it cannot make out a plain ring", () => {
    expect(iconFor("Patience", null)).toBe("thing")
  })
})
