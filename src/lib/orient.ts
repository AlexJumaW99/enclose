// The model's three axes, and the handful of turns the view tools need between them.
// Everything here is in the model's own frame: millimetres, Z up.
import * as THREE from "three"

import type { Vec3 } from "@shared/api"

export type Axis = "x" | "y" | "z"
export type Sign = 1 | -1
export type Turn = [x: number, y: number, z: number, w: number]

export const AXES: Axis[] = ["x", "y", "z"]
export const UNIT: Record<Axis, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
}

/** The axis a direction lies most nearly along, which way, and whether it is square on. */
export function nearestAxis(direction: Vec3): {
  axis: Axis
  sign: Sign
  exact: boolean
} {
  const length = Math.hypot(...direction) || 1
  const index = [0, 1, 2].reduce((best, i) =>
    Math.abs(direction[i]) > Math.abs(direction[best]) ? i : best
  )
  const along = direction[index] / length
  // within about a degree and a half
  return {
    axis: AXES[index],
    sign: along < 0 ? -1 : 1,
    exact: Math.abs(along) > 0.9997,
  }
}

/** The turn that carries +Z to point along an axis. */
export function turnTo(axis: Axis, sign: Sign): Turn {
  const to = new THREE.Vector3(...UNIT[axis]).multiplyScalar(sign)
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    to
  )
  return [q.x, q.y, q.z, q.w]
}

/** Where +Z ends up after a turn. */
export function normalOf(turn: Turn): Vec3 {
  const v = new THREE.Vector3(0, 0, 1).applyQuaternion(
    new THREE.Quaternion(...turn)
  )
  return [v.x, v.y, v.z]
}

/**
 * The camera angles for looking at the model from the end of one of its axes: the angle
 * round the vertical, and the angle down from straight above, as three.js measures them
 * (its vertical is Y, so the model's Z).
 */
const TOP = { azimuth: 0, polar: 0 }

export function viewFrom(
  axis: Axis,
  sign: Sign
): { azimuth: number; polar: number } {
  // From above, the model's back is at the top of the view. From below it still is: the
  // model is turned over sideways, the way a thing in the hand is, not end over end.
  if (axis === "z") return sign > 0 ? TOP : { azimuth: Math.PI, polar: Math.PI }
  if (axis === "x") return { azimuth: (sign * Math.PI) / 2, polar: Math.PI / 2 }
  // the model's +Y is three.js's -Z
  return { azimuth: sign > 0 ? Math.PI : 0, polar: Math.PI / 2 }
}

/** `to`, shifted by whole turns to be as near `from` as it can get: the short way round. */
export function nearestTurn(from: number, to: number): number {
  const full = Math.PI * 2
  return from + ((((to - from + Math.PI) % full) + full) % full) - Math.PI
}

/**
 * The set views, in the order of their shortcuts: Cmd+2 is the first. (Cmd+1 is the view
 * a model opens with, which is not along an axis.) Front is the model's -Y side.
 */
export const VIEWS: { name: string; axis: Axis; sign: Sign }[] = [
  { name: "Front", axis: "y", sign: -1 },
  { name: "Back", axis: "y", sign: 1 },
  { name: "Top", axis: "z", sign: 1 },
  { name: "Bottom", axis: "z", sign: -1 },
  { name: "Right", axis: "x", sign: 1 },
  { name: "Left", axis: "x", sign: -1 },
]
