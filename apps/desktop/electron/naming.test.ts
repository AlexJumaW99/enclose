import { describe, expect, it } from "vitest"

import { askedOf, tidyName } from "./naming"

describe("askedOf", () => {
  it("says what the parts are, where they were, and what is round them", () => {
    expect(
      askedOf({
        title: "Pocket radio",
        parts: [
          { label: "M3 screw 1", from: "Fasteners" },
          { label: "  Hinge\npin ", from: null },
        ],
        others: ["Enclosure", "Display"],
      })
    ).toBe(
      [
        "The thing: Pocket radio",
        "Its other groups: Enclosure, Display",
        "The parts now in one group:",
        "- M3 screw 1 (was in: Fasteners)",
        "- Hinge pin",
        "",
        "What is the group to be called? Reply with the name and nothing else.",
      ].join("\n")
    )
  })

  it("lists no more parts than tell what a group is", () => {
    const parts = Array.from({ length: 75 }, (_, n) => ({
      label: `Pin ${n}`,
      from: "Board",
    }))
    const asked = askedOf({ title: null, parts, others: [] })
    expect(asked.split("\n")[0]).toBe("The parts now in one group:")
    expect(asked).toContain("- Pin 59 (was in: Board)")
    expect(asked).not.toContain("- Pin 60 ")
    expect(asked).toContain("- and 15 more")
  })
})

describe("tidyName", () => {
  it("keeps a name bare, in one line", () => {
    expect(tidyName(' "Battery and\n speaker". ')).toBe("Battery and speaker")
    expect(tidyName("**Fasteners**")).toBe("Fasteners")
  })

  it("takes nothing that is no name", () => {
    expect(tidyName("  ")).toBeNull()
    expect(
      tidyName("These parts look like they belong to the display assembly")
    ).toBeNull()
  })
})
