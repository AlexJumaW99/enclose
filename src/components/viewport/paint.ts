// What colour a part is drawn in: the same in the view and in the small pictures of the
// parts list.
import * as THREE from "three"

import type { LoadedPart, Skin } from "./load"

const UNCOLOURED = "#aeb2b9"
// near-black metal would vanish on the dark theme; it goes steel instead
const STEEL = "#aab0b8"
export const EDGE = "#0e1012"

/** The colour of one of a part's skins: the manifest's, or the file's own where it has one. */
export function skinColour(
  { part }: LoadedPart,
  skin: Skin,
  dark: boolean
): THREE.Color {
  const color = new THREE.Color(part.color ?? UNCOLOURED)
  if (part.paint === "bare" && skin.color) color.copy(skin.color)
  if (part.metal && dark && color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.25)
    color.set(STEEL)
  return color
}

/** How a part's surface takes the light. */
export const finish = ({ part }: LoadedPart) => ({
  metalness: part.metal ? 0.55 : 0.1,
  roughness: part.metal ? 0.45 : 0.62,
})
