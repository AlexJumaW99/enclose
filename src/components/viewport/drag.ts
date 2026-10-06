// Dragging something in the model by dragging the pointer across the screen.
import * as THREE from "three"

type Size = { width: number; height: number }

/** Where a point of the scene is on the screen, in pixels from its top left. */
function onScreen(point: THREE.Vector3, camera: THREE.Camera, size: Size) {
  const seen = point.clone().project(camera)
  return new THREE.Vector2(
    ((seen.x + 1) / 2) * size.width,
    ((1 - seen.y) / 2) * size.height
  )
}

/**
 * How a line of the scene lies on the screen, at a point on it: which way it runs there,
 * and how many pixels long one of the scene's units of it is, against the same seen
 * from the side (1 from the side, towards 0 as it comes to point at the eye). Nothing,
 * if it points straight at the eye: then it has no way on the screen at all.
 */
export function seenAs(
  camera: THREE.Camera,
  size: Size,
  point: THREE.Vector3,
  way: THREE.Vector3
): { direction: THREE.Vector2; pixels: number; shortened: number } | null {
  const here = onScreen(point, camera, size)
  const across = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const pixels = onScreen(point.clone().add(across), camera, size)
    .sub(here)
    .length()
  if (pixels === 0) return null
  // a step that is small on the screen wherever the point is: a pixel, seen from the side
  const step = 1 / pixels
  const along = onScreen(
    point.clone().addScaledVector(way, step),
    camera,
    size
  ).sub(here)
  const shortened = along.length()
  if (shortened < 1e-3) return null
  return { direction: along.divideScalar(shortened), pixels, shortened }
}

/** How short on the screen a line pointing at the eye is taken to be, against side-on. */
const LEAST = 0.3

/**
 * How far along a line something is taken, for how far the pointer has gone: as far as
 * keeps it under the pointer, going by how the line lies on the screen. `way` is the
 * line's direction, one long, and `point` where on it the thing is taken hold of. What
 * comes back takes how far the pointer has moved, in pixels, and gives how far along
 * the line that is, in the scene's own measure.
 *
 * A line that points nearly at the eye barely moves on the screen however far along it
 * one goes, so the least pull would send the thing flying: it is taken to be no shorter
 * on the screen than a part of what it would be seen from the side.
 */
export function dragAlong(
  camera: THREE.Camera,
  size: Size,
  point: THREE.Vector3,
  way: THREE.Vector3
): (dx: number, dy: number) => number {
  const seen = seenAs(camera, size, point, way)
  if (!seen) return () => 0
  const { direction } = seen
  const perUnit = Math.max(seen.shortened, LEAST) * seen.pixels
  return (dx, dy) => (dx * direction.x + dy * direction.y) / perUnit
}
