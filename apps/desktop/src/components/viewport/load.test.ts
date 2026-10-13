import * as THREE from "three"
import { describe, expect, it } from "vitest"

import { eachAlone, regrouped, standInModel } from "./load"

describe("standInModel", () => {
  const cube = standInModel()

  it("is one plain cube, standing on the ground", () => {
    expect(cube.standIn).toBe(true)
    expect(cube.model.parts.map((part) => part.label)).toEqual(["Cube"])
    const [{ box, faces, solid }] = cube.parts
    expect(box.min.z).toBe(0)
    expect(box.getSize(new THREE.Vector3()).toArray()).toEqual([40, 40, 40])
    expect(faces).toBe(6)
    expect(solid).toBe(true)
  })

  it("has its faces known apart, two triangles to each", () => {
    const [{ skins }] = cube.parts
    expect([...skins[0].faceOf]).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })

  it("is given room in the view, and not framed as closely as a model is", () => {
    const [{ box }] = cube.parts
    expect(cube.box.containsBox(box)).toBe(true)
    expect(cube.box.getSize(new THREE.Vector3()).x).toBeGreaterThan(
      box.getSize(new THREE.Vector3()).x
    )
  })

  it("has nothing to hand out, and nowhere to come apart to", () => {
    expect(cube.model.downloads).toEqual([])
    expect(cube.further).toBe(false)
    expect(cube.parts[0].away.length()).toBe(0)
  })
})

describe("eachAlone", () => {
  /** The cube as two parts of one piece: pulled apart together, and each its own way. */
  const model = () => {
    const cube = standInModel()
    const [part] = cube.parts
    const together = new THREE.Vector3(0, 0, 30)
    return {
      ...cube,
      further: true,
      parts: [
        { ...part, away: together, alone: new THREE.Vector3(0, 0, 45) },
        { ...part, away: together, alone: together },
      ],
    }
  }

  it("pulls each part its own way, where the model can be pulled further", () => {
    const apart = eachAlone(model())
    expect(apart.parts.map((part) => part.away.z)).toEqual([45, 30])
  })

  it("leaves a part that goes the same way either way as it is", () => {
    const whole = model()
    expect(eachAlone(whole).parts[1]).toBe(whole.parts[1])
  })

  it("leaves a model that comes apart no further as it is", () => {
    const whole = { ...model(), further: false }
    expect(eachAlone(whole)).toBe(whole)
  })
})

describe("regrouped", () => {
  const cube = standInModel()
  const groups = [
    { id: "case", label: "Case", shell: true },
    { id: "inside", label: "Inside", shell: false },
  ]

  it("lists the parts under the groups they are put in", () => {
    const moved = regrouped(cube, groups, new Map([["stand-in", "case"]]))
    expect(moved.model.groups).toBe(groups)
    expect(moved.model.parts[0].group).toBe("case")
    expect(moved.parts[0].part).toBe(moved.model.parts[0])
    // (and what was loaded of the part is the same)
    expect(moved.parts[0].skins).toBe(cube.parts[0].skins)
  })

  it("leaves a part that is not moved as it was", () => {
    const same = regrouped(
      cube,
      [{ id: "stand-in", label: "Cube", shell: false }],
      new Map()
    )
    expect(same.model.parts[0]).toBe(cube.model.parts[0])
    expect(same.parts[0].part).toBe(cube.parts[0].part)
  })

  it("changes nothing of the model it was given", () => {
    regrouped(cube, groups, new Map([["stand-in", "inside"]]))
    expect(cube.model.parts[0].group).toBe("stand-in")
    expect(cube.model.groups[0].id).toBe("stand-in")
  })
})
