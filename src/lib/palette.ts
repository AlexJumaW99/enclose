// Which of the app's colours a part is drawn in, given what its model says of its colour.
import { PALETTE, type PaletteName } from "@shared/palette"

/** The colours that are colours: every one of the palette but its grey. */
const HUES = (Object.keys(PALETTE) as PaletteName[]).filter(
  (name) => name !== "grey"
)

/**
 * The colours given in turn to things that come with none of their own, such as the
 * groups of a model that leaves colour out: each as unlike the one before as can be.
 */
const IN_TURN: PaletteName[] = [
  "blue",
  "orange",
  "green",
  "pink",
  "cyan",
  "yellow",
  "violet",
  "lime",
  "red",
  "indigo",
]

/** How little colour a colour can have, of 1, and still be one: under it, it is a grey. */
const GREY_UNDER = 0.12

/** "#rrggbb" as red, green and blue, each 0 to 1; nothing, if it is not that. */
function parts(hex: string): [number, number, number] | null {
  const found = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!found) return null
  const value = parseInt(found[1], 16)
  return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

/** Where round the circle of colour a colour is, in degrees; nothing, for a grey. */
function hueOf([r, g, b]: [number, number, number]): number | null {
  const most = Math.max(r, g, b)
  const spread = most - Math.min(r, g, b)
  if (spread < GREY_UNDER) return null
  const sixth =
    most === r
      ? ((g - b) / spread) % 6
      : most === g
        ? (b - r) / spread + 2
        : (r - g) / spread + 4
  return (sixth * 60 + 360) % 360
}

const HUE_AT = HUES.map((name) => ({
  name,
  at: hueOf(parts(PALETTE[name])!)!,
}))

/**
 * The colour a thing is drawn in. `given` is what its model says: one of the palette's
 * names, or "#rrggbb", or nothing. A name is that colour. Any other colour is drawn as
 * the colour of the palette nearest it round the circle, unless it is a grey (or white,
 * or black), which is left as it is: greys are not what the palette is for. And a thing
 * with no colour given takes the palette's colours in turn, by `turn`.
 */
export function drawnIn(given: string | null, turn: number): string {
  if (given === null) return PALETTE[IN_TURN[turn % IN_TURN.length]]
  const named = given.trim().toLowerCase()
  if (named in PALETTE) return PALETTE[named as PaletteName]
  const colour = parts(given)
  // not a colour this can read: left to whatever draws it
  if (!colour) return given
  const hue = hueOf(colour)
  if (hue === null) return given
  const apart = (at: number) =>
    Math.min(Math.abs(at - hue), 360 - Math.abs(at - hue))
  const nearest = HUE_AT.reduce((a, b) => (apart(b.at) < apart(a.at) ? b : a))
  return PALETTE[nearest.name]
}
