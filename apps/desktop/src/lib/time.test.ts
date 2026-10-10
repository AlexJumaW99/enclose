import { describe, expect, it } from "vitest"

import { duration, elapsed } from "./time"

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

describe("elapsed", () => {
  it("counts in seconds up to a minute, from none", () => {
    expect(elapsed(0)).toBe("0 s")
    expect(elapsed(2_400)).toBe("2 s")
    expect(elapsed(59_900)).toBe("59 s")
    // (a clock a little behind the one it is counted from is not time gone backwards)
    expect(elapsed(-300)).toBe("0 s")
  })

  it("counts in whole minutes from then on", () => {
    expect(elapsed(60_000)).toBe("1 min")
    expect(elapsed(21 * 60_000 + 40_000)).toBe("21 min")
    expect(elapsed(59 * 60_000 + 59_000)).toBe("59 min")
  })

  it("says the hours, and the minutes over them", () => {
    expect(elapsed(3_600_000)).toBe("1 h")
    expect(elapsed(3_600_000 + 5 * 60_000)).toBe("1 h 5 min")
    expect(elapsed(2 * 3_600_000 + 30_000)).toBe("2 h")
  })
})
