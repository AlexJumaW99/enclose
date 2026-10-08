// How a model comes apart when it does not say how. Pulled apart part by part, a circuit
// board sheds its components and a switch its pins, which are one object to whoever made
// the model and are in one group for that. So the parts of a group that touch one another
// go as one piece. What still comes apart part by part is the outside of the thing, which
// has to for the inside to be seen, and whatever was never put in a group of its own.
//
// A piece is one object to whoever picks things out of the model too. A click on a part
// picks out the piece it is of, and a box drawn across the view takes in the whole of
// every piece it takes in any of. (The one part is got at with Shift.)
//
// Each piece goes straight out from the middle of the model, by where it is itself. That
// alone leaves what sits inside something else still inside it: a board in the shell it
// is screwed to, one ring within another. So any two pieces left in one another are then
// moved clear, the way that takes the least moving, which for things laid one on another
// is up and down.
//
// Where a piece is, for this, is where the stuff of it is, not the middle of the box
// round it. A shell is a floor with walls: the middle of its box is in the air over the
// floor, and a board lying on the floor is under that. Going by the boxes, the board
// would be taken for the lower of the two and sent down through the floor.
import * as THREE from "three"

/** The group the exporter puts parts in that were given none (kit/enclose.py). */
const NO_GROUP = "parts"
/**
 * How near two parts have to come to count as touching, in mm: this much, or for a
 * large model this share of how far it is across. Parts that are fitted together are
 * seldom drawn quite touching.
 */
const TOUCH = { least: 0.3, share: 0.002 }

/**
 * Which piece each part is of when the model is pulled apart: a number, which the parts
 * of one piece share. `box` is where a part is in the model, and `across` how far the
 * model is from corner to corner. Parts are taken for touching when the boxes round them
 * do, which is more often than the parts themselves: where that is wrong, more of a
 * group goes together than might, and never less.
 */
export function piecesOf(
  parts: { group: string; box: THREE.Box3 }[],
  groups: { id: string; shell: boolean }[],
  across: number
): number[] {
  const piece = parts.map((_, index) => index)
  // a model all in one group has not been grouped at all
  if (new Set(parts.map((part) => part.group)).size < 2) return piece
  const loose = new Set(
    groups.filter((group) => group.shell).map((group) => group.id)
  ).add(NO_GROUP)

  const of = (index: number): number => {
    while (piece[index] !== index) {
      piece[index] = piece[piece[index]]
      index = piece[index]
    }
    return index
  }
  const reach = Math.max(TOUCH.least, across * TOUCH.share)
  const near = new THREE.Box3()
  parts.forEach((part, index) => {
    if (loose.has(part.group)) return
    near.copy(part.box).expandByScalar(reach)
    for (let other = index + 1; other < parts.length; other++)
      if (
        parts[other].group === part.group &&
        near.intersectsBox(parts[other].box)
      )
        piece[of(other)] = of(index)
  })
  return parts.map((_, index) => of(index))
}

/**
 * Some parts with the rest of the pieces they are of: what a box drawn across the view
 * picks out, having taken those in. `parts` is every part of the model with the piece it
 * is of, and what comes back is in the order the model has them.
 */
export function wholeOf<Id>(
  parts: { id: Id; piece: number }[],
  ids: Id[]
): Id[] {
  const wanted = new Set(ids)
  const pieces = new Set(
    parts.filter((part) => wanted.has(part.id)).map((part) => part.piece)
  )
  return parts.filter((part) => pieces.has(part.piece)).map((part) => part.id)
}

/**
 * The piece a part is of, for when that is what is picked out and not the part: what it
 * goes by, and its parts. Null for a part that is a piece by itself. A piece that is the
 * whole of its group goes by the group's name. One that is only some of the group has
 * no name of its own, and goes by that of the part of it that is furthest across, which
 * is what the rest sits on more often than not, and by how many more there are.
 */
export function pieceWith<Id>(
  parts: {
    id: Id
    label: string
    group: string
    piece: number
    /** how far the part is from corner to corner */
    across: number
  }[],
  groups: { id: string; label: string }[],
  id: Id
): { label: string; parts: Id[] } | null {
  const picked = parts.find((part) => part.id === id)
  if (!picked) return null
  const whole = parts.filter((part) => part.piece === picked.piece)
  if (whole.length < 2) return null
  const group = groups.find((one) => one.id === picked.group)
  const all =
    whole.length === parts.filter((part) => part.group === picked.group).length
  const widest = whole.reduce((a, b) => (b.across > a.across ? b : a))
  return {
    label:
      all && group
        ? group.label
        : `${widest.label} and ${whole.length - 1} more`,
    parts: whole.map((part) => part.id),
  }
}

type Axis = "x" | "y" | "z"
const AXES: Axis[] = ["x", "y", "z"]
/**
 * How far one piece is left from another it was moved clear of, as a share of how far
 * the model is across.
 */
const CLEAR = 0.03
/**
 * Things are taken apart up and down, when that is about as good a way as another: a
 * move that way counts for this much of itself, when the least move is looked for.
 */
const UPRIGHT = 0.7
/** How many times over the pieces are gone through, at the most, for any still in one another. */
const ROUNDS = 8
/** More pieces than this are only sent straight out: every two of them cannot be gone through. */
const MOST = 1500

/** `high` is to go this much further along an axis than `low` does. */
type Need = { low: number; high: number; by: number }

/**
 * How far each of some pieces has to move along one axis for every need to be met, with
 * the least moving: `at` is where each is along it now. Pieces that needs tie together
 * move about the one of them nearest the `middle`, which stays where it is.
 */
function settle(needs: Need[], at: number[], middle: number): number[] {
  const by = at.map(() => 0)
  const tied = at.map((_, index) => index)
  const of = (index: number): number => {
    while (tied[index] !== index) {
      tied[index] = tied[tied[index]]
      index = tied[index]
    }
    return index
  }
  const onto = new Map<number, Need[]>()
  for (const need of needs) {
    tied[of(need.high)] = of(need.low)
    onto.set(need.high, [...(onto.get(need.high) ?? []), need])
  }
  // the lower first: by the time a piece is come to, all it has to clear are settled
  const order = [...onto.keys()].sort((a, b) => at[a] - at[b] || a - b)
  for (const index of order)
    for (const need of onto.get(index)!)
      by[index] = Math.max(by[index], by[need.low] + need.by)
  // each lot of them about its own middle one
  const stays = new Map<number, number>()
  at.forEach((where, index) => {
    const lot = of(index)
    const kept = stays.get(lot)
    if (
      kept === undefined ||
      Math.abs(where + by[index] - middle) <
        Math.abs(at[kept] + by[kept] - middle)
    )
      stays.set(lot, index)
  })
  return by.map((far, index) => far - by[stays.get(of(index))!])
}

/** A piece as it stands in the model: the box round it, and where the stuff of it is. */
export type Piece = { box: THREE.Box3; centre: THREE.Vector3 }

/**
 * Where each piece goes when the model is pulled apart to its own distances: out from
 * the `middle` by where it is itself, and then clear of any other piece it is still in.
 * `across` is how far the model is from corner to corner. Pulled further apart than
 * that, pieces only get further from one another.
 */
export function waysOut(
  pieces: Piece[],
  middle: THREE.Vector3,
  across: number
): THREE.Vector3[] {
  const ways = pieces.map((piece) => piece.centre.clone().sub(middle))
  if (pieces.length < 2 || pieces.length > MOST) return ways
  const clear = across * CLEAR
  for (let round = 0; round < ROUNDS; round++) {
    const moved = pieces.map((piece, index) =>
      piece.box.clone().translate(ways[index])
    )
    const centres = pieces.map((piece, index) =>
      piece.centre.clone().add(ways[index])
    )
    const needs: Record<Axis, Need[]> = { x: [], y: [], z: [] }
    let any = false
    for (let a = 0; a < moved.length; a++)
      for (let b = a + 1; b < moved.length; b++) {
        if (!moved[a].intersectsBox(moved[b])) continue
        // the way that parts these two with the least moving, each staying on the side
        // of the other that it is on
        let least: (Need & { axis: Axis; cost: number }) | null = null
        for (const axis of AXES) {
          const [low, high] =
            centres[a][axis] <= centres[b][axis] ? [a, b] : [b, a]
          const by = moved[low].max[axis] - moved[high].min[axis] + clear
          const cost = by * (axis === "z" ? UPRIGHT : 1)
          if (!least || cost < least.cost) least = { axis, low, high, by, cost }
        }
        if (!least) continue
        needs[least.axis].push(least)
        any = true
      }
    if (!any) break
    for (const axis of AXES) {
      if (needs[axis].length === 0) continue
      const by = settle(
        needs[axis],
        centres.map((centre) => centre[axis]),
        middle[axis]
      )
      ways.forEach((way, index) => {
        way[axis] += by[index]
      })
    }
  }
  return ways
}
