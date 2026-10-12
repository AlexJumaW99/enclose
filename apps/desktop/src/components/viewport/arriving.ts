// Parts that have just come to a model: what Claude was asked to make, and has made. For
// a moment they are all light where they stand, and a light goes across them, once and
// fast, and leaves them as they are. Then the camera goes to them.
//
// Here is which parts of a model those are, where that light is from one moment to the
// next, and which way it goes across them as the camera sees them. It is drawn in the
// view (see Arrival, in scene.tsx).
import * as THREE from "three"

/**
 * The parts that have just come, the box they fill, in the model's frame, and when they
 * came: ms, as `performance.now()` has it.
 */
export type Arriving = { parts: string[]; box: THREE.Box3; at: number }

/**
 * How long their coming is shown for, ms; and how far into that the light has been
 * across them, which is when the camera sets off.
 */
export const ARRIVAL = { lasts: 900, shown: 520 }

/** The parts of a model that the one before it had not. */
export function newIn(before: ReadonlySet<string>, now: string[]): string[] {
  return now.filter((id) => !before.has(id))
}

/**
 * How far the front of the light goes, as a share of the way across the parts: from
 * short of them, so that they are all light to begin with, to well past, by when what
 * it leaves behind it has gone out.
 */
const FRONT = { from: -0.2, to: 2 }
/** How far through it all the last of it begins to go out. */
const GOING_OUT = 0.7

/**
 * Where the light is, this share of the way through: how far across the parts its front
 * has got (0 where it comes to them first, 1 where it leaves them), and how much is left
 * of what it does not take with it, the line round them. It sets off slowly, and slows
 * again once it is past.
 */
export function lightAt(gone: number): { front: number; left: number } {
  const share = THREE.MathUtils.clamp(gone, 0, 1)
  return {
    front:
      FRONT.from +
      (FRONT.to - FRONT.from) * THREE.MathUtils.smoothstep(share, 0, 1),
    left: 1 - THREE.MathUtils.smoothstep(share, GOING_OUT, 1),
  }
}

const corner = new THREE.Vector3()

/**
 * Which way the light goes across what stands at these corners, as a camera sees them,
 * and how far it has to go. For a place in the picture, in pixels from its lower left,
 * `x * way.x + y * way.y - way.z` is how far across that place is: 0 where the light
 * comes first, and 1 where it leaves last. It goes to the right and down, leaning from
 * level by `lean`, in radians. `size` is the picture's, in pixels.
 *
 * What is partly behind the camera has no such place in the picture: the light goes
 * across all of the view then, as it does where the corners reach past its edges.
 */
export function wayAcross(
  corners: THREE.Vector3[],
  camera: THREE.Camera,
  size: { x: number; y: number },
  lean: number,
  way: THREE.Vector3
): THREE.Vector3 {
  const along = { x: Math.cos(lean), y: -Math.sin(lean) }
  // the view's own corners: the light has no further to go than between these
  const reach = [
    0,
    size.x * along.x,
    size.y * along.y,
    size.x * along.x + size.y * along.y,
  ]
  const first = Math.min(...reach)
  const last = Math.max(...reach)
  let from = Infinity
  let to = -Infinity
  for (const at of corners) {
    corner.copy(at).applyMatrix4(camera.matrixWorldInverse)
    // (the camera looks down its own z, the other way)
    if (corner.z >= 0) {
      from = first
      to = last
      break
    }
    corner.applyMatrix4(camera.projectionMatrix)
    const across =
      ((corner.x + 1) / 2) * size.x * along.x +
      ((corner.y + 1) / 2) * size.y * along.y
    from = Math.min(from, across)
    to = Math.max(to, across)
  }
  from = THREE.MathUtils.clamp(from, first, last)
  // (a pixel at the least: what is too small to see is still somewhere)
  const far = Math.max(Math.min(to, last) - from, 1)
  return way.set(along.x / far, along.y / far, from / far)
}
