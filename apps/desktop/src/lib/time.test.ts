import { describe, expect, it } from "vitest"

import { duration } from "./time"

describe("duration", () => {
  it("counts in seconds up to a minute, and never says none", () => {
    expect(duration(0)).toBe("1s")
    expect(duration(400)).toBe("1s")
    expect(duration(12_400)).toBe("12s")
    expect(duration(59_400)).toBe("59s")
  })

  it("says the minutes and the seconds over them", () => {
    expect(duration(59_600)).toBe("1m")
    expect(duration(110_000)).toBe("1m 50s")
    expect(duration(59 * 60_000 + 59_000)).toBe("59m 59s")
  })

  it("says the hours, and whatever there is over them", () => {
    expect(duration(3_600_000)).toBe("1h")
    expect(duration(3_725_000)).toBe("1h 2m 5s")
    expect(duration(2 * 3_600_000 + 9_000)).toBe("2h 9s")
  })
})
