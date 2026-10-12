import { describe, expect, it } from "vitest"

import { standing, towards } from "./standing"

/** A guide of three steps. */
const STEPS = 3

describe("standing", () => {
  it("has the thing whole before the first step, in its own colours", () => {
    for (const step of [null, 0, 2])
      expect(standing(-1, step, STEPS)).toMatchObject({
        there: 1,
        out: 0,
        own: 1,
      })
  })

  it("has a step's parts in place and lit once the step is done, and nothing of the later ones", () => {
    expect(standing(1, 1, STEPS)).toEqual({ there: 1, out: 0, lit: 1, own: 0 })
    expect(standing(1, 2, STEPS).there).toBe(0)
    // what went on before is on still, and lit no longer
    expect(standing(1, 0, STEPS)).toEqual({ there: 1, out: 0, lit: 0, own: 0 })
    // and what was there to begin with has been all along
    expect(standing(1, null, STEPS)).toEqual({
      there: 1,
      out: 0,
      lit: 0,
      own: 0,
    })
  })

  it("brings a step's parts in from where they come from as the step goes on", () => {
    const begun = standing(1.05, 2, STEPS)
    const half = standing(1.5, 2, STEPS)
    const nearly = standing(1.95, 2, STEPS)
    expect(begun.out).toBeGreaterThan(half.out)
    expect(half.out).toBeGreaterThan(nearly.out)
    expect(nearly.out).toBeLessThan(0.01)
    expect(begun.there).toBeLessThan(0.2)
    expect(half.there).toBe(1)
    expect(half.lit).toBe(1)
  })

  it("lets the whole go before the first parts come in, which were there in it", () => {
    // still whole, a little way in: where it stands, and fading
    const going = standing(-0.8, 0, STEPS)
    expect(going.out).toBe(0)
    expect(going.there).toBeGreaterThan(0)
    expect(going.there).toBeLessThan(1)
    // gone: and the first parts not yet on their way
    expect(standing(-0.6, 0, STEPS).there).toBe(0)
    expect(standing(-0.6, 2, STEPS).there).toBe(0)
    // then they come, from where they come from
    const coming = standing(-0.3, 0, STEPS)
    expect(coming.out).toBeGreaterThan(0)
    expect(coming.there).toBeGreaterThan(0)
  })

  it("has the thing in its own colours again once the last step is done with", () => {
    expect(standing(STEPS - 1, 0, STEPS).own).toBe(0)
    expect(standing(STEPS, 0, STEPS)).toEqual({
      there: 1,
      out: 0,
      lit: 0,
      own: 1,
    })
  })
})

describe("towards", () => {
  it("goes a step in as long as a step takes", () => {
    expect(towards(0, 1, 0.45, 0.9)).toBeCloseTo(0.5)
    expect(towards(1, 0, 0.45, 0.9)).toBeCloseTo(0.5)
  })

  it("arrives, and goes no further", () => {
    expect(towards(0.9, 1, 0.5, 0.9)).toBe(1)
    expect(towards(2, 2, 0.5, 0.9)).toBe(2)
  })

  it("goes faster to what is further off", () => {
    const near = towards(0, 1, 0.1, 0.9)
    const far = towards(0, 5, 0.1, 0.9)
    expect(far).toBeCloseTo(near * 5)
  })
})
