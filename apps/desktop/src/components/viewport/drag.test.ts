import * as THREE from "three"
import { describe, expect, it } from "vitest"

import { dragAlong, seenAs } from "./drag"

const size = { width: 800, height: 600 }

/** A camera 10 back from the middle of the scene, looking at it. */
function camera() {
  const made = new THREE.PerspectiveCamera(
    30,
    size.width / size.height,
    0.1,
    100
  )
  made.position.set(0, 0, 10)
  made.lookAt(0, 0, 0)
  made.updateMatrixWorld()
  made.updateProjectionMatrix()
  return made
}
/** How many pixels one of the scene's units is, at the middle of the scene. */
const perUnit = size.height / (2 * 10 * Math.tan((15 * Math.PI) / 180))
const middle = new THREE.Vector3()

describe("dragAlong", () => {
  it("takes a thing as far as the pointer goes, along a line seen from the side", () => {
    const along = dragAlong(camera(), size, middle, new THREE.Vector3(1, 0, 0))
    expect(along(perUnit, 0)).toBeCloseTo(1, 3)
    expect(along(-2 * perUnit, 0)).toBeCloseTo(-2, 3)
  })

  it("counts only what the pointer goes along the line, not across it", () => {
    const along = dragAlong(camera(), size, middle, new THREE.Vector3(1, 0, 0))
    expect(along(0, 250)).toBeCloseTo(0, 6)
  })

  it("knows up the screen from down it", () => {
    const along = dragAlong(camera(), size, middle, new THREE.Vector3(0, 1, 0))
    // up the scene is up the screen, where pixels count downwards
    expect(along(0, -perUnit)).toBeCloseTo(1, 3)
  })

  it("does not send a thing flying along a line that points nearly at the eye", () => {
    const nearly = new THREE.Vector3(0.05, 0, 1).normalize()
    const along = dragAlong(camera(), size, middle, nearly)
    // seen so, the line is a twentieth as long on the screen: it is taken for 0.3
    expect(Math.abs(along(perUnit, 0))).toBeLessThan(1 / 0.29)
  })

  it("goes nowhere along a line that points straight at the eye", () => {
    const along = dragAlong(camera(), size, middle, new THREE.Vector3(0, 0, 1))
    expect(along(300, 200)).toBe(0)
  })
})

describe("seenAs", () => {
  it("says which way a line runs on the screen, and how long it is there", () => {
    const seen = seenAs(camera(), size, middle, new THREE.Vector3(0, 1, 0))!
    expect(seen.direction.x).toBeCloseTo(0, 6)
    expect(seen.direction.y).toBeCloseTo(-1, 6)
    expect(seen.pixels).toBeCloseTo(perUnit, 3)
    expect(seen.shortened).toBeCloseTo(1, 3)
  })

  it("finds a line leaning away from the eye shorter, and still which way it goes", () => {
    const leaning = new THREE.Vector3(1, 0, -1).normalize()
    const seen = seenAs(camera(), size, middle, leaning)!
    expect(seen.direction.x).toBeCloseTo(1, 3)
    expect(seen.shortened).toBeGreaterThan(0.6)
    expect(seen.shortened).toBeLessThan(0.8)
  })

  it("has nothing to say of one that points straight at the eye", () => {
    expect(
      seenAs(camera(), size, middle, new THREE.Vector3(0, 0, 1))
    ).toBeNull()
  })
})
