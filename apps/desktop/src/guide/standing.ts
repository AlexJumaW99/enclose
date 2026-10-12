// How a guide's parts stand at each place along it.
//
// A guide is gone through from before its first step to after its last, and where that
// has got to is one number: -1 is the thing whole, as it is shown before anything is
// begun; each whole number from 0 is that step done, counted from the first; and the
// number of steps is the thing finished. Between two of them a step is under way: its
// parts are on their way in. So what the page draws is all told by that number, and
// going back through a guide is the same as going on through it, the other way.

/** How one part stands: all of these from 0 to 1. */
export type Standing = {
  /** how much of it is there to be seen: nothing, of a part that has not come yet */
  there: number
  /** how far it still is from its place: 1 where it comes from, 0 in place */
  out: number
  /** how much it is lit, as what the step under way is about */
  lit: number
  /** how much it is in its own colour, as the thing is before the steps and after them */
  own: number
}

/** How much of the way from the thing whole to the first step the whole is still seen for. */
const WHOLE_GOES = 0.4
/** How much of a part's way in it takes to be all there. */
const APPEARS = 0.3
/** How much of the next step a part stays lit into, going out. */
const DIMS = 0.6

const clamp = (n: number) => Math.min(1, Math.max(0, n))
/** Evenly from 0 at `from` to 1 at `to`, setting off slowly and arriving slowly. */
function smooth(n: number, from: number, to: number): number {
  const share = clamp((n - from) / (to - from))
  return share * share * (3 - 2 * share)
}
/** Quick away, and slow into place: how a part is put on. */
const settle = (share: number) => 1 - (1 - share) ** 3

/**
 * How a part stands with the guide at `at`. `step` is the step that puts it on, counted
 * from 0, or null of a part that is there to begin with; `steps` is how many there are.
 */
export function standing(
  at: number,
  step: number | null,
  steps: number
): Standing {
  // before the first step the thing is shown whole, and after the last it is whole again
  const whole = at < 0 ? 1 - smooth(at + 1, 0, WHOLE_GOES) : 0
  const own = Math.max(whole, smooth(at, steps - 1, steps))
  if (step === null) return { there: 1, out: 0, lit: 0, own }
  if (at >= step)
    return { there: 1, out: 0, lit: 1 - smooth(at - step, 0, DIMS), own }
  // On its way in, over the step before it up to its own: but for the first step, which
  // waits for the whole to have gone, since its parts were there in that.
  const coming =
    step === 0
      ? clamp((at + 1 - WHOLE_GOES) / (1 - WHOLE_GOES))
      : clamp(at - (step - 1))
  return {
    there: Math.max(whole, smooth(coming, 0, APPEARS)),
    out: coming > 0 ? 1 - settle(coming) : 0,
    lit: 1,
    own,
  }
}

/**
 * Where the guide is, a moment on from `at`, on its way to `to`: a step takes `takes`
 * seconds, and what is further off than a step is gone to faster, by as much as it is
 * further, so that a guide gone through at a run keeps up.
 */
export function towards(
  at: number,
  to: number,
  seconds: number,
  takes: number
): number {
  const left = to - at
  if (left === 0) return to
  const by = (seconds / takes) * Math.max(1, Math.abs(left))
  return Math.abs(left) <= by ? to : at + Math.sign(left) * by
}
