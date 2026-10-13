import * as THREE from "three"
import { afterEach, describe, expect, it, vi } from "vitest"

import { onPosed, pose, posed } from "./poses"

const moved = new THREE.Matrix4().makeTranslation(0, 0, 20)

afterEach(() => pose(new Map()))

describe("the poses", () => {
  it("have a part where the tools put it, and any other where the model has it", () => {
    expect(posed("lid")).toBeNull()
    pose(new Map([["lid", moved]]))
    expect(posed("lid")).toBe(moved)
    expect(posed("base")).toBeNull()
  })

  it("tell whoever listens that the parts were moved, until it stops listening", () => {
    const heard = vi.fn()
    const stop = onPosed(heard)
    pose(new Map([["lid", moved]]))
    pose(new Map([["lid", moved.clone()]]))
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
    pose(new Map())
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it("say nothing of no part being moved when none was", () => {
    const heard = vi.fn()
    const stop = onPosed(heard)
    pose(new Map())
    expect(heard).not.toHaveBeenCalled()
    // (put back where the model has them, they were moved: that is said)
    pose(new Map([["lid", moved]]))
    pose(new Map())
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
  })
})
