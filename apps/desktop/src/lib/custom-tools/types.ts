// What a tool is, as the window has it: the controls it declared, as they stand, and
// what passes between the window and where the tool runs.
import type { Vec3 } from "@shared/api"
import type { PaletteName } from "@shared/palette"

/** The signs a button or an option can carry, by the names a tool gives them. */
export const ICONS = [
  "play",
  "pause",
  "stop",
  "rewind",
  "forward",
  "back",
  "next",
  "reset",
  "plus",
  "minus",
  "up",
  "down",
  "left",
  "right",
  "home",
  "clock",
  "loop",
  "shuffle",
] as const
export type IconName = (typeof ICONS)[number]

/** One of the things a control offers: a button of a row, a choice among several. */
export type Option = { id: string; label: string; icon: IconName | null }

type Span = { min: number; max: number }

/** What a control can be set to. */
export type Value = number | boolean | string | [number, number]

/**
 * One control of a tool, as it stands: what it is, what it is called and does, in a
 * few words, and what it is set to. `says` is that value as the tool words it ("10:42"),
 * where it words it.
 */
export type Control = { id: string; title: string; description: string } & (
  | {
      kind: "slider"
      min: number
      max: number
      step: number
      value: number
      says: string | null
    }
  | {
      kind: "pad"
      x: Span
      y: Span
      /** let go of, it goes back to the middle, as a joystick does */
      springs: boolean
      value: [number, number]
      says: string | null
    }
  | { kind: "buttons"; options: Option[] }
  | { kind: "choice" | "list"; options: Option[]; value: string }
  | { kind: "toggle"; value: boolean }
  | { kind: "palette"; options: PaletteName[]; value: PaletteName }
  | { kind: "readout"; value: string }
)

export type ControlKind = Control["kind"]

/** A part of the model, as a tool is told of it: where it is as built, in mm. */
export type PartFact = {
  id: string
  label: string
  group: string
  min: Vec3
  max: Vec3
}

/** How a tool has the parts look, apart from where they are. */
export type Looks = {
  hidden: string[]
  colours: Record<string, PaletteName>
}

export type ToRunner =
  | {
      type: "start"
      /** what it is known by: what its file is called */
      id: string
      source: string
      parts: PartFact[]
      /** what its controls were last set to, to start from: by control */
      values: Record<string, Value>
    }
  /** a frame is to be drawn: `now` is the window's clock, in ms */
  | { type: "tick"; now: number }
  | { type: "set"; control: string; value: Value; count: number }
  | { type: "press"; control: string; option: string; count: number }

export type FromRunner =
  | { type: "ready"; name: string; controls: Control[] }
  | {
      type: "frame"
      /** the parts it has moved, and how, sixteen numbers each: null if as last said */
      poses: { ids: string[]; matrices: Float32Array } | null
      looks: Looks | null
      controls: Control[] | null
      /** how many things done to its controls it had heard of when it drew this */
      count: number
    }
  | { type: "failed"; message: string }
