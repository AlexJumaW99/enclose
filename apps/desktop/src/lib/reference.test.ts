import { describe, expect, it } from "vitest"

import {
  hasFigure,
  placed,
  readReference,
  sceneFor,
  withFigure,
  type ReferenceScene,
} from "./reference"

const scene = (
  id: string,
  given: Partial<ReferenceScene> = {}
): ReferenceScene => ({
  id,
  own: false,
  name: id,
  detail: "",
  stand: [0, 0, 0],
  against: [0, 0],
  floor: 0,
  upTo: null,
  files: [`cad-model://${id}.scene/it.glb`],
  figures: [],
  ...given,
})

const table = scene("table", { upTo: [1000, 600, 700] })
const room = scene("room")
const own = scene("own", { own: true })

describe("readReference", () => {
  it("reads a scene, with where each of its files is loaded from", () => {
    expect(
      readReference(
        {
          id: "table",
          own: false,
          baseUrl: "cad-model://table.scene/",
          manifest: {
            name: "Table",
            detail: "29″ × 58″",
            stand: [0, 0, 736.6],
            floor: 0,
            upTo: [1000, 600, 700],
            parts: [
              { id: "top", file: "top.glb" },
              { id: "legs", file: "legs.glb" },
            ],
          },
        },
        3
      )
    ).toEqual({
      id: "table",
      own: false,
      name: "Table",
      detail: "29″ × 58″",
      stand: [0, 0, 736.6],
      against: [0, 0],
      floor: 0,
      upTo: [1000, 600, 700],
      files: [
        "cad-model://table.scene/top.glb?r=3",
        "cad-model://table.scene/legs.glb?r=3",
      ],
      figures: [],
    })
  })

  it("stands a model at the scene's origin where the scene does not say", () => {
    const read = readReference({
      id: "own",
      own: true,
      baseUrl: "cad-model://abc.reference/",
      manifest: { parts: [{ file: "bench.glb" }] },
    })
    expect(read).toMatchObject({ stand: [0, 0, 0], floor: 0, upTo: null })
    expect(read?.name).toBe("This project's")
  })

  it("reads which side of a model the scene has it stand by", () => {
    const source = { id: "person", own: false, baseUrl: "cad-model://p/" }
    const parts = [{ file: "person.glb" }]
    expect(
      readReference({
        ...source,
        manifest: { stand: [450, 0, 0], against: [-1, 0], parts },
      })?.against
    ).toEqual([-1, 0])
    // nothing but a side or the middle is a way to stand
    expect(
      readReference({ ...source, manifest: { against: [3, -0.5], parts } })
        ?.against
    ).toEqual([1, -1])
    expect(
      readReference({ ...source, manifest: { against: "left", parts } })
        ?.against
    ).toEqual([0, 0])
  })

  it("is nothing where there is nothing to draw", () => {
    const source = { id: "own", own: true, baseUrl: "cad-model://abc/" }
    expect(readReference({ ...source, manifest: null })).toBeNull()
    expect(readReference({ ...source, manifest: { parts: [] } })).toBeNull()
    expect(
      readReference({ ...source, manifest: { parts: [{ id: "top" }] } })
    ).toBeNull()
  })
})

describe("withFigure", () => {
  const source = { id: "table", own: false, baseUrl: "cad-model://t/" }
  const desk = readReference({
    ...source,
    manifest: {
      parts: [
        { id: "top", file: "top.glb" },
        { id: "person", file: "person.glb", figure: true },
      ],
    },
  })!

  it("leaves the figure of a person out of a scene until it is asked for", () => {
    expect(desk.figures).toEqual(["cad-model://t/person.glb?r=0"])
    expect(withFigure(desk, false).files).toEqual(["cad-model://t/top.glb?r=0"])
    expect(hasFigure(withFigure(desk, false))).toBe(false)
    expect(withFigure(desk, true).files).toEqual(desk.files)
    expect(hasFigure(withFigure(desk, true))).toBe(true)
  })

  it("is the same scene where there is no figure to leave out", () => {
    expect(withFigure(table, false)).toBe(table)
    expect(hasFigure(table)).toBe(false)
  })

  it("takes a scene that is nothing but a figure for what it is", () => {
    const person = readReference({
      ...source,
      manifest: { parts: [{ file: "person.glb", figure: true }] },
    })!
    expect(person.figures).toEqual([])
    expect(withFigure(person, false).files).toHaveLength(1)
  })
})

describe("placed", () => {
  const model = {
    min: [-30, -20, 5] as [number, number, number],
    max: [50, 40, 25] as [number, number, number],
  }

  it("puts where a model stands under the middle of the model", () => {
    expect(placed(scene("table", { stand: [0, 0, 736.6] }), model)).toEqual([
      10,
      10,
      5 - 736.6,
    ])
  })

  it("puts it under the side the scene has the model stand by", () => {
    // what is beside the model is as far from its left side whatever its size
    const person = scene("person", { stand: [450, 0, 0], against: [-1, 0] })
    expect(placed(person, model)).toEqual([-30 - 450, 10, 5])
    const wide = { min: [-900, -20, 5], max: [900, 40, 25] } as typeof model
    expect(placed(person, wide)).toEqual([-900 - 450, 10, 5])
    expect(
      placed(scene("wall", { stand: [0, -100, 0], against: [0, 1] }), model)
    ).toEqual([10, 40 + 100, 5])
  })
})

describe("sceneFor", () => {
  const small = {
    reference: null,
    size: [60, 40, 20] as [number, number, number],
  }

  it("goes by size where nothing else says", () => {
    expect(sceneFor([table, room], small)?.id).toBe("table")
    expect(
      sceneFor([table, room], { reference: null, size: [400, 400, 1800] })?.id
    ).toBe("room")
  })

  it("takes a model either way round on its base", () => {
    expect(
      sceneFor([table, room], { reference: null, size: [500, 900, 100] })?.id
    ).toBe("table")
    expect(
      sceneFor([table, room], { reference: null, size: [700, 900, 100] })?.id
    ).toBe("room")
  })

  it("goes by what the model names before its size", () => {
    expect(
      sceneFor([table, room], { reference: "room", size: [400, 400, 450] })?.id
    ).toBe("room")
    // a scene the app does not have is no scene: back to size
    expect(
      sceneFor([table, room], { reference: "garage", size: [60, 40, 20] })?.id
    ).toBe("table")
  })

  it("shows a project's own scene before any of the app's", () => {
    expect(
      sceneFor([own, table, room], { reference: "room", size: [60, 40, 20] })
        ?.id
    ).toBe("own")
  })

  it("keeps to what the user picked, while that scene is there", () => {
    expect(sceneFor([own, table, room], small, "room")?.id).toBe("room")
    expect(sceneFor([table, room], small, "own")?.id).toBe("table")
  })

  it("is the last of the app's where a model is too big for them all", () => {
    const shed = scene("shed", { upTo: [3000, 3000, 2500] })
    expect(
      sceneFor([table, shed], { reference: null, size: [9000, 9000, 9000] })?.id
    ).toBe("shed")
    expect(sceneFor([], small)).toBeNull()
  })
})
