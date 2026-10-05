import { describe, expect, it } from "vitest"

import {
  nearestAxis,
  nearestTurn,
  normalOf,
  turnTo,
  viewFrom,
  VIEWS,
} from "./orient"

const close = (a: number[], b: number[]) =>
  a.forEach((n, i) => expect(n).toBeCloseTo(b[i], 6))

describe("nearestAxis", () => {
  it("picks the axis a direction leans on, and which way", () => {
    expect(nearestAxis([0.5, -0.62, 0.6])).toEqual({
      axis: "y",
      sign: -1,
      exact: false,
    })
    expect(nearestAxis([0, 0, 12])).toEqual({ axis: "z", sign: 1, exact: true })
    expect(nearestAxis([-3, 0.01, 0])).toEqual({
      axis: "x",
      sign: -1,
      exact: true,
    })
  })

  it("does not call a tilted direction square", () => {
    // five degrees off X
    expect(nearestAxis([Math.cos(0.087), Math.sin(0.087), 0]).exact).toBe(false)
  })
})

describe("turnTo and normalOf", () => {
  it("round-trip every axis, both ways", () => {
    close(normalOf(turnTo("x", 1)), [1, 0, 0])
    close(normalOf(turnTo("x", -1)), [-1, 0, 0])
    close(normalOf(turnTo("y", 1)), [0, 1, 0])
    close(normalOf(turnTo("y", -1)), [0, -1, 0])
    close(normalOf(turnTo("z", 1)), [0, 0, 1])
    close(normalOf(turnTo("z", -1)), [0, 0, -1])
  })
})

describe("viewFrom", () => {
  // where three.js puts a camera at these angles, turned back into the model's frame
  const eye = (azimuth: number, polar: number) => {
    const [x, y, z] = [
      Math.sin(polar) * Math.sin(azimuth),
      Math.cos(polar),
      Math.sin(polar) * Math.cos(azimuth),
    ]
    return [x, -z, y]
  }

  it("puts the camera at the end of the axis asked for", () => {
    for (const [axis, sign, at] of [
      ["x", 1, [1, 0, 0]],
      ["x", -1, [-1, 0, 0]],
      ["y", 1, [0, 1, 0]],
      ["y", -1, [0, -1, 0]],
      ["z", 1, [0, 0, 1]],
      ["z", -1, [0, 0, -1]],
    ] as const) {
      const { azimuth, polar } = viewFrom(axis, sign)
      close(eye(azimuth, polar), [...at])
    }
  })
})

describe("nearestTurn", () => {
  it("goes the short way round", () => {
    expect(nearestTurn(0.1, Math.PI * 2)).toBeCloseTo(0)
    expect(nearestTurn(Math.PI * 4 + 0.2, -Math.PI / 2)).toBeCloseTo(
      Math.PI * 4 - Math.PI / 2
    )
    expect(nearestTurn(-3, 3)).toBeCloseTo(3 - Math.PI * 2)
  })
})

describe("VIEWS", () => {
  it("lists the six flat views in the order of their shortcuts, Cmd+2 first", () => {
    expect(
      VIEWS.map((v) => `${v.name} ${v.sign > 0 ? "+" : "-"}${v.axis}`)
    ).toEqual([
      "Front -y",
      "Back +y",
      "Top +z",
      "Bottom -z",
      "Right +x",
      "Left -x",
    ])
  })
})
