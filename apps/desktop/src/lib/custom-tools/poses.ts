// Where the project's own tools have the parts of the model, between them all: what
// the view draws each part from. It is not kept where React would hear of it, since it
// changes with every frame: the view is told that it changed, and draws again.
import type * as THREE from "three"

let poses: ReadonlyMap<string, THREE.Matrix4> = new Map()
const listeners = new Set<() => void>()

/** How a part is moved from where the model has it; null if it is not. */
export const posed = (partId: string) => poses.get(partId) ?? null

/** Say where the parts now are: each that is moved, by its id. */
export function pose(next: ReadonlyMap<string, THREE.Matrix4>) {
  if (next.size === 0 && poses.size === 0) return
  poses = next
  for (const listener of listeners) listener()
}

/** Hear of the parts having been moved. */
export function onPosed(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
