// How the drawing on a guide's cover is composed: where the thing is looked at from,
// and how it is set on the sheet.
//
// A cover is one line drawing of the thing, large, as on the cover of a manual. Whoever
// wrote the guide says where it is drawn from, which is whatever way shows it at its
// best, and which of its parts the sheet is filled with: the drawing is made as big as
// makes those fill it, and the rest of the thing runs off the sheet's edge.
import * as THREE from "three"

import type { Vec3 } from "@shared/api"
import type { Looking } from "@/components/blueprint/lines"
import {
  lookingFrom,
  SHEET,
  type Placing,
  type Seen,
} from "@/components/blueprint/sheet"
import type { LoadedPart } from "@/components/viewport/load"

/**
 * How a cover's drawing is set on its sheet, as shares of the sheet: how far down it
 * begins and how far down it ends, and how much of each side is kept clear. That is
 * nearly all of the sheet: the drawing has the sheet to itself, and what is written on
 * the cover is written over it, in the corners, and is not something it begins after.
 * It is what the cover is filled with that is kept within these: the rest of the thing
 * goes where it goes, off the sheet's edge if it comes to that.
 */
export const SET = { top: 0.07, foot: 0.97, side: 0.06 }

/** Where a thing is drawn from on its cover when its guide does not say: its front right corner, from above. */
export const FROM: Vec3 = [1, -1, 1]

/**
 * How the model is looked at from somewhere, said as the way from the model to the eye:
 * whatever way that is, since a cover is drawn from wherever the thing looks its best.
 * Straight above and straight below are a hair off, so that there is a front to them.
 */
export function lookingAt([x, y, z]: Vec3): Looking {
  const far = Math.hypot(x, y, z) || 1
  return lookingFrom({
    // round from the front, which is the model's -Y, towards its right: and a way that
    // leans neither to the front nor to the back is from the front (minus nothing
    // would be from behind)
    azimuth: Math.atan2(x, -y || 0),
    // and down from straight above
    polar: Math.min(Math.PI - 0.01, Math.max(0.01, Math.acos(z / far))),
  })
}

/** The room some parts take up as they are looked at, in the model's own measure. */
export function roomOf(
  parts: Pick<LoadedPart, "box" | "home">[],
  { right, up }: Looking
): Seen {
  const room = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
  const corner = new THREE.Vector3()
  const [across, high] = [new THREE.Vector3(...right), new THREE.Vector3(...up)]
  for (const { box, home } of parts)
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        )
        .applyMatrix4(home)
      room.x0 = Math.min(room.x0, corner.dot(across))
      room.x1 = Math.max(room.x1, corner.dot(across))
      room.y0 = Math.min(room.y0, corner.dot(high))
      room.y1 = Math.max(room.y1, corner.dot(high))
    }
  return room
}

/**
 * Where a drawing sits on the cover's sheet for what takes up `room` to fill what the
 * sheet has for it: as big as fits that room, across or down, whichever is the
 * tighter, and in the middle of it, which is a little lower on the sheet than the
 * sheet's own middle.
 */
export function setOn(room: Seen): Placing {
  const by = Math.max(
    (room.x1 - room.x0) / (SHEET.width * (1 - 2 * SET.side)),
    (room.y1 - room.y0) / (SHEET.height * (SET.foot - SET.top)),
    1e-6
  )
  return {
    middle: [
      (room.x0 + room.x1) / 2,
      (room.y0 + room.y1) / 2 +
        by * SHEET.height * ((SET.top + SET.foot) / 2 - 0.5),
    ],
    by,
    paper: SHEET,
  }
}
