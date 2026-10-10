// Where a curved face may show its outline.
//
// A face that bends has no edge of its own where it turns away from the eye: the side of
// a cylinder, seen from the side, ends at nothing the CAD drew. Its outline runs along
// the lines between its triangles instead, and which of those it is depends on where it
// is looked at from. So each such line is kept with the way its two triangles face, and
// what draws them shows only the ones with one triangle facing the eye and one away.

/** The lines of a part's surfaces that may turn out to be its outline, as they are drawn. */
export type Contours = {
  /** x1 y1 z1 x2 y2 z2 per line, model mm */
  ends: Float32Array
  /** for each line, the way each of the two triangles that meet at it faces: 3 + 3 */
  ways: Float32Array
}

/** Triangles nearer than this to lying in one plane, in degrees, never part at an outline. */
const FLAT = 0.25
/** Two points nearer than this, in mm, are one. */
const GRAIN = 1e-4

/**
 * Which points are the same point. A mesh writes a point once for each face that has a
 * corner at it; here every writing of it, in any of the lists, gets the one number.
 */
export function weld(lists: ArrayLike<number>[]): {
  /** for each list, the number of each of its points */
  ids: Uint32Array[]
  /** how many different points there are */
  count: number
} {
  const known = new Map<string, number>()
  const ids = lists.map((position) => {
    const welded = new Uint32Array(position.length / 3)
    for (let i = 0; i < welded.length; i++) {
      const key = [0, 1, 2]
        .map((axis) => Math.round(position[i * 3 + axis] / GRAIN))
        .join()
      let id = known.get(key)
      if (id === undefined) known.set(key, (id = known.size))
      welded[i] = id
    }
    return welded
  })
  return { ids, count: known.size }
}

/**
 * The lines between the triangles of one mesh at which it may turn away from the eye.
 * `smooth` says whether two triangles are of one unbroken surface: where they are not,
 * the line between them is an edge in its own right and is drawn as one already.
 */
export function contoursOf(
  position: ArrayLike<number>,
  index: ArrayLike<number>,
  smooth: (triangle: number, other: number, cos: number) => boolean
): { ends: number[]; ways: number[] } {
  const {
    ids: [welded],
    count,
  } = weld([position])

  const triangles = Math.floor(index.length / 3)
  const facing = new Float64Array(triangles * 3)
  const corner = (triangle: number, which: number) =>
    index[triangle * 3 + which] * 3
  for (let t = 0; t < triangles; t++) {
    const [a, b, c] = [corner(t, 0), corner(t, 1), corner(t, 2)]
    const u = [0, 1, 2].map((axis) => position[b + axis] - position[a + axis])
    const v = [0, 1, 2].map((axis) => position[c + axis] - position[a + axis])
    const normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]
    const length = Math.hypot(...normal)
    // a triangle with no area faces no way: left at nought, it pairs with nothing
    if (length > 0)
      facing.set(
        normal.map((n) => n / length),
        t * 3
      )
  }

  const ends: number[] = []
  const ways: number[] = []
  const flat = Math.cos((FLAT * Math.PI) / 180)
  // the triangle first found at each line; -1 once the line has had its two
  const first = new Map<number, number>()
  for (let t = 0; t < triangles; t++) {
    if (
      facing[t * 3] === 0 &&
      facing[t * 3 + 1] === 0 &&
      facing[t * 3 + 2] === 0
    )
      continue
    for (let side = 0; side < 3; side++) {
      const from = corner(t, side)
      const to = corner(t, (side + 1) % 3)
      const [low, high] = [welded[from / 3], welded[to / 3]].sort(
        (a, b) => a - b
      )
      if (low === high) continue
      const line = low * count + high
      const other = first.get(line)
      if (other === undefined) {
        first.set(line, t)
        continue
      }
      first.set(line, -1)
      if (other < 0) continue
      const cos =
        facing[t * 3] * facing[other * 3] +
        facing[t * 3 + 1] * facing[other * 3 + 1] +
        facing[t * 3 + 2] * facing[other * 3 + 2]
      if (cos >= flat || !smooth(t, other, cos)) continue
      for (const point of [from, to])
        ends.push(position[point], position[point + 1], position[point + 2])
      for (const triangle of [t, other])
        ways.push(
          facing[triangle * 3],
          facing[triangle * 3 + 1],
          facing[triangle * 3 + 2]
        )
    }
  }
  return { ends, ways }
}
