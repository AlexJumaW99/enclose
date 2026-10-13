// Where the parts of a guide come from, as each goes on.
//
// A step's parts are seen to arrive: from where the step says, all of them alike, or,
// where it does not say, each from wherever it would be put on from. This works that
// out for every part and every step that brings it, once, when the page is made.
import * as THREE from "three"

import type { Guide, Scene } from "@shared/assembly-format"

/**
 * How far off a part is before it goes on, where the guide does not say, as a share of
 * how far across the whole thing is: at the least, at the most, and where there is
 * nothing to go by. And never less than this many mm.
 */
export const COMES_FROM = { least: 0.12, most: 0.45, share: 0.32, mm: 15 }
/**
 * How much further off than the model pulls a part, when it is pulled apart, the part
 * is before it goes on: a model is pulled apart a little way, to be seen into.
 */
const FURTHER = 1.5
/** How much of the way a part lies from the rest counts as none, beside the most of it. */
const ASIDE = 0.35

/** A part, as far as where it comes from goes. */
export type Comer = {
  /** the room it takes up, in the model, where the model has it */
  box: THREE.Box3
  /** where the model says it goes when it is pulled apart, mm: nowhere, if it does not say */
  away: THREE.Vector3
  /**
   * Where it comes from, in each step that brings it, as how far that is from its
   * place, mm. A part of something made up apart comes twice: on to that, and with it
   * on to what that is fitted to.
   */
  comes: Map<number, THREE.Vector3>
}

/**
 * Says where each part comes from in each step that brings it, in the model's own
 * measure: where the step says, which is the same for everything the step puts on.
 * Where the step does not say, each of its own parts comes its own way in from outside:
 * back along the way the model says it goes when it is pulled apart, if the model says,
 * and otherwise straight in towards the middle of what is there by then. So four bolts
 * through four legs come in from four sides. A part with nothing there before it, or in
 * the middle of the rest, comes down from above. And what a step fits, made up already,
 * comes all one way, as the one thing it now is. `across` is how far across the whole
 * thing is, mm.
 */
export function comingFrom(
  guide: Pick<Guide, "steps">,
  scenes: Scene[],
  shown: ReadonlyMap<string, Comer>,
  across: number
) {
  const least = Math.max(COMES_FROM.mm, across * COMES_FROM.least)
  const most = Math.max(least, across * COMES_FROM.most)
  const far = Math.max(COMES_FROM.mm, across * COMES_FROM.share)
  const boxOf = (ids: string[]) => {
    const box = new THREE.Box3()
    for (const id of ids) {
      const part = shown.get(id)
      if (part) box.union(part.box)
    }
    return box
  }
  /** The way in for what takes up `box`, from outside what is there. */
  const wayIn = (box: THREE.Box3, on: THREE.Box3) => {
    const out =
      on.isEmpty() || box.isEmpty()
        ? new THREE.Vector3()
        : box
            .getCenter(new THREE.Vector3())
            .sub(on.getCenter(new THREE.Vector3()))
    // what is nearly along one of the model's axes is taken to be along it
    const [x, y, z] = out.toArray().map(Math.abs)
    const longest = Math.max(x, y, z)
    if (x < longest * ASIDE) out.x = 0
    if (y < longest * ASIDE) out.y = 0
    if (z < longest * ASIDE) out.z = 0
    if (longest < across * 0.02) out.set(0, 0, 1)
    return out.setLength(far)
  }
  guide.steps.forEach((step, index) => {
    const { there, coming } = scenes[index]
    const on = boxOf(there)
    const fitted = coming.filter((id) => !step.parts.includes(id))
    const together = step.from
      ? new THREE.Vector3(...step.from)
      : wayIn(boxOf(fitted), on)
    for (const id of coming) {
      const part = shown.get(id)
      if (!part) continue
      if (step.from || fitted.includes(id)) part.comes.set(index, together)
      else if (part.away.lengthSq() > 1e-6)
        part.comes.set(
          index,
          part.away
            .clone()
            .setLength(
              THREE.MathUtils.clamp(part.away.length() * FURTHER, least, most)
            )
        )
      else part.comes.set(index, wayIn(part.box, on))
    }
  })
}
