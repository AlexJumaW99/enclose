// The light from under the model: the same in the view and in the pictures drawn of it
// off screen.
//
// The model is lit from above, the way things are: a sun to one side, a fainter light
// from the other, and the sky. Seen from below it would be in its own shadow, and what
// faces down all one dull grey. So there is a light under it too, which is out for as
// long as the model is looked down on or along, and comes up as the camera goes under
// it. From above nothing is changed by it; from straight below, what faces down is
// about as light as what faces up is from straight above.
import * as THREE from "three"

/**
 * How strong it is at its most, and how far up the camera has to be looking for that:
 * as the height of where it looks, of a length of one. It comes up evenly from level.
 */
const UNDER = { most: 1.8, by: 0.5 }

/** It shines straight up, so that it falls only on what faces down. */
export const UNDER_FROM: [number, number, number] = [0, -1, 0]

const looking = new THREE.Vector3()

/** How strong the light from under is for a camera, by how far it looks up from below. */
export function underlit(camera: THREE.Camera): number {
  const up = camera.getWorldDirection(looking).y
  return UNDER.most * THREE.MathUtils.smoothstep(up, 0, UNDER.by)
}
