import { describe, expect, it } from "vitest"

import { WHEEL, wheelHeard } from "./wheel"

/** The wheel turned by this much, down the page unless it says across, at a moment in ms. */
const turned = (timeStamp: number, deltaY: number, deltaX = 0) => ({
  timeStamp,
  deltaY,
  deltaX,
})

/** What is asked for as a wheel says these things, one after another: only where anything is. */
function asked(...said: ReturnType<typeof turned>[]) {
  const heard = wheelHeard()
  return said.flatMap((one) => heard(one) ?? [])
}

/**
 * What a trackpad says of two fingers drawn once along it, from a moment on: more for a
 * little while, and then less and less for a good while after the fingers have left.
 */
const swipe = (from: number, way: 1 | -1 = 1) =>
  [
    6, 18, 42, 60, 52, 44, 37, 31, 26, 22, 18, 15, 12, 10, 8, 7, 6, 5, 4, 3, 2,
    1,
  ].map((by, index) => turned(from + index * 16, by * way))

describe("wheelHeard", () => {
  it("goes on a step for a turn down the page, and back one for a turn up it", () => {
    expect(asked(turned(0, 30))).toEqual(["on"])
    expect(asked(turned(0, -30))).toEqual(["back"])
  })

  it("goes one step for one draw of the fingers, however long the trackpad goes on about it", () => {
    expect(asked(...swipe(0))).toEqual(["on"])
    expect(asked(...swipe(0, -1))).toEqual(["back"])
  })

  it("goes another for another draw, once the first has been rested from", () => {
    expect(asked(...swipe(0), ...swipe(600))).toEqual(["on", "on"])
    expect(asked(...swipe(0), ...swipe(600, -1))).toEqual(["on", "back"])
  })

  it("does not go another for one begun before the rest is over", () => {
    expect(asked(...swipe(0), ...swipe(WHEEL.rests - 200))).toEqual(["on"])
  })

  it("goes a step for each click of a mouse's wheel, which says the same every time", () => {
    expect(asked(turned(0, 100), turned(500, 100), turned(1000, 100))).toEqual([
      "on",
      "on",
      "on",
    ])
    // clicked faster than a step is rested from, it still goes one at a time
    expect(
      asked(
        turned(0, 100),
        turned(100, 100),
        turned(200, 100),
        turned(520, 100)
      )
    ).toEqual(["on", "on"])
  })

  it("takes a touch that is hardly a turn for none", () => {
    expect(asked(turned(0, WHEEL.least - 1), turned(16, -2))).toEqual([])
  })

  it("leaves a turn across the page alone", () => {
    expect(asked(turned(0, 10, 40))).toEqual([])
    expect(asked(turned(0, 40, 10))).toEqual(["on"])
  })
})
