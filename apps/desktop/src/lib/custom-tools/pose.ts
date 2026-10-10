// How a part is moved by a tool: turned about a line, or carried somewhere, from where
// the model has it. Kept as the sixteen numbers of a matrix, column by column, the way
// three.js keeps one, and worked out here in plain arithmetic: this runs where a tool
// does, shut away from the window and from three.
import type { Vec3 } from "@shared/api"

export type Pose = number[]

export const AT_HOME: Pose = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/** One move after another: `first`, and then `then`. */
export function after(then: Pose, first: Pose): Pose {
  const out = new Array<number>(16)
  for (let column = 0; column < 4; column++)
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++)
        sum += then[k * 4 + row] * first[column * 4 + k]
      out[column * 4 + row] = sum
    }
  return out
}

/** Carried this far, in mm. */
export function carrying(by: Vec3): Pose {
  const pose = AT_HOME.slice()
  pose[12] = by[0]
  pose[13] = by[1]
  pose[14] = by[2]
  return pose
}

/**
 * Turned by so many degrees about the line through `about` that runs along `axis`:
 * anticlockwise, seen from where the axis points to.
 */
export function turning(about: Vec3, axis: Vec3, degrees: number): Pose {
  const length = Math.hypot(...axis)
  if (!(length > 0)) return AT_HOME.slice()
  const [x, y, z] = axis.map((n) => n / length)
  const angle = (degrees * Math.PI) / 180
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  // the turn itself, about the origin
  const r = [
    t * x * x + c,
    t * x * y + s * z,
    t * x * z - s * y,
    t * x * y - s * z,
    t * y * y + c,
    t * y * z + s * x,
    t * x * z + s * y,
    t * y * z - s * x,
    t * z * z + c,
  ]
  const [px, py, pz] = about
  return [
    r[0],
    r[1],
    r[2],
    0,
    r[3],
    r[4],
    r[5],
    0,
    r[6],
    r[7],
    r[8],
    0,
    // and what puts the point it turns about back where it was
    px - (r[0] * px + r[3] * py + r[6] * pz),
    py - (r[1] * px + r[4] * py + r[7] * pz),
    pz - (r[2] * px + r[5] * py + r[8] * pz),
    1,
  ]
}

/** Where a point is, moved so. */
export function placed(pose: Pose, point: Vec3): Vec3 {
  const [x, y, z] = point
  return [
    pose[0] * x + pose[4] * y + pose[8] * z + pose[12],
    pose[1] * x + pose[5] * y + pose[9] * z + pose[13],
    pose[2] * x + pose[6] * y + pose[10] * z + pose[14],
  ]
}

/** Whether a part moved so is where the model has it. */
export const atHome = (pose: Pose) =>
  pose.every((n, index) => Math.abs(n - AT_HOME[index]) < 1e-9)
