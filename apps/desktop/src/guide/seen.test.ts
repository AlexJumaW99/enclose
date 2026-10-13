import { describe, expect, it } from "vitest"

import type { Vec3 } from "@shared/api"
import { CORNER, seenFrom } from "./seen"

/** Steps that are seen from these places, each done to the thing itself or to what is named. */
const steps = (...given: ([string | null, Vec3 | null] | Vec3 | null)[]) =>
  given.map((one) => {
    const [sub, view] =
      one !== null && one.length === 2
        ? (one as [string | null, Vec3 | null])
        : [null, one as Vec3 | null]
    return { sub, view }
  })

const UNDER: Vec3 = [1, -1, -1]
const BEHIND: Vec3 = [1, 1, 1]

describe("seenFrom", () => {
  it("is the corner a model is looked at from to begin with, before the steps and after them", () => {
    const guide = steps(UNDER, null)
    expect(seenFrom(guide, -1)).toEqual(CORNER)
    expect(seenFrom(guide, 2)).toEqual(CORNER)
    expect(seenFrom([], 0)).toEqual(CORNER)
  })

  it("is the corner a step asks for, whichever way it leans towards it", () => {
    expect(seenFrom(steps([0.4, -2, -0.3]), 0)).toEqual(UNDER)
  })

  it("stays where the step before had it, where a step does not say", () => {
    const guide = steps(null, UNDER, null, null, BEHIND, null)
    expect(seenFrom(guide, 0)).toEqual(CORNER)
    expect(seenFrom(guide, 2)).toEqual(UNDER)
    expect(seenFrom(guide, 3)).toEqual(UNDER)
    expect(seenFrom(guide, 5)).toEqual(BEHIND)
  })

  it("goes by the step that is on its way in, between two", () => {
    const guide = steps(null, UNDER)
    expect(seenFrom(guide, 0.4)).toEqual(CORNER)
    expect(seenFrom(guide, 0.6)).toEqual(UNDER)
  })

  it("has something made up apart seen as its own steps say, and the thing itself as it last was", () => {
    const guide = steps(
      BEHIND,
      ["Ring", UNDER],
      ["Ring", null],
      // the ring goes on: no step of the thing itself has said since the first
      null,
      null
    )
    expect(seenFrom(guide, 2)).toEqual(UNDER)
    expect(seenFrom(guide, 3)).toEqual(BEHIND)
    expect(seenFrom(guide, 4)).toEqual(BEHIND)
  })

  it("has one such thing seen apart from another", () => {
    const guide = steps(["Ring", UNDER], ["Disc", null], ["Ring", null])
    // the disc's first step does not say, and no step of the thing itself has
    expect(seenFrom(guide, 1)).toEqual(CORNER)
    expect(seenFrom(guide, 2)).toEqual(UNDER)
  })

  it("has the first step of something made up apart seen as the thing itself last was, where it does not say", () => {
    const guide = steps(BEHIND, ["Ring", null])
    expect(seenFrom(guide, 1)).toEqual(BEHIND)
  })
})
