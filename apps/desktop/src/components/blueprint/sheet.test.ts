import { describe, expect, it } from "vitest"

import {
  lookingFrom,
  onSheet,
  pathOf,
  reduction,
  SHEET,
  SIDES,
  svgOf,
} from "./sheet"

const near = (got: number[], wanted: number[]) =>
  got.forEach((value, index) => expect(value).toBeCloseTo(wanted[index], 9))

describe("the sides a model is drawn from", () => {
  const side = (name: string) => SIDES.find((one) => one.name === name)!.looking

  it("are four corners and then the six set views, a sheet to each", () => {
    expect(SIDES.map((one) => one.name)).toEqual([
      "Top Left",
      "Top Right",
      "Bottom Left",
      "Bottom Right",
      "Front",
      "Back",
      "Top",
      "Bottom",
      "Left",
      "Right",
    ])
    expect(SIDES.map((one) => one.flat)).toEqual([
      ...Array<boolean>(4).fill(false),
      ...Array<boolean>(6).fill(true),
    ])
  })

  it("looks at the front from -Y, with Z up", () => {
    near(side("Front").back, [0, -1, 0])
    near(side("Front").right, [1, 0, 0])
    near(side("Front").up, [0, 0, 1])
  })

  it("looks at the right from +X, with the back to the right", () => {
    near(side("Right").back, [1, 0, 0])
    near(side("Right").right, [0, 1, 0])
    near(side("Right").up, [0, 0, 1])
  })

  it("has the model's back at the top from above and from below alike", () => {
    near(side("Top").back, [0, 0, 1])
    near(side("Top").up, [0, 1, 0])
    near(side("Top").right, [1, 0, 0])
    // turned over sideways, not end over end
    near(side("Bottom").back, [0, 0, -1])
    near(side("Bottom").up, [0, 1, 0])
    near(side("Bottom").right, [-1, 0, 0])
  })

  it("looks at a corner from the front and one side, all three sides turned alike", () => {
    const third = 1 / Math.sqrt(3)
    const half = Math.SQRT1_2
    near(side("Top Right").back, [third, -third, third])
    near(side("Top Right").right, [half, half, 0])
    near(side("Top Left").back, [-third, -third, third])
    near(side("Top Left").right, [half, -half, 0])
    near(side("Bottom Right").back, [third, -third, -third])
    near(side("Bottom Left").back, [-third, -third, -third])
    // from below as from above, the model stands the right way up
    for (const name of ["Top Left", "Top Right", "Bottom Left", "Bottom Right"])
      expect(side(name).up[2]).toBeCloseTo(Math.sqrt(2 / 3))
  })

  it("is three directions square to one another, wherever it is looked from", () => {
    const { right, up, back } = lookingFrom({ azimuth: 0.7, polar: 1.1 })
    const dot = (a: number[], b: number[]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    for (const way of [right, up, back]) expect(dot(way, way)).toBeCloseTo(1)
    expect(dot(right, up)).toBeCloseTo(0)
    expect(dot(right, back)).toBeCloseTo(0)
    expect(dot(up, back)).toBeCloseTo(0)
  })
})

describe("reduction", () => {
  it("draws life size what fits the sheet", () => {
    expect(reduction([{ width: 40, height: 40 }])).toBe(1)
    expect(reduction([{ width: 180, height: 232.5 }])).toBe(1)
    // (it is four wide to five high: what would fit a taller sheet does not fit it)
    expect(reduction([{ width: 180, height: 267 }])).toBe(2)
    expect(reduction([])).toBe(1)
  })

  it("draws smaller, by the least step that fits, what does not", () => {
    expect(reduction([{ width: 181, height: 20 }])).toBe(2)
    expect(reduction([{ width: 100, height: 600 }])).toBe(5)
    expect(reduction([{ width: 1700, height: 100 }])).toBe(10)
    expect(reduction([{ width: 3000, height: 3000 }])).toBe(20)
  })

  it("draws smaller what does not fit beside what a sheet keeps clear for names", () => {
    // 150 mm across fits a sheet 210 wide: but not with 50 kept clear at either side
    expect(reduction([{ width: 150, height: 100 }])).toBe(1)
    expect(reduction([{ width: 150, height: 100 }], { x: 50, y: 15 })).toBe(2)
  })

  it("goes by the largest of the drawings, which are all to one scale", () => {
    expect(
      reduction([
        { width: 60, height: 40 },
        { width: 400, height: 40 },
      ])
    ).toBe(5)
  })
})

describe("a drawing on its sheet", () => {
  it("has its middle at the sheet's, and up as up", () => {
    const placing = { middle: [10, 20] as [number, number], by: 2 }
    expect(onSheet(10, 20, placing)).toEqual([
      SHEET.width / 2,
      SHEET.height / 2,
    ])
    expect(onSheet(30, 40, placing)).toEqual([
      SHEET.width / 2 + 10,
      SHEET.height / 2 - 10,
    ])
  })

  it("is written as paths in millimetres of the sheet", () => {
    const placing = { middle: [0, 0] as [number, number], by: 1 }
    expect(
      pathOf({ points: [0, 0, 10, 0, 10, 5.12345], closed: false }, placing)
    ).toBe("M105 131.25L115 131.25L115 126.127")
    expect(
      pathOf({ points: [0, 0, 10, 0, 10, 10], closed: true }, placing)
    ).toBe("M105 131.25L115 131.25L115 121.25Z")
  })
})

describe("svgOf", () => {
  const stroke = { points: [0, 0, 10, 0], closed: false }
  const svg = svgOf({
    title: 'Sensor "box" <1>, front view (1:1)',
    placing: { middle: [0, 0], by: 1 },
    groups: [
      {
        id: "screws",
        label: "Screws & nuts",
        parts: [
          { id: "screws", label: "Lid screws", strokes: [stroke] },
          { id: "4 nuts", label: "Nuts", strokes: [stroke, stroke] },
          { id: "hidden", label: "Not seen from here", strokes: [] },
        ],
      },
      { id: "empty", label: "Nothing of it shows", parts: [] },
    ],
  })

  it("is a sheet four wide to five high, in millimetres", () => {
    expect(svg).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="262.5mm" viewBox="0 0 210 262.5">'
    )
    expect(svg).toContain('fill="none"')
    // a point and a half, in millimetres
    expect(svg).toContain('stroke-width="0.529"')
  })

  it("has each part's lines under its name, and its group's", () => {
    expect(svg.match(/<path /g)).toHaveLength(3)
    expect(svg).toContain("<title>Screws &#38; nuts</title>")
    expect(svg).toContain("<title>Lid screws</title>")
    // nothing is written of what has nothing to show
    expect(svg).not.toContain("Not seen from here")
    expect(svg).not.toContain("Nothing of it shows")
  })

  it("gives everything a name of its own that a file can have", () => {
    const names = [...svg.matchAll(/<g id="([^"]+)">/g)].map((m) => m[1])
    expect(names).toEqual(["screws", "screws_2", "_4_nuts"])
  })

  it("has the names of the parts in a group of their own, each with its line and its dot", () => {
    const labelled = svgOf({
      title: "Box",
      placing: { middle: [0, 0], by: 1 },
      groups: [],
      labels: [
        {
          said: "Lid & <hinge>",
          line: [36.5, 100, 39.5, 100, 60, 110],
          at: [60, 110],
          text: { x: 35, y: 101, side: "left" },
        },
        {
          said: "Base",
          line: [173.5, 120, 170.5, 120, 150, 118],
          at: [150, 118],
          text: { x: 175, y: 121, side: "right" },
        },
      ],
    })
    expect(labelled).toContain('<g id="labels"')
    // the line is of dots: no length to each, and round ends
    expect(labelled).toContain(
      '<path d="M36.5 100L39.5 100L60 110" stroke-dasharray="0 0.9"/>'
    )
    expect(labelled).toMatch(/<g id="labels"[^>]*stroke-linecap="round"/)
    expect(labelled).toContain('<circle cx="60" cy="110"')
    // a name at the left ends at the drawing's side, and one at the right begins there
    expect(labelled).toMatch(
      /<text x="35" y="101" text-anchor="end"[^>]*>Lid &#38; &#60;hinge&#62;</
    )
    expect(labelled).toMatch(
      /<text x="175" y="121" text-anchor="start"[^>]*>Base</
    )
    // (half bold: it is small, and is read against the lines of the drawing)
    expect(labelled).toMatch(/<text x="175"[^>]*font-weight="600"/)
    // and a sheet without them has no such group
    expect(
      svgOf({ title: "Box", placing: { middle: [0, 0], by: 1 }, groups: [] })
    ).not.toContain("labels")
  })

  it("says nothing a file cannot", () => {
    expect(svg).toContain(
      "<title>Sensor &#34;box&#34; &#60;1&#62;, front view (1:1)</title>"
    )
  })
})
