// What the user has chosen about how the view answers the hand, and how the window lays
// out what it shows. These are the window's own, kept in its storage; what the app's own
// process has to know (where new projects go) is kept by that process instead.
import { create } from "zustand"

import { SETTLE_DAYS } from "@/lib/conversations"

/** auto: told apart by how the scroll moves. Or always the one, or always the other. */
export type Scrolling = "auto" | "trackpad" | "wheel"

/** What a length is said in: millimetres, or inches. */
export type Unit = "mm" | "in"

export type Preferences = {
  /** what a scroll is taken to come from */
  scrolling: Scrolling
  /** how fast the view turns under the hand, against the speed it comes with */
  turnSpeed: number
  /** how many days a conversation is left alone before it goes under its project's card */
  settleDays: number
  /** what the lengths written on a blueprint are in */
  units: Unit
}

export const TURN_SPEED = { min: 0.4, max: 2.5 }
const DEFAULTS: Preferences = {
  scrolling: "auto",
  turnSpeed: 1,
  settleDays: SETTLE_DAYS.initial,
  units: "mm",
}
const KEY = "enclose:preferences"

function saved(): Preferences {
  try {
    const read = JSON.parse(
      localStorage.getItem(KEY) ?? "{}"
    ) as Partial<Preferences>
    const scrolling =
      read.scrolling === "trackpad" || read.scrolling === "wheel"
        ? read.scrolling
        : DEFAULTS.scrolling
    const turnSpeed =
      typeof read.turnSpeed === "number" && Number.isFinite(read.turnSpeed)
        ? Math.min(TURN_SPEED.max, Math.max(TURN_SPEED.min, read.turnSpeed))
        : DEFAULTS.turnSpeed
    const settleDays =
      typeof read.settleDays === "number" && Number.isInteger(read.settleDays)
        ? Math.min(SETTLE_DAYS.max, Math.max(SETTLE_DAYS.min, read.settleDays))
        : DEFAULTS.settleDays
    const units = read.units === "in" ? "in" : DEFAULTS.units
    return { scrolling, turnSpeed, settleDays, units }
  } catch {
    return DEFAULTS
  }
}

export const usePreferences = create<
  Preferences & { change(patch: Partial<Preferences>): void }
>()((set, get) => ({
  ...saved(),
  change(patch) {
    set(patch)
    const { scrolling, turnSpeed, settleDays, units } = get()
    localStorage.setItem(
      KEY,
      JSON.stringify({ scrolling, turnSpeed, settleDays, units })
    )
  },
}))
