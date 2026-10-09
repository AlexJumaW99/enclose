import * as React from "react"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ClockIcon,
  FastForwardIcon,
  HouseIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  RewindIcon,
  RotateCcwIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SquareIcon,
  type LucideIcon,
} from "lucide-react"

import { PALETTE } from "@shared/palette"
import type { Control, IconName, Option, Value } from "@/lib/custom-tools/types"

// What a tool's controls are drawn as. A tool says what kind each of its controls is,
// and nothing of how it looks: they are all the app's, in white on the blue of what is
// the project's own, so that one tool goes with the next whoever had it made.

const SIGNS: Record<IconName, LucideIcon> = {
  play: PlayIcon,
  pause: PauseIcon,
  stop: SquareIcon,
  rewind: RewindIcon,
  forward: FastForwardIcon,
  back: SkipBackIcon,
  next: SkipForwardIcon,
  reset: RotateCcwIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
  left: ArrowLeftIcon,
  right: ArrowRightIcon,
  home: HouseIcon,
  clock: ClockIcon,
  loop: RepeatIcon,
  shuffle: ShuffleIcon,
}

function Sign({ name }: { name: IconName }) {
  const Icon = SIGNS[name]
  return <Icon size={16} absoluteStrokeWidth strokeWidth={1.25} />
}

/** What an option says of itself: its sign, its words, or both. */
function Said({ option }: { option: Option }) {
  return (
    <>
      {option.icon && <Sign name={option.icon} />}
      {option.label && <span className="truncate">{option.label}</span>}
    </>
  )
}

/** A number as a control says it where its tool does not: to no more places than it steps by. */
function plainly(value: number, step: number): string {
  const places =
    step > 0 ? Math.min(4, (String(step).split(".")[1] ?? "").length) : 2
  return String(Number(value.toFixed(places)))
}

/** How wide the room a control has is, px: the panel, less what a control is called and the room round both. */
const ROOM = 236
/** The room kept between one option and the next, px, where they stand apart. */
const BETWEEN = 6

/**
 * How many of a control's options go side by side, for them to fill the room the
 * control has: all of them where they fit, and otherwise as many to a row as leaves
 * the rows even, so that no row ends short of the edge by more than it must. Going by
 * how long the longest of them is to read, which is as near as can be told before it
 * is drawn.
 */
export function across(options: Option[]): number {
  const widest = Math.max(
    ...options.map(
      (option) => option.label.length * 8 + (option.icon ? 22 : 0) + 20
    ),
    32
  )
  const fit = Math.max(1, Math.floor((ROOM + BETWEEN) / (widest + BETWEEN)))
  const rows = Math.ceil(options.length / fit)
  return Math.ceil(options.length / rows)
}

/** So many columns, all as wide as one another. */
const columns = (count: number): React.CSSProperties => ({
  gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
})

/** What a control is set to, in words, over the control itself. */
const SAYS = "text-sm/[17px] font-medium tabular-nums"

/**
 * Follow the pointer from where it is pressed until it is let go, wherever it goes:
 * `to` is told where it is, as how far across and how far down what was pressed, each
 * from 0 to 1, and `done` that it was let go.
 */
function useDrag(to: (x: number, y: number) => void, done?: () => void) {
  const held = React.useRef(false)
  const at = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const within = (n: number) => Math.min(1, Math.max(0, n))
    to(
      within((event.clientX - box.left) / (box.width || 1)),
      within((event.clientY - box.top) / (box.height || 1))
    )
  }
  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      held.current = true
      // (a pointer made up by a script has nothing to capture, and that is fine)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // not a live pointer
      }
      at(event)
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (held.current) at(event)
    },
    onPointerUp: () => {
      if (!held.current) return
      held.current = false
      done?.()
    },
    onPointerCancel: () => {
      if (!held.current) return
      held.current = false
      done?.()
    },
  }
}

/** How wide the knob of a slider is, px: its track stops half of that short at each end. */
const KNOB = 14

function Slider({
  control,
  onSet,
}: {
  control: Extract<Control, { kind: "slider" }>
  onSet: (value: Value) => void
}) {
  const { min, max, value } = control
  const along = (value - min) / (max - min || 1)
  const drag = useDrag((x) => onSet(min + x * (max - min)))
  return (
    // The line is in the middle of the room the control has, and what it is set to is
    // said over the knob, and goes along with it. The words keep inside the room: they
    // are over the knob by their own middle half way along, and by their nearer end
    // towards either end of the line.
    <div className="relative flex min-h-15 w-full items-center self-stretch">
      <div
        className={cn(
          SAYS,
          "pointer-events-none absolute bottom-1/2 mb-[13px] whitespace-nowrap"
        )}
        style={{ left: `${along * 100}%`, translate: `${-along * 100}%` }}
      >
        {control.says ?? plainly(value, control.step)}
      </div>
      <div className="w-full px-[7px]">
        <div
          role="slider"
          aria-label={control.title}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={control.says ?? undefined}
          className="relative h-5 cursor-pointer touch-none"
          {...drag}
        >
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/25" />
          <div
            className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full bg-white"
            style={{ width: `${along * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-1/2 rounded-full bg-white shadow-sm"
            style={{ left: `${along * 100}%`, width: KNOB, height: KNOB }}
          />
        </div>
      </div>
    </div>
  )
}

function Pad({
  control,
  onSet,
}: {
  control: Extract<Control, { kind: "pad" }>
  onSet: (value: Value) => void
}) {
  const { x, y, value } = control
  const across = (value[0] - x.min) / (x.max - x.min || 1)
  // (up the screen is more, as on a graph)
  const up = (value[1] - y.min) / (y.max - y.min || 1)
  const within = (span: { min: number; max: number }, n: number) =>
    Math.min(span.max, Math.max(span.min, n))
  const drag = useDrag(
    (px, py) =>
      onSet([x.min + px * (x.max - x.min), y.min + (1 - py) * (y.max - y.min)]),
    // let go of, one that springs goes back to rest
    control.springs ? () => onSet([within(x, 0), within(y, 0)]) : undefined
  )
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className={cn(SAYS, "text-right")}>
        {control.says ?? `${plainly(value[0], 0)}, ${plainly(value[1], 0)}`}
      </div>
      {/* as wide as the room there is. The knob keeps inside it: it is moved over a
          smaller one within */}
      <div className="h-32 w-full rounded-xl bg-white/10 p-2 ring-1 ring-white/20 ring-inset">
        <div
          role="group"
          aria-label={control.title}
          className="relative size-full cursor-pointer touch-none"
          {...drag}
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15" />
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
          <div
            className="absolute size-4 -translate-1/2 rounded-full bg-white shadow-sm"
            style={{ left: `${across * 100}%`, top: `${(1 - up) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function Buttons({
  control,
  onPress,
}: {
  control: Extract<Control, { kind: "buttons" }>
  onPress: (option: string) => void
}) {
  return (
    // side by side and all of a width, across all the room there is
    <div
      className="grid w-full gap-1.5"
      style={columns(across(control.options))}
    >
      {control.options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-label={option.label || option.id}
          title={option.label ? undefined : option.id}
          onClick={() => onPress(option.id)}
          className="flex h-8 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white/12 px-2 text-sm font-medium outline-none hover:bg-white/20 active:bg-white/30"
        >
          <Said option={option} />
        </button>
      ))}
    </div>
  )
}

function Choice({
  control,
  onSet,
}: {
  control: Extract<Control, { kind: "choice" | "list" }>
  onSet: (value: Value) => void
}) {
  const listed = control.kind === "list"
  const wide = listed ? 1 : across(control.options)
  return (
    <div
      role="radiogroup"
      aria-label={control.title}
      className={cn(
        "w-full bg-white/10 p-0.5",
        listed
          ? "flex max-h-44 [scrollbar-width:none] flex-col gap-px overflow-y-auto rounded-xl"
          : // side by side and all of a width, across all the room there is
            cn(
              "grid gap-0.5",
              wide < control.options.length ? "rounded-[18px]" : "rounded-full"
            )
      )}
      style={listed ? undefined : columns(wide)}
    >
      {control.options.map((option) => {
        const chosen = option.id === control.value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={option.label || option.id}
            onClick={() => onSet(option.id)}
            className={cn(
              "flex h-8 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 text-sm outline-none",
              listed
                ? "rounded-[10px] px-2.5 text-left"
                : "justify-center rounded-full px-2",
              chosen
                ? "bg-white font-medium text-tool-panel"
                : "text-white/75 hover:bg-white/12 hover:text-white"
            )}
          >
            <Said option={option} />
          </button>
        )
      })}
    </div>
  )
}

function Toggle({
  control,
  onSet,
}: {
  control: Extract<Control, { kind: "toggle" }>
  onSet: (value: Value) => void
}) {
  const on = control.value
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={control.title}
      onClick={() => onSet(!on)}
      className={cn(
        "relative h-6 w-10.5 cursor-pointer rounded-full transition-colors outline-none",
        on ? "bg-white" : "bg-white/25"
      )}
    >
      <span
        className={cn(
          "absolute top-0.75 left-0.75 size-4.5 rounded-full transition-[translate,background-color]",
          on ? "translate-x-4.5 bg-tool-panel" : "bg-white"
        )}
      />
    </button>
  )
}

function Palette({
  control,
  onSet,
}: {
  control: Extract<Control, { kind: "palette" }>
  onSet: (value: Value) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={control.title}
      className="flex flex-wrap justify-center gap-2.5 p-0.5"
    >
      {control.options.map((name) => {
        const chosen = name === control.value
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={name}
            title={name}
            onClick={() => onSet(name)}
            className={cn(
              "size-6 cursor-pointer rounded-full outline-offset-2 outline-white",
              chosen ? "outline-2" : "outline-0 hover:outline-1"
            )}
            style={{ background: PALETTE[name] }}
          />
        )
      })}
    </div>
  )
}

/** One control of a tool, as its kind is drawn: in the room beside what it is called. */
export function ControlOf({
  control,
  onSet,
  onPress,
}: {
  control: Control
  onSet: (value: Value) => void
  onPress: (option: string) => void
}) {
  switch (control.kind) {
    case "slider":
      return <Slider control={control} onSet={onSet} />
    case "pad":
      return <Pad control={control} onSet={onSet} />
    case "buttons":
      return <Buttons control={control} onPress={onPress} />
    case "choice":
    case "list":
      return <Choice control={control} onSet={onSet} />
    case "toggle":
      return <Toggle control={control} onSet={onSet} />
    case "palette":
      return <Palette control={control} onSet={onSet} />
    case "readout":
      return (
        <div className="text-center text-[28px]/8 font-medium tracking-tight tabular-nums">
          {control.value || " "}
        </div>
      )
  }
}
