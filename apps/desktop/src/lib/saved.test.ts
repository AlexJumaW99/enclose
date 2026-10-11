import { describe, expect, it } from "vitest"

import { dated } from "./saved"

describe("dated", () => {
  it("puts the day before the name: the year, the month, the day", () => {
    expect(dated("table-clock.step", new Date(2026, 9, 11))).toBe(
      "2026_10_11_table-clock.step"
    )
  })

  it("writes a month and a day of one figure with two, so that names sort by day", () => {
    expect(dated("lid.step", new Date(2027, 0, 5))).toBe("2027_01_05_lid.step")
  })

  it("goes by the day where the file is saved, late in the evening as at noon", () => {
    expect(dated("lid.step", new Date(2026, 9, 11, 23, 59))).toBe(
      "2026_10_11_lid.step"
    )
  })
})
