// The colours parts are drawn in: the whole round of colour, each of them light, and one
// grey. They are few and of a kind, so that whatever is on screen goes together, in the
// dark theme and the light. A model names them; any other colour it gives is drawn as
// the nearest of them (see src/lib/palette.ts).

export const PALETTE = {
  red: "#f19c9a",
  orange: "#f7cd9e",
  yellow: "#fdf6a3",
  lime: "#cffda2",
  green: "#b0fcc2",
  cyan: "#b0fcfe",
  blue: "#9eb7f9",
  indigo: "#a398f8",
  violet: "#d69af9",
  pink: "#f19cc9",
  grey: "#4b4b4b",
} as const

export type PaletteName = keyof typeof PALETTE

export const PALETTE_NAMES = Object.keys(PALETTE) as PaletteName[]
