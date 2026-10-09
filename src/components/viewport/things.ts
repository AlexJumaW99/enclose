// Which of the things in a reference scene each of its faces is of. A scene comes as
// faces, each a mesh of its own, as a CAD file has them: the top of a desk is a score of
// them, and so is each of its legs. Faces that share a corner are of one thing, and so
// are faces joined by way of others. It is by its things that a scene's lines are found
// (see reference.tsx): a line goes wherever one of them is seen in front of another.
//
// And whether a thing has a sharp edge anywhere on it. A desk has, where its top meets
// its side, and a line goes along each. The figure of a person has none: it is all one
// rounded surface, and gets a line only round what is seen of it, and where one part of
// it is seen in front of another.

/** How near two corners are to each other, in mm, to be one corner. */
const ONE_CORNER = 0.01
/** How far apart two faces are turned where they meet, in degrees, for that to be a sharp edge. */
const SHARP = 25

const cornerAt = (corners: ArrayLike<number>, i: number) =>
  [corners[i], corners[i + 1], corners[i + 2]]
    .map((along) => Math.round(along / ONE_CORNER))
    .join()

/**
 * Which thing each of some faces is of, numbered from 0 in the order the things are
 * first come to. A face is the corners of its mesh (x y z a corner, one long).
 */
export function thingsOf(faces: ArrayLike<number>[]): number[] {
  const of = faces.map((_, face) => face)
  const whole = (face: number) => {
    while (of[face] !== of[of[face]]) of[face] = of[of[face]]
    return of[face]
  }
  const had = new Map<string, number>()
  faces.forEach((corners, face) => {
    for (let i = 0; i < corners.length; i += 3) {
      const corner = cornerAt(corners, i)
      const other = had.get(corner)
      if (other === undefined) had.set(corner, face)
      else of[whole(face)] = whole(other)
    }
  })
  const numbered = new Map<number, number>()
  return faces.map((_, face) => {
    const one = whole(face)
    if (!numbered.has(one)) numbered.set(one, numbered.size)
    return numbered.get(one)!
  })
}

/**
 * Which of some things have a sharp edge: somewhere on them, two of their faces meet
 * turned well away from each other. `things` is which thing each face is of, and a
 * face is its corners and, for each corner, the way the surface faces there (x y z
 * each, one long): where the surface is rounded, the faces that meet at a corner agree
 * on that.
 */
export function sharpOf(
  faces: { corners: ArrayLike<number>; facing: ArrayLike<number> }[],
  things: number[]
): Set<number> {
  const least = Math.cos((SHARP * Math.PI) / 180)
  const sharp = new Set<number>()
  // the way the surface was first found to face at each corner of each thing
  const had = new Map<string, [number, number, number]>()
  faces.forEach(({ corners, facing }, face) => {
    const thing = things[face]
    for (let i = 0; i < corners.length && !sharp.has(thing); i += 3) {
      const way: [number, number, number] = [
        facing[i],
        facing[i + 1],
        facing[i + 2],
      ]
      const corner = `${thing}:${cornerAt(corners, i)}`
      const was = had.get(corner)
      if (!was) had.set(corner, way)
      else if (
        was[0] * way[0] + was[1] * way[1] + was[2] * way[2] <
        least * Math.hypot(...was) * Math.hypot(...way)
      )
        sharp.add(thing)
    }
  })
  return sharp
}
