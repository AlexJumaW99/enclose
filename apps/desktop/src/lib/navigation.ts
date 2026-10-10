// What a mouse's buttons do to the view. Every program for working in three dimensions
// has its own way with them, and a hand that has learned one is slow to learn another:
// so each button can be set by itself, or all of them at once to how another program has
// them. The main button is not among them: it picks parts out.

/** What a drag does to the view. */
export type Drag = "turn" | "pan" | "zoom"

/** The buttons that move the view. */
export type Button = "middle" | "right"

/** The keys that change what a drag does, held as it starts. */
export type Held = { shift: boolean; ctrl: boolean }

export type Buttons = {
  /** a drag with the middle button, which is the wheel pressed down */
  middle: Drag
  /** a drag with the right button */
  right: Exclude<Drag, "zoom">
  /** a drag with either of them, with Shift held */
  shift: Drag
  /** and with Ctrl held */
  ctrl: Drag
}

export type Preset = "enclose" | "blender" | "fusion" | "onshape" | "solidworks"

/**
 * The buttons as programs have them. Those that give the right button to a menu of their
 * own (Blender, Fusion, SolidWorks) keep it for turning here, where there is no such menu
 * for it to bring up. Fusion zooms with both keys held, as every one of these does here.
 */
export const PRESETS: Record<Preset, Buttons> = {
  enclose: { middle: "zoom", right: "turn", shift: "pan", ctrl: "zoom" },
  blender: { middle: "turn", right: "turn", shift: "pan", ctrl: "zoom" },
  fusion: { middle: "pan", right: "turn", shift: "turn", ctrl: "zoom" },
  onshape: { middle: "pan", right: "turn", shift: "pan", ctrl: "pan" },
  solidworks: { middle: "turn", right: "turn", shift: "zoom", ctrl: "pan" },
}

/** What each is called, in the order they are offered. */
export const PRESET_WORDS: Record<Preset, string> = {
  enclose: "Enclose",
  blender: "Blender",
  fusion: "Fusion",
  onshape: "Onshape",
  solidworks: "SolidWorks",
}

const KEYS = ["middle", "right", "shift", "ctrl"] as const

/** Whose buttons these are: null when they are nobody's but the user's own. */
export function presetOf(buttons: Buttons): Preset | null {
  const names = Object.keys(PRESETS) as Preset[]
  return (
    names.find((name) =>
      KEYS.every((key) => PRESETS[name][key] === buttons[key])
    ) ?? null
  )
}

/**
 * What a drag with a button does, with the keys that are held. A key says what it does
 * whichever the button, and both keys together zoom.
 */
export function dragOf(buttons: Buttons, button: Button, held: Held): Drag {
  if (held.shift && held.ctrl) return "zoom"
  if (held.shift) return buttons.shift
  if (held.ctrl) return buttons.ctrl
  return buttons[button]
}

/** A drag with a button, with a key held or with none. */
export type Way = { button: Button; held: "shift" | "ctrl" | null }

/**
 * Every way there is to turn the view with a drag, to pan it and to zoom it: with no key
 * first. A key is said once, with a button it makes a difference to: the right one, or
 * the middle one where the right one does the same without it.
 */
export function waysOf(buttons: Buttons): Record<Drag, Way[]> {
  const ways: Record<Drag, Way[]> = { turn: [], pan: [], zoom: [] }
  for (const button of ["right", "middle"] as const)
    ways[buttons[button]].push({ button, held: null })
  for (const held of ["shift", "ctrl"] as const) {
    const does = buttons[held]
    const button = (["right", "middle"] as const).find(
      (one) => buttons[one] !== does
    )
    if (button) ways[does].push({ button, held })
  }
  return ways
}
