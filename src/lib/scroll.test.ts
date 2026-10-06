import { describe, expect, it } from "vitest"

import { SCROLL_PAUSE, scrollSource, sourceOf } from "./scroll"

const scroll = (deltaX: number, deltaY: number, deltaMode = 0) => ({
  deltaX,
  deltaY,
  deltaMode,
})

describe("sourceOf", () => {
  it("takes small whole steps, and anything sideways, for fingers", () => {
    expect(sourceOf(scroll(0, 3), true)).toBe("fingers")
    expect(sourceOf(scroll(0, -12), true)).toBe("fingers")
    expect(sourceOf(scroll(-7, 0), true)).toBe("fingers")
    expect(sourceOf(scroll(2, 180), false)).toBe("fingers")
    expect(sourceOf(scroll(0, 0), true)).toBe("fingers")
  })

  it("knows a wheel on macOS by its fractions of a line", () => {
    expect(sourceOf(scroll(0, 4.000244140625), true)).toBe("wheel")
    expect(sourceOf(scroll(0, -36.002197265625), true)).toBe("wheel")
  })

  it("knows a wheel elsewhere by the size of a notch", () => {
    expect(sourceOf(scroll(0, 100), false)).toBe("wheel")
    expect(sourceOf(scroll(0, -120), false)).toBe("wheel")
    // a touchpad on a scaled display counts in fractions too
    expect(sourceOf(scroll(0, 6.5), false)).toBe("fingers")
  })

  it("knows a wheel that counts in lines", () => {
    expect(sourceOf(scroll(0, 3, 1), false)).toBe("wheel")
  })
})

describe("scrollSource", () => {
  it("keeps its answer until the movement pauses", () => {
    const source = scrollSource(true)
    // a swipe that gets fast is still a swipe
    expect(source(scroll(0, 2), 0)).toBe("fingers")
    expect(source(scroll(0, 140), 16)).toBe("fingers")
    expect(source(scroll(0, 90), 32)).toBe("fingers")
    // then, after a pause, a wheel
    const later = 32 + SCROLL_PAUSE + 1
    expect(source(scroll(0, 4.000244140625), later)).toBe("wheel")
    expect(source(scroll(0, 40), later + 30)).toBe("wheel")
  })
})
