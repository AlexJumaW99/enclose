import * as THREE from "three"
import { describe, expect, it } from "vitest"

import { UNDER_FROM, underlit } from "./light"

/** A camera at a place, looking at the middle of the model. */
function cameraAt(x: number, y: number, z: number) {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(x, y, z)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

describe("underlit", () => {
  it("is out while the model is looked down on, or along", () => {
    expect(underlit(cameraAt(100, 80, 100))).toBe(0)
    expect(underlit(cameraAt(100, 0, 0))).toBe(0)
  })

  it("comes up as the camera goes under the model", () => {
    const little = underlit(cameraAt(100, -10, 0))
    const more = underlit(cameraAt(100, -30, 0))
    expect(little).toBeGreaterThan(0)
    expect(more).toBeGreaterThan(little)
  })

  it("is at its most well before the camera is straight below, and no more from there", () => {
    const steep = underlit(cameraAt(60, -100, 0))
    expect(steep).toBeGreaterThan(1)
    expect(underlit(cameraAt(0.001, -100, 0))).toBe(steep)
  })

  it("shines straight up, so that it falls only on what faces down", () => {
    expect(UNDER_FROM).toEqual([0, -1, 0])
  })
})
