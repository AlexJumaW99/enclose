// What colour a part is drawn in: the same in the view and in the small pictures of the
// parts list.
import * as THREE from "three"

import { drawnIn } from "@/lib/palette"
import type { LoadedPart, Skin } from "./load"

/** Bare metal that is given no colour. */
const UNCOLOURED = "#aeb2b9"
// near-black metal would vanish on the dark theme; it goes steel instead
const STEEL = "#aab0b8"
export const EDGE = "#0e1012"

/**
 * The colour of one of a part's skins. It is one of the app's own colours (see
 * shared/palette.ts): the one the user gave the part, or the one the model names, or the
 * nearest to the colour the model or its file gives, or, if none gives any, the one that
 * falls to the part's group. Metal is the exception, unless the user gave it a colour:
 * it is the colour of its metal.
 */
export function skinColour(
  { part, turn }: LoadedPart,
  skin: Skin,
  dark: boolean,
  /** the colour the user has given the part, if they have given it one */
  chosen: string | null = null
): THREE.Color {
  if (chosen) return new THREE.Color(drawnIn(chosen, turn))
  const ofFile =
    part.paint === "bare" && skin.color ? `#${skin.color.getHexString()}` : null
  if (part.metal) {
    const color = new THREE.Color(ofFile ?? part.color ?? UNCOLOURED)
    if (dark && color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.25) color.set(STEEL)
    return color
  }
  return new THREE.Color(drawnIn(ofFile ?? part.color, turn))
}

/** How a part's surface takes the light. */
export const finish = ({ part }: LoadedPart) => ({
  metalness: part.metal ? 0.55 : 0.1,
  roughness: part.metal ? 0.45 : 0.62,
})
