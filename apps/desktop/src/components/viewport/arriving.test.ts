import * as THREE from "three"
import { describe, expect, it } from "vitest"

import { lightAt, newIn, wayAcross } from "./arriving"

describe("newIn", () => {
  it("finds the parts a model has that the one before it had not", () => {
    expect(newIn(new Set(["base", "lid"]), ["base", "button", "lid"])).toEqual([
      "button",
    ])
  })

  it("finds none where a model was only changed, or lost parts", () => {
    expect(newIn(new Set(["base", "lid"]), ["base", "lid"])).toEqual([])
    expect(newIn(new Set(["base", "lid"]), ["base"])).toEqual([])
  })

  it("takes every part for new after a model that had none", () => {
    expect(newIn(new Set(), ["base", "lid"])).toEqual(["base", "lid"])
  })
})

describe("lightAt", () => {
  it("begins short of the parts, with the line round them whole", () => {
    const { front, left } = lightAt(0)
    expect(front).toBeLessThan(0)
    expect(left).toBe(1)
  })

  it("is across them by the time the camera sets off", () => {
    expect(lightAt(0.3).front).toBeLessThan(1)
    expect(lightAt(520 / 900).front).toBeGreaterThan(1)
  })

  it("ends well past them, with nothing left", () => {
    const { front, left } = lightAt(1)
    expect(front).toBeGreaterThan(1.5)
    expect(left).toBe(0)
  })

  it("only ever goes on", () => {
    let last = lightAt(0)
    for (let gone = 0.05; gone <= 1; gone += 0.05) {
      const now = lightAt(gone)
      expect(now.front).toBeGreaterThan(last.front)
      expect(now.left).toBeLessThanOrEqual(last.left)
      last = now
    }
  })

  it("stays where it ends, however long after it is asked", () => {
    expect(lightAt(3)).toEqual(lightAt(1))
    expect(lightAt(-1)).toEqual(lightAt(0))
  })
})

describe("wayAcross", () => {
  const size = { x: 800, y: 600 }
  /** A camera ten away down z from the middle of things, looking at it. */
  function camera() {
    const made = new THREE.PerspectiveCamera(30, size.x / size.y, 0.1, 100)
    made.position.set(0, 0, 10)
    made.lookAt(0, 0, 0)
    made.updateMatrixWorld()
    return made
  }
  /** The corners of a box this far each way from a place. */
  function corners(at: [number, number, number], half: number) {
    return [-1, 1].flatMap((x) =>
      [-1, 1].flatMap((y) =>
        [-1, 1].map(
          (z) =>
            new THREE.Vector3(
              at[0] + x * half,
              at[1] + y * half,
              at[2] + z * half
            )
        )
      )
    )
  }
  /** Where a place in the world is in the picture, in pixels from its lower left. */
  function seen(place: THREE.Vector3, from: THREE.Camera) {
    const { x, y } = place.clone().project(from)
    return { x: ((x + 1) / 2) * size.x, y: ((y + 1) / 2) * size.y }
  }
  const across = (way: THREE.Vector3, at: { x: number; y: number }) =>
    at.x * way.x + at.y * way.y - way.z

  it("goes from one side of what it is given to the other, and no further", () => {
    const from = camera()
    const box = corners([1, 0.5, 0], 0.5)
    const way = wayAcross(box, from, size, 0, new THREE.Vector3())
    const each = box.map((corner) => across(way, seen(corner, from)))
    expect(Math.min(...each)).toBeCloseTo(0)
    expect(Math.max(...each)).toBeCloseTo(1)
  })

  it("goes to the right, and down where it leans", () => {
    const from = camera()
    const box = corners([0, 0, 0], 1)
    const level = wayAcross(box, from, size, 0, new THREE.Vector3())
    expect(level.x).toBeGreaterThan(0)
    expect(level.y).toBeCloseTo(0)
    const leaning = wayAcross(box, from, size, 0.35, new THREE.Vector3())
    expect(leaning.x).toBeGreaterThan(0)
    expect(leaning.y).toBeLessThan(0)
  })

  it("goes across the whole view for what reaches behind the camera", () => {
    const from = camera()
    const way = wayAcross(
      corners([0, 0, 9], 2),
      from,
      size,
      0,
      new THREE.Vector3()
    )
    expect(across(way, { x: 0, y: 300 })).toBeCloseTo(0)
    expect(across(way, { x: 800, y: 300 })).toBeCloseTo(1)
  })

  it("goes no further than the view's edges for what reaches past them", () => {
    const from = camera()
    const way = wayAcross(
      corners([0, 0, 0], 40),
      from,
      size,
      0,
      new THREE.Vector3()
    )
    expect(across(way, { x: 0, y: 300 })).toBeCloseTo(0)
    expect(across(way, { x: 800, y: 300 })).toBeCloseTo(1)
  })
})
