// The blueprint of a model: the model drawn flat, from each of its sides and from four of
// its corners, each drawing on a sheet of its own. The sheets stand in a row where the view of the model was, to be
// gone along, by the wheel or by taking hold of the row and pulling it; a sheet that is
// pressed is shown by itself, with all of the view for its paper; and each can be taken
// away as a file of its lines, an SVG.
//
// What is drawn is what the view had on show: all of the model, or the parts that were
// picked to be shown on their own, without the ones put out of sight; put together, or
// pulled apart as far as the view had them.
import * as React from "react"
import * as THREE from "three"
import { cn } from "cn"
import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { pieceWith } from "@/components/viewport/apart"
import type { LoadedModel, LoadedPart } from "@/components/viewport/load"
import { spokenFor } from "@/lib/keys"
import { usePreferences } from "@/lib/preferences"
import { savedAs } from "@/lib/saved"
import { useStore } from "@/lib/store"
import { dimensionsOf, type Room } from "./dimensions"
import { clearFor, columnFor, heightFor, labelsOf } from "./labels"
import { drawn, type Body, type Looking, type Stroke } from "./lines"
import { useSaving } from "./saving"
import {
  DOT,
  DOTTED,
  FIGURES,
  INK,
  LINE,
  MARGIN,
  paperOf,
  PENCIL,
  placed,
  scaleSaid,
  SIDES,
  svgOf,
  THIN,
  WRITING,
  type Dimension,
  type Label,
  type Placing,
  type Seen,
} from "./sheet"

/** How long the drawing goes on at a time, in ms, before the window is let draw itself. */
const AT_A_TIME_MS = 10
/**
 * How long what is to be drawn has to stay the same, in ms, before it is drawn again: a
 * slider is dragged through many places on its way to one.
 */
const SETTLED_MS = 120
/**
 * How thin a line can get on the screen, in pixels of the screen's own, on a drawing
 * that is shown small: a sheet in the row is its drawing made to fit, lines, writing and
 * all, and a line that came to less than this would not be there to be seen. (The
 * writing is let get as small as it comes: a sheet in the row is to be looked at, and
 * read once it has the view to itself.)
 */
const HAIRLINE = 1
/**
 * How many pixels a millimetre of paper is, of a sheet shown by itself: a pixel to the
 * point, which is what a sheet in the row is at its full size.
 */
const MM_PX = 72 / 25.4

/** How long after the sheet before it each sheet comes in, as the blueprint comes up, ms. */
const AFTER_MS = 70

/**
 * How far the pointer has to go, held down on the row of sheets, before the row is being
 * pulled along by it, in pixels: less, and it is a press on whatever is under it.
 */
const PULLED_PX = 4

/** A moment for the window to draw itself in. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0))

/** One side of the model, drawn: the lines of each part. And where they sit on its paper. */
type Drawn = { strokes: Stroke[][] }
type Drawing = Drawn & { placing: Placing }

/** The sheets of a model: its sides, as far as they have been drawn. */
type Sheets = {
  /** what they are a drawing of: tells one drawing of the model from the next */
  of: string
  /** the parts drawn, by id, in the order their lines are kept in */
  parts: string[]
  /** the room they take up between them, which is what a sheet gives the size of */
  room: Room
  /** and the room they take up as each side sees them, which is what places its drawing */
  seen: Seen[]
  sides: (Drawn | null)[]
}

/**
 * The last few sets of sheets drawn, latest first: what a blueprint comes up with at
 * once, where the model is as it was for one of them. Pulled apart and put back together
 * is two of them.
 */
const kept: Sheets[] = []
const KEPT = 3
const keptOf = (of: string) => kept.find((sheets) => sheets.of === of) ?? null
function keep(sheets: Sheets) {
  kept.unshift(sheets)
  kept.length = Math.min(kept.length, KEPT)
}

/** A number for a thing, its own for as long as the thing is there. */
const numbers = new WeakMap<object, number>()
let numbered = 0
function numberOf(thing: object): number {
  let number = numbers.get(thing)
  if (number === undefined) numbers.set(thing, (number = ++numbered))
  return number
}

/**
 * What a drawing depends on, in a word: which parts they are, as they were loaded, and
 * where each is. The same parts put in other groups are the same drawing.
 */
function keyOf(parts: LoadedPart[], apart: number): string {
  return parts
    .map(
      (part) =>
        `${numberOf(part.skins)}.${numberOf(part.home)}` +
        (apart === 0 ? "" : `@${part.away.toArray().join()}`)
    )
    .concat(String(apart))
    .join(" ")
}

/** Where a part is in the model, as it is drawn: pulled out from its place by so much. */
function placeOf(part: LoadedPart, apart: number): THREE.Matrix4 {
  const place = part.home.clone()
  const out = part.away.clone().multiplyScalar(apart)
  place.elements[12] += out.x
  place.elements[13] += out.y
  place.elements[14] += out.z
  return place
}

/** The parts as the drawing takes them, and the room they take up seen from each side. */
function laidOut(parts: LoadedPart[], apart: number) {
  const places = parts.map((part) => placeOf(part, apart))
  const bodies = parts.map((part, index): Body => ({
    // (what is made of something clear hides nothing: it is drawn, and seen through)
    skins: part.part.clear
      ? []
      : part.skins.map(({ geometry }) => ({
          position: geometry.attributes.position.array,
          index: geometry.index!.array,
        })),
    edges: part.edges,
    contours: part.contours,
    place: places[index].elements,
  }))
  // the room they take up between them, where they are
  const all = new THREE.Box3()
  parts.forEach(({ box }, index) =>
    all.union(box.clone().applyMatrix4(places[index]))
  )
  const room: Room = all.isEmpty()
    ? { min: [0, 0, 0], max: [0, 0, 0] }
    : { min: all.min.toArray(), max: all.max.toArray() }
  // every corner of every part's box, as each side sees it
  const corner = new THREE.Vector3()
  const rooms = SIDES.map(({ looking }) => {
    const right = new THREE.Vector3(...looking.right)
    const up = new THREE.Vector3(...looking.up)
    const room = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
    parts.forEach(({ box }, index) => {
      for (let i = 0; i < 8; i++) {
        corner
          .set(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z
          )
          .applyMatrix4(places[index])
        room.x0 = Math.min(room.x0, corner.dot(right))
        room.x1 = Math.max(room.x1, corner.dot(right))
        room.y0 = Math.min(room.y0, corner.dot(up))
        room.y1 = Math.max(room.y1, corner.dot(up))
      }
    })
    return parts.length > 0 ? room : { x0: 0, x1: 0, y0: 0, y1: 0 }
  })
  return { bodies, room, seen: rooms }
}

/**
 * The room a side's drawing takes up, and with it the corners of the room the model
 * takes up as a whole, which are where its size is said from. Seen from a corner of the
 * model those can lie well outside the drawing, where no part is.
 */
function withCorners(seen: Seen, room: Room, looking: Looking): Seen {
  const all = { ...seen }
  for (let i = 0; i < 8; i++) {
    const corner = [0, 1, 2].map((axis) =>
      i & (1 << axis) ? room.max[axis] : room.min[axis]
    )
    const [x, y] = [looking.right, looking.up].map(
      (way) => corner[0] * way[0] + corner[1] * way[1] + corner[2] * way[2]
    )
    all.x0 = Math.min(all.x0, x)
    all.x1 = Math.max(all.x1, x)
    all.y0 = Math.min(all.y0, y)
    all.y1 = Math.max(all.y1, y)
  }
  return all
}

/** The sheets in the order they are drawn in: the ones in sight first, then the rest. */
function inSightFirst(row: HTMLElement | null): number[] {
  const all = SIDES.map((_, index) => index)
  if (!row) return all
  const sheets = [...row.children] as HTMLElement[]
  const inSight = (index: number) => {
    const sheet = sheets.at(index)
    return (
      sheet !== undefined &&
      sheet.offsetLeft < row.scrollLeft + row.clientWidth &&
      sheet.offsetLeft + sheet.offsetWidth > row.scrollLeft
    )
  }
  return [...all.filter(inSight), ...all.filter((index) => !inSight(index))]
}

/**
 * The sheets of what is on show, drawn as they are asked for: a side at a time, and a
 * little of a side at a time, so that the window is never held up by it. Each sheet
 * shows as it is done, the ones in sight before the rest. `now` is the sheets of the
 * model as it is on show, as far as they have been drawn. While it is being drawn
 * again, some other way, `was` is the sheets of it as it was: each stays up until the
 * one that takes its place is done, as the model does when it is built again.
 */
function useSheets(
  parts: LoadedPart[],
  apart: number,
  row: React.RefObject<HTMLElement | null>
): { now: Sheets | null; was: Sheets | null } {
  const of = React.useMemo(() => keyOf(parts, apart), [parts, apart])
  /** the drawing that is under way, as far as it has got */
  const [sheets, setSheets] = React.useState<Sheets | null>(null)
  /** the last that was all there here: what stays up while the next is drawn */
  const [last, setLast] = React.useState<Sheets | null>(null)
  const whole = keptOf(of)
  if (whole && last !== whole) setLast(whole)

  React.useEffect(() => {
    if (keptOf(of)) return
    let stopped = false
    const draw = async () => {
      const { bodies, room, seen } = laidOut(parts, apart)
      const fresh: Sheets = {
        of,
        parts: parts.map((part) => part.part.id),
        room,
        seen,
        sides: SIDES.map(() => null),
      }
      for (const index of inSightFirst(row.current)) {
        const run = drawn(bodies, SIDES[index].looking)
        let since = performance.now()
        for (;;) {
          const step = run.next()
          if (step.done) {
            fresh.sides[index] = { strokes: step.value }
            break
          }
          if (performance.now() - since < AT_A_TIME_MS) continue
          await breathe()
          if (stopped) return
          since = performance.now()
        }
        await breathe()
        if (stopped) return
        setSheets({ ...fresh, sides: [...fresh.sides] })
      }
      keep(fresh)
      setLast(fresh)
    }
    const begun = setTimeout(() => void draw(), SETTLED_MS)
    return () => {
      stopped = true
      clearTimeout(begun)
    }
  }, [of, parts, apart, row])

  return {
    now: whole ?? (sheets?.of === of ? sheets : null),
    was: last && last.of !== of ? last : null,
  }
}

/** A name a file can have, from whatever something is called. */
const fileName = (called: string) =>
  called
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "model"

/**
 * The lines of a drawing, on the paper: as they will be in the file, at the sheet's size.
 * And over them what the sheet says of how big the model is, and of which part is which,
 * where it says.
 */
function Lines({
  drawing,
  measures,
  labels,
}: {
  drawing: Drawing | null
  measures: Dimension[] | null
  labels: Label[] | null
}) {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    const paper = canvas.current
    if (!paper) return
    const paint = () => {
      const ratio = window.devicePixelRatio || 1
      const width = Math.round(paper.clientWidth * ratio)
      const height = Math.round(paper.clientHeight * ratio)
      if (paper.width !== width || paper.height !== height) {
        paper.width = width
        paper.height = height
      }
      const context = paper.getContext("2d")
      if (!context) return
      context.clearRect(0, 0, width, height)
      if (!drawing) return
      // pixels to the millimetre of paper, and to the millimetre of model
      const on = paperOf(drawing.placing)
      const per = width / on.width
      const { middle, by } = drawing.placing
      const scale = per / by
      const left = (on.width / 2) * per - middle[0] * scale
      const top = (on.height / 2) * per + middle[1] * scale
      context.lineWidth = Math.max(LINE * per, HAIRLINE)
      context.lineJoin = "round"
      context.lineCap = "round"
      context.strokeStyle = INK
      context.beginPath()
      for (const strokes of drawing.strokes)
        for (const { points, closed } of strokes) {
          context.moveTo(left + points[0] * scale, top - points[1] * scale)
          for (let i = 2; i + 1 < points.length; i += 2)
            context.lineTo(
              left + points[i] * scale,
              top - points[i + 1] * scale
            )
          if (closed) context.closePath()
        }
      context.stroke()
      context.lineWidth = Math.max(THIN * per, HAIRLINE / 2)
      context.strokeStyle = PENCIL
      context.fillStyle = PENCIL
      context.textBaseline = "alphabetic"
      // the names of the parts: a line from each to its part, a dot where it ends
      if (labels) {
        context.font = `600 ${WRITING * per}px "Inter Variable", sans-serif`
        // (the line is of dots: no nearer one another than three of them would lie)
        const dotted = [0, Math.max(DOTTED * per, context.lineWidth * 3)]
        for (const { said, line, at, text } of labels) {
          context.setLineDash(dotted)
          context.beginPath()
          context.moveTo(line[0] * per, line[1] * per)
          for (let i = 2; i + 1 < line.length; i += 2)
            context.lineTo(line[i] * per, line[i + 1] * per)
          context.stroke()
          context.setLineDash([])
          context.beginPath()
          context.arc(at[0] * per, at[1] * per, (DOT / 2) * per, 0, 2 * Math.PI)
          context.fill()
          context.textAlign = text.side === "left" ? "right" : "left"
          context.fillText(said, text.x * per, text.y * per)
        }
      }
      if (!measures) return
      context.font = `400 ${FIGURES * per}px "Inter Variable", sans-serif`
      context.textAlign = "center"
      for (const { lines, arrows, text } of measures) {
        context.beginPath()
        for (const [x1, y1, x2, y2] of lines) {
          context.moveTo(x1 * per, y1 * per)
          context.lineTo(x2 * per, y2 * per)
        }
        context.stroke()
        context.beginPath()
        for (const [x1, y1, x2, y2, x3, y3] of arrows) {
          context.moveTo(x1 * per, y1 * per)
          context.lineTo(x2 * per, y2 * per)
          context.lineTo(x3 * per, y3 * per)
          context.closePath()
        }
        context.fill()
        context.save()
        context.translate(text.x * per, text.y * per)
        context.rotate((text.turn * Math.PI) / 180)
        context.fillText(text.said, 0, 0)
        context.restore()
      }
    }
    paint()
    // drawn again at whatever size the sheet comes to be
    const watch = new ResizeObserver(paint)
    watch.observe(paper)
    return () => watch.disconnect()
  }, [drawing, measures, labels])
  return <canvas ref={canvas} className="absolute inset-0 size-full" />
}

/** One sheet: what it is of and the way to take it away, over the paper with the drawing on it. */
function Sheet({
  name,
  place,
  drawing,
  measures,
  labels,
  stale,
  onSave,
  onEnlarge,
}: {
  name: string
  /** null until it has been drawn */
  drawing: Drawing | null
  /** what it says of how big the model is, if it says */
  measures: Dimension[] | null
  /** and of which part is which, if it says */
  labels: Label[] | null
  /** what is on it is of the model as it was, and is being drawn again */
  stale: boolean
  /** its place in the row, from the left: it comes in that much after the first */
  place: number
  onSave: () => void
  /** the paper was pressed: it is to be shown by itself */
  onEnlarge: () => void
}) {
  const paper = paperOf(drawing?.placing ?? { middle: [0, 0], by: 1 })
  return (
    <section
      // The sheets come in one after another along the row as the blueprint comes up:
      // each out of nothing, and up a little into its place.
      className="flex shrink-0 animate-in flex-col gap-2.5 duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-both fade-in slide-in-from-bottom-6 motion-reduce:animate-none"
      style={{ animationDelay: `${place * AFTER_MS}ms` }}
    >
      <header className="flex h-9 items-center justify-between">
        <h2 className="text-base font-medium">{name} View</h2>
        <Tooltip disableHoverablePopup>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="bg-foreground/8 hover:bg-foreground/14 dark:hover:bg-foreground/14"
                // (one that is being drawn again is not yet what would be saved)
                disabled={!drawing || stale}
                onClick={onSave}
              />
            }
          >
            <DownloadIcon />
            <span className="sr-only">Download SVG</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Download SVG
            {drawing && (
              <span className="tabular-nums opacity-60">
                {scaleSaid(drawing.placing.by)}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </header>
      {/* four wide to five high: as tall as the window has room for, clear of what is
          at its top and its foot, and no taller than it is at a pixel to the point.
          Pressed, it is shown by itself, with all of the view for its paper */}
      <button
        type="button"
        data-paper
        aria-label={`Enlarge the ${name} view`}
        disabled={!drawing}
        onClick={onEnlarge}
        className="relative aspect-[4/5] h-[min(744px,calc(100svh-180px))] cursor-pointer overflow-hidden rounded-[18px] bg-white ring-1 ring-foreground/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default dark:bg-[#f5f6ec] dark:ring-0 dark:focus-visible:ring-[3px]"
      >
        {/* a drawing that is being done again waits faintly for the one to take its
            place: but not at once, in case that is here before anyone could tell */}
        <div
          className={cn(
            "[container-type:size] absolute inset-3 flex items-center justify-center transition-opacity duration-200",
            stale && "opacity-25 delay-200"
          )}
        >
          {/* The drawing's own paper, all of it, as big as the sheet has room for: a
              sheet in the row is the drawing seen small, what is written on it and all,
              and is not that drawing set out again to be read at this size. */}
          {drawing && (
            <div
              className="relative shrink-0"
              style={{
                aspectRatio: `${paper.width} / ${paper.height}`,
                width: `min(100cqw, 100cqh * ${paper.width / paper.height})`,
              }}
            >
              <Lines drawing={drawing} measures={measures} labels={labels} />
            </div>
          )}
        </div>
        {(!drawing || stale) && (
          <div className="absolute inset-0 flex animate-in items-center justify-center delay-300 duration-300 fill-mode-both fade-in">
            <Spinner className="size-5 text-black/35" />
          </div>
        )}
      </button>
    </section>
  )
}

/** All that is on one sheet: its drawing, and what it says round it. */
type Shown = {
  drawing: Drawing
  stale: boolean
  measures: Dimension[] | null
  labels: Label[] | null
}

/**
 * A sheet by itself, with all of the view for its paper. It is not the sheet made
 * bigger: the drawing is done again to fit the view, as big as that has room for, with
 * lines as thin and writing as small as on any sheet. Nothing else is over the view
 * the while, but what is at the foot of the sheets, to change what it shows, and at the
 * top right what puts it back among the others (see Tools).
 */
function Alone({
  name,
  on,
}: {
  name: string
  /** what it shows, on paper no bigger than this, in mm: nothing, until it is drawn */
  on: (most: { width: number; height: number }) => Shown | null
}) {
  const within = React.useRef<HTMLDivElement>(null)
  const [most, setMost] = React.useState<{
    width: number
    height: number
  } | null>(null)
  React.useLayoutEffect(() => {
    const room = within.current
    if (!room) return
    const measure = () =>
      setMost({
        width: room.clientWidth / MM_PX,
        height: room.clientHeight / MM_PX,
      })
    measure()
    // done again at whatever size the view comes to be
    const watch = new ResizeObserver(measure)
    watch.observe(room)
    return () => watch.disconnect()
  }, [])
  const shown = React.useMemo(() => (most ? on(most) : null), [most, on])
  const paper = shown && paperOf(shown.drawing.placing)
  return (
    <div
      role="img"
      aria-label={`${name} view`}
      className="absolute inset-0 animate-in bg-white duration-200 fade-in motion-reduce:animate-none dark:bg-[#f5f6ec]"
    >
      {/* clear of what is over the view at its edges: the button at its top right,
          and as much at the left for the drawing to be in the middle; and the bars at
          its foot */}
      <div
        ref={within}
        className="absolute inset-x-15 top-6 bottom-21 flex items-center justify-center"
      >
        {shown && paper && (
          <div
            className={cn(
              "relative shrink-0 transition-opacity duration-200",
              shown.stale && "opacity-25 delay-200"
            )}
            style={{
              width: paper.width * MM_PX,
              height: paper.height * MM_PX,
            }}
          >
            <Lines
              drawing={shown.drawing}
              measures={shown.measures}
              labels={shown.labels}
            />
          </div>
        )}
      </div>
      {(!shown || shown.stale) && (
        <div className="absolute inset-0 flex animate-in items-center justify-center delay-300 duration-300 fill-mode-both fade-in">
          <Spinner className="size-5 text-black/35" />
        </div>
      )}
    </div>
  )
}

export function Blueprint({
  loaded,
  parts,
  apart,
  dimensions,
  labels,
  pieces,
  name,
}: {
  loaded: LoadedModel
  /** the parts of it that are on show: the ones that are drawn */
  parts: LoadedPart[]
  /** how far they are pulled apart: nothing, put together */
  apart: number
  /** whether the sheets say how big the model is */
  dimensions: boolean
  /** and whether they say which part is which */
  labels: boolean
  /**
   * The model is pulled apart into its pieces, each of which may be of several parts:
   * it is the pieces that are named then, and not the parts of them.
   */
  pieces: boolean
  /** what the model is called, for its files to go by */
  name: string
}) {
  const row = React.useRef<HTMLDivElement>(null)
  const { now, was } = useSheets(parts, apart, row)
  /** the sheet that is shown by itself, with all of the view, by its place in the row */
  const alone = useStore((state) => state.view.sheet)
  const setView = useStore((state) => state.setView)
  // While one is, the arrow keys go to the sheet before it in the row and the one after.
  const one = alone !== null
  React.useEffect(() => {
    if (!one) return
    const key = (event: KeyboardEvent) => {
      const by =
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
      if (!by || event.defaultPrevented || spokenFor(event.target)) return
      const at = useStore.getState().view.sheet
      if (at === null) return
      event.preventDefault()
      setView({ sheet: Math.min(SIDES.length - 1, Math.max(0, at + by)) })
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [one, setView])
  // The row is gone along by taking hold of it anywhere and pulling: where the pointer
  // went down, and how far along the row was then; and once it has been pulled at all.
  const held = React.useRef<{
    x: number
    left: number
    pulled: boolean
  } | null>(null)
  /** (for the hand that shows it: what is done about it goes by `held`, which is never behind) */
  const [pulling, setPulling] = React.useState(false)
  /** it was pulled, and let go: the press that ends that is not one on a sheet */
  const pulled = React.useRef(false)
  const units = usePreferences((state) => state.units)
  /**
   * What is on each sheet: its drawing of the model as it is on show, or until that is
   * done the one of the model as it was (`stale`); and what it says of how big the
   * model is, and of which part is which, where the sheets say.
   */
  const { sides, alone: aloneOn } = React.useMemo(() => {
    // What is named: each part by what it is called. Or, with the model pulled apart
    // into its pieces, each piece, by what the piece goes by: its group, where it is
    // all of one, and the part itself where a piece is no more than that.
    const listed = loaded.parts.map(({ part, piece, box }) => ({
      id: part.id,
      label: part.label,
      group: part.group,
      piece,
      across: box.min.distanceTo(box.max),
    }))
    const known = new Map(listed.map((part) => [part.id, part]))
    /** What a set of sheets has to name, each with a number that is its own on them all. */
    const nameable = (of: Sheets) => {
      const things = new Map<number, { label: string; parts: number[] }>()
      of.parts.forEach((id, place) => {
        const part = known.get(id)
        // (a part the model no longer has is a thing by itself)
        const key = pieces && part ? part.piece : -1 - place
        const thing = things.get(key)
        if (thing) thing.parts.push(place)
        else
          things.set(key, {
            label:
              (pieces && pieceWith(listed, loaded.model.groups, id)?.label) ||
              (part?.label ?? id),
            parts: [place],
          })
      })
      return [...things.values()]
    }
    /** The room a drawing has to be found: with what says its size, if that is said. */
    const taken = (of: Sheets, index: number) =>
      dimensions
        ? withCorners(of.seen[index], of.room, SIDES[index].looking)
        : of.seen[index]
    // How a set of drawings is set out, each on paper of its own: to the scale that
    // makes the biggest of them as big as paper gets, with as much of the paper kept
    // clear at either side as the names need, which stand there in columns as wide as
    // the longest of them, and paper tall enough for the names of what shows on it.
    const set = new Map<
      Sheets,
      {
        names: { things: ReturnType<typeof nameable>; column: number } | null
        at: Placing[]
      }
    >()
    const setOut = (of: Sheets) => {
      let out = set.get(of)
      if (!out) {
        const things = labels ? nameable(of) : null
        const names = things && {
          things,
          column: columnFor(things.map((thing) => thing.label)),
        }
        const at = placed(
          of.seen.map((_, index) => taken(of, index)),
          {
            x: names ? clearFor(names.column, dimensions) : MARGIN,
            y: MARGIN,
          },
          of.sides.map((side) =>
            names && side
              ? heightFor(
                  names.things.filter(({ parts }) =>
                    parts.some((part) => side.strokes[part].length > 0)
                  ).length
                )
              : 0
          )
        )
        set.set(of, (out = { names, at }))
      }
      return out
    }
    // each sheet's drawing: of the model as it is on show, or of it as it was
    const found = SIDES.map((_, index) => {
      const of = now?.sides[index] ? now : was?.sides[index] ? was : null
      const as = of?.sides[index] ?? null
      return of && as
        ? { of, as, names: setOut(of).names, stale: of !== now }
        : null
    })
    /** All that is on a sheet, with its drawing placed so. */
    const said = (index: number, placing: Placing) => {
      const { of, as, names, stale } = found[index]!
      const side = SIDES[index]
      return {
        drawing: { strokes: as.strokes, placing },
        stale,
        measures: dimensions
          ? dimensionsOf(of.room, side.looking, side.flat, placing, units)
          : null,
        labels: names
          ? labelsOf(
              names.things.map(({ label, parts }) => ({
                label,
                strokes: parts.flatMap((part) => as.strokes[part]),
              })),
              placing,
              names.column
            )
          : null,
      }
    }
    return {
      sides: found.map((one, index) =>
        one
          ? said(index, setOut(one.of).at[index])
          : { drawing: null, stale: false, measures: null, labels: null }
      ),
      /**
       * One of them on paper that is not a sheet: as big as there is of it, with the
       * drawing as big as that has room for, whatever scale that comes to. The paper is
       * no wider than the drawing needs, with what is said round it: the names stand
       * beside the drawing, and not off at the far edges of a wide view.
       */
      alone: (index: number, most: { width: number; height: number }) => {
        const one = found[index]
        if (!one) return null
        const seen = taken(one.of, index)
        const clear = {
          x: one.names ? clearFor(one.names.column, dimensions) : MARGIN,
          y: MARGIN,
        }
        const [wide, high] = [seen.x1 - seen.x0, seen.y1 - seen.y0]
        // (a view too small for anything is still not no room at all)
        const room = {
          width: Math.max(most.width - 2 * clear.x, 10),
          height: Math.max(most.height - 2 * clear.y, 10),
        }
        const by = Math.max(wide / room.width, high / room.height, 1e-6)
        return said(index, {
          middle: [(seen.x0 + seen.x1) / 2, (seen.y0 + seen.y1) / 2],
          by,
          paper: {
            width: Math.min(most.width, wide / by + 2 * clear.x),
            height: most.height,
          },
        })
      },
    }
  }, [now, was, dimensions, labels, pieces, units, loaded])

  /** The sheet that has the view to itself, as it is on paper of some size. */
  const onPaper = React.useCallback(
    (most: { width: number; height: number }) =>
      alone === null ? null : aloneOn(alone, most),
    [alone, aloneOn]
  )

  /** A sheet as the file it is saved as: nothing, of one that is not drawn as the model now is. */
  const fileOf = React.useCallback(
    (index: number) => {
      const { drawing, measures, labels: names, stale } = sides[index]
      if (!now || !drawing || stale) return null
      const side = SIDES[index].name.toLowerCase()
      // each part's lines under its name, and under its group's as the model has it now
      const lines = new Map(
        now.parts.map((id, place) => [id, drawing.strokes[place]])
      )
      const svg = svgOf({
        title: `${name}, ${side} view (${scaleSaid(drawing.placing.by)}${
          measures ? `, ${units}` : ""
        })`,
        placing: drawing.placing,
        dimensions: measures ?? undefined,
        labels: names ?? undefined,
        groups: loaded.model.groups.map((group) => ({
          id: group.id,
          label: group.label,
          parts: loaded.model.parts.flatMap((part) => {
            const strokes = part.group === group.id && lines.get(part.id)
            return strokes ? [{ id: part.id, label: part.label, strokes }] : []
          }),
        })),
      })
      return { name: `${fileName(name)}-${fileName(side)}.svg`, svg }
    },
    [sides, now, name, units, loaded]
  )
  const save = (index: number) => {
    const file = fileOf(index)
    if (file) void window.cad.model.saveDrawing(savedAs(file.name), file.svg)
  }

  // All of them together, for the button at the foot: once every sheet is drawn, and
  // drawn as the model now is.
  const whole = sides.every(({ drawing, stale }) => drawing !== null && !stale)
  React.useEffect(() => {
    if (!whole) return
    useSaving.setState({
      all: () => {
        const files = SIDES.flatMap((_, index) => fileOf(index) ?? [])
        void window.cad.model
          .saveDrawings(savedAs(`${fileName(name)}-blueprint`), files)
          .then((saved) => {
            if (saved) useStore.getState().say(`Saved ${files.length} SVGs`)
          })
      },
    })
    return () => useSaving.setState({ all: null })
  }, [whole, fileOf, name])

  return (
    <>
      <div
        // The sheets go off to the right, and are gone along sideways: a wheel that only
        // turns up and down goes along them too. The first starts clear of the projects'
        // cards, and the last can be brought clear of the buttons down the other edge.
        ref={row}
        className={cn(
          "absolute inset-0 flex [scrollbar-width:none] items-center gap-10 overflow-x-auto overflow-y-hidden overscroll-x-contain pr-25 pl-68 select-none",
          // a hand over it, which closes on it while it is pulled: whatever it is over
          pulling ? "cursor-grabbing [&_*]:cursor-grabbing" : "cursor-grab"
        )}
        aria-busy={!whole}
        onWheel={(event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
            event.currentTarget.scrollLeft += event.deltaY
        }}
        onPointerDown={(event) => {
          pulled.current = false
          // by the mouse's own button: and not from a button that is for something else
          const on = event.target as HTMLElement
          if (event.button !== 0 || event.pointerType === "touch") return
          if (on.closest("button:not([data-paper])")) return
          held.current = {
            x: event.clientX,
            left: event.currentTarget.scrollLeft,
            pulled: false,
          }
        }}
        onPointerMove={(event) => {
          const from = held.current
          if (!from) return
          const moved = event.clientX - from.x
          if (!from.pulled && Math.abs(moved) < PULLED_PX) return
          if (!from.pulled) {
            // it has the pointer from here on, wherever that goes
            from.pulled = true
            event.currentTarget.setPointerCapture(event.pointerId)
            setPulling(true)
          }
          event.currentTarget.scrollLeft = from.left - moved
        }}
        onPointerUp={() => {
          pulled.current = held.current?.pulled ?? false
          held.current = null
          setPulling(false)
        }}
        onPointerCancel={() => {
          held.current = null
          setPulling(false)
        }}
        onClickCapture={(event) => {
          if (!pulled.current) return
          pulled.current = false
          event.stopPropagation()
          event.preventDefault()
        }}
      >
        {SIDES.map((side, index) => (
          <Sheet
            key={side.name}
            name={side.name}
            place={index}
            drawing={sides[index].drawing}
            measures={sides[index].measures}
            labels={sides[index].labels}
            stale={sides[index].stale}
            onSave={() => save(index)}
            onEnlarge={() => setView({ sheet: index })}
          />
        ))}
      </div>
      {alone !== null && <Alone name={SIDES[alone].name} on={onPaper} />}
    </>
  )
}
