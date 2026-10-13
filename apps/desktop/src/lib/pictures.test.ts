import { describe, expect, it } from "vitest"

import { isPicture, sizeOf } from "./pictures"

describe("isPicture", () => {
  it("goes by what a file says it is", () => {
    expect(isPicture(new Blob([], { type: "image/png" }))).toBe(true)
    expect(isPicture(new Blob([], { type: "image/heic" }))).toBe(true)
    expect(isPicture(new Blob([], { type: "model/step" }))).toBe(false)
    expect(isPicture(new Blob([]))).toBe(false)
  })
})

describe("sizeOf", () => {
  it("says how big a file is as it is said to someone", () => {
    expect(sizeOf(0)).toBe("0 B")
    expect(sizeOf(999)).toBe("999 B")
    expect(sizeOf(486_000)).toBe("486 KB")
    expect(sizeOf(1_200_000)).toBe("1.2 MB")
    expect(sizeOf(265_106)).toBe("265 KB")
  })

  it("never says a thousand of the smaller where it is one of the bigger", () => {
    expect(sizeOf(1000)).toBe("1 KB")
    expect(sizeOf(999_499)).toBe("999 KB")
    expect(sizeOf(999_500)).toBe("1.0 MB")
  })
})
