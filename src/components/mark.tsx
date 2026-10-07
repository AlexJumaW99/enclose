import * as React from "react"
import { cn } from "cn"

import {
  choreograph,
  ends,
  EXTENT,
  letter,
  LOOP,
  MARK,
  REST,
  rests,
  viewAt,
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
}: {
  moving?: boolean
  /** how big the square it turns in is, px: at rest it is narrower (`RESTING_WIDTH`) */
  size?: number
  /** what its letters are written in, on the dots: as unlike the mark's colour as can be */
  ink?: string
  className?: string
}) {
  const view = useTurning(moving)
  const height = MARK.labelSize * 2 * MARK.dot
  const stroke = MARK.labelWeight * height
  return (
    <svg
      viewBox={`${-EXTENT} ${-EXTENT} ${2 * EXTENT} ${2 * EXTENT}`}
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {ends(view).map(({ axis, sign, x, y }) => {
        const cx = x * MARK.length
        const cy = y * MARK.length
        return sign > 0 ? (
          <g key={`${axis}+`}>
            <line
              x2={cx}
              y2={cy}
              stroke="currentColor"
              strokeWidth={MARK.weight}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={MARK.dot} fill="currentColor" />
            <path
              d={letter(axis, cx, cy, height, stroke, MARK.labelRise * height)}
              fill="none"
              stroke={ink}
              strokeWidth={stroke}
            />
          </g>
        ) : (
          // the outline is drawn inside the dot's size, round a tint of the same colour
          <circle
            key={`${axis}-`}
            cx={cx}
            cy={cy}
            r={MARK.dot - MARK.outline / 2}
            fill="currentColor"
            fillOpacity={MARK.tint}
            stroke="currentColor"
            strokeWidth={MARK.outline}
          />
        )
      })}
    </svg>
  )
}
