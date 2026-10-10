import * as React from "react"
import { cn } from "cn"

import {
  choreograph,
  ends,
  EXTENT,
  letter,
  LETTER_WIDTH,
  LOGO,
  LOGO_VIEW,
  LOOP,
  MARK,
  REST,
  rests,
  viewAt,
  type Axis,
  type View,
} from "@/lib/mark"

/** Where the mark rests between its moves, the last of them being where it began. */
const RESTS = rests(REST, choreograph(LOOP.seed, LOOP.moves))

/** Where the mark is seen from, as time passes: it is turned over like a cube in the hand. */
function useTurning(moving: boolean): View {
  const [view, setView] = React.useState(REST)
  React.useEffect(() => {
    // someone who has asked for less movement is shown the mark at rest
    if (!moving || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return
    let frame = 0
    const started = performance.now()
    const draw = (now: number) => {
      setView(viewAt(RESTS, (now - started) / 1000, LOOP.turn, LOOP.hold))
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      setView(REST)
    }
  }, [moving])
  return view
}

/** How long the bar of a minus is, and how far it stands from its letter: shares of the height. */
const MINUS = { bar: 0.4, gap: 0.22 }

/**
 * An axis' letter as the mark draws it, `height` tall with its middle at (x, y): for
 * wherever the axes are named. With a `minus` before it, it names the end an axis points
 * away from: that bar is not the mark's, which letters only the ends it points to.
 */
export function Letter({
  axis,
  x,
  y,
  height,
  minus = false,
  rise = MARK.labelRise,
  ...props
}: {
  axis: Axis
  x: number
  y: number
  height: number
  minus?: boolean
  /** how long the uprights its diagonals start and end with are, as a share of the height */
  rise?: number
} & Omit<React.SVGProps<SVGPathElement>, "x" | "y" | "height">) {
  const stroke = MARK.labelWeight * height
  const bar = minus ? MINUS.bar * height : 0
  const before = minus ? bar + MINUS.gap * height : 0
  // the two are set round the middle together
  const left = x - (before + LETTER_WIDTH * height) / 2
  return (
    <path
      d={
        (minus ? `M${left} ${y}h${bar}` : "") +
        letter(axis, x + before / 2, y, height, stroke, rise * height)
      }
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      {...props}
    />
  )
}

/**
 * The mark drawn in a square `size` px a side, seen from `view`, in the measures given:
 * a filled dot with its letter at the end each axis points to, and an outlined dot at the
 * end it points away from.
 */
function Drawn({
  view,
  measures,
  size,
  ink,
  className,
}: {
  view: View
  measures: typeof MARK
  size: number
  ink: string
  className?: string
}) {
  return (
    <svg
      viewBox={`${-EXTENT} ${-EXTENT} ${2 * EXTENT} ${2 * EXTENT}`}
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {ends(view).map(({ axis, sign, x, y }) => {
        const cx = x * measures.length
        const cy = y * measures.length
        return sign > 0 ? (
          <g key={`${axis}+`}>
            <line
              x2={cx}
              y2={cy}
              stroke="currentColor"
              strokeWidth={measures.weight}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={measures.dot} fill="currentColor" />
            <Letter
              axis={axis}
              x={cx}
              y={cy}
              height={measures.labelSize * 2 * measures.dot}
              rise={measures.labelRise}
              stroke={ink}
            />
          </g>
        ) : (
          // the outline is drawn inside the dot's size, round a tint of the same colour
          <circle
            key={`${axis}-`}
            cx={cx}
            cy={cy}
            r={measures.dot - measures.outline / 2}
            fill="currentColor"
            fillOpacity={measures.tint}
            stroke="currentColor"
            strokeWidth={measures.outline}
          />
        )
      })}
    </svg>
  )
}

type MarkProps = {
  /** how big the square it turns in is, px: at rest it is narrower (`RESTING_WIDTH`) */
  size?: number
  /** what its letters are written in, on the dots: as unlike the mark's colour as can be */
  ink?: string
  className?: string
}

/**
 * The Enclose mark: the model's three axes as a camera sees them, a filled dot with its
 * letter at the end each one points to and an outlined dot at the end it points away
 * from. It is drawn in the colour of the words around it. `moving` turns it over and
 * over, for as long as something is being waited for.
 */
export function Mark({
  moving = false,
  size = 64,
  ink = "var(--background)",
  className,
}: MarkProps & { moving?: boolean }) {
  const view = useTurning(moving)
  return (
    <Drawn
      view={view}
      measures={MARK}
      size={size}
      ink={ink}
      className={className}
    />
  )
}

/**
 * The mark as the app's name goes with it: the one on its icon, heavier than the mark
 * that turns and still, where the app says who it is and nothing is waited for.
 */
export function Logo({
  size = 64,
  ink = "var(--background)",
  className,
}: MarkProps) {
  return (
    <Drawn
      view={LOGO_VIEW}
      measures={LOGO}
      size={size}
      ink={ink}
      className={className}
    />
  )
}
