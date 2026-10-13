// Where a guide's model is looked at from, at each place along it.
//
// The page looks at the model as a blueprint draws it, from one of its corners, and a
// step says which where that matters. A step that does not say is seen as the last one
// done to the same thing was: so something made up apart, before it goes on, is seen
// as its own steps say, and the thing itself, when it is come back to, as it last was.
import type { Vec3 } from "@shared/api"
import { cornerOf, type GuideStep } from "@shared/assembly-format"

/**
 * Where the model is looked at from to begin with, as the way from it to the eye: its
 * front right corner, from above, which is the corner its covers are drawn from.
 */
export const CORNER: Vec3 = [1, -1, 1]

/**
 * Where a place in a guide is looked at from, as the way from the model to the eye (see
 * standing.ts for what a place is). For a step it is the corner the step asks to be
 * seen from, or that the last step done to the same thing asked. The first step of
 * something made up apart, if it does not say, is seen as the thing itself last was.
 * And for the thing whole, before the steps and after them, it is the corner a model is
 * looked at from to begin with.
 */
export function seenFrom(
  steps: Pick<GuideStep, "sub" | "view">[],
  place: number
): Vec3 {
  const upTo = place < steps.length ? Math.round(place) : -1
  const sub = upTo < 0 ? null : steps[upTo].sub
  for (const of of sub === null ? [null] : [sub, null])
    for (let index = upTo; index >= 0; index--) {
      const step = steps[index]
      if (step.sub === of && step.view) return cornerOf(step.view)
    }
  return CORNER
}
