// What the rest of the window - and through it, Claude - can ask of the 3D view. Each
// entry is set while a model is on screen and null otherwise.
import * as React from "react"
import * as THREE from "three"

import type { Vec3 } from "@shared/api"
import type { Axis, Sign } from "@/lib/orient"

export const bridge: {
  /** the view as it is right now, as a JPEG */
  screenshot: (() => { data: string; mimeType: string }) | null
  /** every part of the model, with its size and whether it is showing */
  parts: (() => unknown[]) | null
  /** swing the camera round to look at the model from the end of one of its axes */
  lookFrom: ((axis: Axis, sign: Sign) => void) | null
  /** orbit, as a drag of this many pixels would */
  orbit: ((dx: number, dy: number) => void) | null
  /** where the camera is from what it looks at, as a direction in the model's frame */
  eye: (() => Vec3) | null
  /** whether the view is a flat one, with no perspective */
  flat: (() => boolean) | null
  /**
   * bring the camera to what fills this box of the model, a part of it; or, with no box,
   * take it back to where it was before
   */
  focus: ((box: THREE.Box3 | null) => void) | null
  /**
   * true while a handle in the view is being dragged, or a box drawn across it: not the
   * moment to pick the part under the pointer
   */
  handling: boolean
} = {
  screenshot: null,
  parts: null,
  lookFrom: null,
  orbit: null,
  eye: null,
  flat: null,
  focus: null,
  handling: false,
}

// How the camera is turned, for the small widgets drawn outside the 3D view that have to
// turn with it. It is the turn that carries a direction in the model's frame into the
// camera's: x to the right of the screen, y up it, z out of it.
let turn = new THREE.Quaternion()
const listeners = new Set<() => void>()

export function publishOrientation(next: THREE.Quaternion) {
  if (turn.equals(next)) return
  turn = next.clone()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The camera's orientation, kept current as it moves. */
export function useOrientation(): THREE.Quaternion {
  return React.useSyncExternalStore(subscribe, () => turn)
}

// lets a script drive the view when the app is being checked without a person at it
if (import.meta.env.DEV) Object.assign(window, { __bridge: bridge })
