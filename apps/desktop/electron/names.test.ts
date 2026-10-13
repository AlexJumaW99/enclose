import { afterEach, describe, expect, it, vi } from "vitest"

import { standInName } from "./names"

afterEach(() => vi.restoreAllMocks())

describe("standInName", () => {
  it("is two plain words, the first with a capital", () => {
    for (let i = 0; i < 50; i++)
      expect(standInName()).toMatch(/^[A-Z][a-z]+ [a-z]+$/)
  })

  it("is any of them, from the first to the last", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    expect(standInName()).toBe("Amber anvil")
    vi.spyOn(Math, "random").mockReturnValue(0.9999)
    expect(standInName()).toBe("Zesty wrench")
  })
})
