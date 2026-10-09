// The blueprint of a model: the model drawn flat, from each of its sides and from four of
// its corners, each drawing on a sheet of its own. The sheets stand in a row where the view of the model was, to be
// gone along; and each can be taken away as a file of its lines, an SVG.
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
import type { LoadedModel, LoadedPart } from "@/components/viewport/load"
import { usePreferences } from "@/lib/preferences"
import { dimensionsOf, type Room } from "./dimensions"
import { drawn, type Body, type Stroke } from "./lines"
import {
  FIGURES,
  INK,
  LINE,
  PENCIL,
  reduction,
  scaleSaid,
  SHEET,
  SIDES,
  svgOf,
  THIN,
  type Dimension,
  type Placing,
} from "./sheet"

/** How long the drawing goes on at a time, in ms, before the window is let draw itself. */
const AT_A_TIME_MS = 10
/**
 * How long what is to be drawn has to stay the same, in ms, before it is drawn again: a
 * slider is dragged through many places on its way to one.
 */
const SETTLED_MS = 120
/**
 * How wide a line is on the screen, in pixels: what it is on a sheet shown at its full
 * size, a pixel to the point, and no thinner on a sheet that a small window shows smaller.
 */
const LINE_PX = (LINE * 72) / 25.4
/** And the same of what a sheet says of the model's size: its lines, and its figures. */
const THIN_PX = (THIN * 72) / 25.4
const FIGURES_PX = (FIGURES * 72) / 25.4

/** A moment for the window to draw itself in. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0))

/** One side of the model, drawn: the lines of each part, and where they sit on the sheet. */
type Drawing = { strokes: Stroke[][]; placing: Placing }

/** The sheets of a model: its sides, as far as they have been drawn. */
type Sheets = {
  /** what they are a drawing of: tells one drawing of the model from the next */
  of: string
  /** the parts drawn, by id, in the order their lines are kept in */
  parts: string[]
  /** the room they take up between them, which is what a sheet gives the size of */
  room: Room
  sides: (Drawing | null)[]
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
    skins: part.skins.map(({ geometry }) => ({
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
  // the sides to one scale, and the corners to one
  const scales = [true, false].map((flat) =>
    reduction(
      rooms
        .filter((_, index) => SIDES[index].flat === flat)
        .map((room) => ({
          width: room.x1 - room.x0,
          height: room.y1 - room.y0,
        }))
    )
  )
  const placings = rooms.map((room, index): Placing => ({
    middle: [(room.x0 + room.x1) / 2, (room.y0 + room.y1) / 2],
    by: scales[SIDES[index].flat ? 0 : 1],
  }))
  return { bodies, placings, room }
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
      const { bodies, placings, room } = laidOut(parts, apart)
      const fresh: Sheets = {
        of,
        parts: parts.map((part) => part.part.id),
        room,
        sides: SIDES.map(() => null),
      }
      for (const index of inSightFirst(row.current)) {
        const run = drawn(bodies, SIDES[index].looking)
        let since = performance.now()
        for (;;) {
          const step = run.next()
          if (step.done) {
            fresh.sides[index] = {
              strokes: step.value,
              placing: placings[index],
            }
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
 * And over them what the sheet says of how big the model is, where it says.
 */
function Lines({
  drawing,
  measures,
}: {
  drawing: Drawing | null
  measures: Dimension[] | null
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
      // pixels to the millimetre of sheet, and to the millimetre of model
      const per = width / SHEET.width
      const { middle, by } = drawing.placing
      const scale = per / by
      const left = (SHEET.width / 2) * per - middle[0] * scale
      const top = (SHEET.height / 2) * per + middle[1] * scale
      context.lineWidth = Math.max(LINE * per, LINE_PX * ratio)
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
      if (!measures) return
      context.lineWidth = Math.max(THIN * per, THIN_PX * ratio)
      context.strokeStyle = PENCIL
      context.fillStyle = PENCIL
      context.font = `400 ${Math.max(FIGURES * per, FIGURES_PX * ratio)}px "Inter Variable", sans-serif`
      context.textAlign = "center"
      context.textBaseline = "alphabetic"
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
  }, [drawing, measures])
  return <canvas ref={canvas} className="absolute inset-0 size-full" />
}

/** One sheet: what it is of and the way to take it away, over the paper with the drawing on it. */
function Sheet({
  name,
  drawing,
  measures,
  stale,
  onSave,
}: {
  name: string
  /** null until it has been drawn */
  drawing: Drawing | null
  /** what it says of how big the model is, if it says */
  measures: Dimension[] | null
  /** what is on it is of the model as it was, and is being drawn again */
  stale: boolean
  onSave: () => void
}) {
  return (
    <section className="flex shrink-0 flex-col gap-2.5">
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
          at its top and its foot, and no taller than it is at a pixel to the point */}
      <div className="relative aspect-[4/5] h-[min(744px,calc(100svh-180px))] overflow-hidden rounded-[18px] bg-white ring-1 ring-foreground/10 dark:bg-[#f5f6ec] dark:ring-0">
        {/* a drawing that is being done again waits faintly for the one to take its
            place: but not at once, in case that is here before anyone could tell */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            stale && "opacity-25 delay-200"
          )}
        >
          <Lines drawing={drawing} measures={measures} />
        </div>
        {(!drawing || stale) && (
          <div className="absolute inset-0 flex animate-in items-center justify-center delay-300 duration-300 fill-mode-both fade-in">
            <Spinner className="size-5 text-black/35" />
          </div>
        )}
      </div>
    </section>
  )
}

export function Blueprint({
  loaded,
  parts,
  apart,
  dimensions,
  name,
}: {
  loaded: LoadedModel
  /** the parts of it that are on show: the ones that are drawn */
  parts: LoadedPart[]
  /** how far they are pulled apart: nothing, put together */
  apart: number
  /** whether the sheets say how big the model is */
  dimensions: boolean
  /** what the model is called, for its files to go by */
  name: string
}) {
  const row = React.useRef<HTMLDivElement>(null)
  const { now, was } = useSheets(parts, apart, row)
  const units = usePreferences((state) => state.units)
  /**
   * What is on each sheet: its drawing of the model as it is on show, or until that is
   * done the one of the model as it was (`stale`); and what it says of how big the
   * model is, where the sheets say.
   */
  const sides = React.useMemo(
    () =>
      SIDES.map((side, index) => {
        const of = now?.sides[index] ? now : was?.sides[index] ? was : null
        const drawing = of?.sides[index] ?? null
        return {
          drawing,
          stale: drawing !== null && of !== now,
          measures:
            of && drawing && dimensions
              ? dimensionsOf(
                  of.room,
                  side.looking,
                  side.flat,
                  drawing.placing,
                  units
                )
              : null,
        }
      }),
    [now, was, dimensions, units]
  )

  const save = (index: number) => {
    const { drawing, measures, stale } = sides[index]
    if (!now || !drawing || stale) return
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
      groups: loaded.model.groups.map((group) => ({
        id: group.id,
        label: group.label,
        parts: loaded.model.parts.flatMap((part) => {
          const strokes = part.group === group.id && lines.get(part.id)
          return strokes ? [{ id: part.id, label: part.label, strokes }] : []
        }),
      })),
    })
    void window.cad.model.saveDrawing(
      `${fileName(name)}-${fileName(side)}.svg`,
      svg
    )
  }

  return (
    <div
      // The sheets go off to the right, and are gone along sideways: a wheel that only
      // turns up and down goes along them too. The first starts clear of the projects'
      // cards, and the last can be brought clear of the buttons down the other edge.
      ref={row}
      className="absolute inset-0 flex [scrollbar-width:none] items-center gap-10 overflow-x-auto overflow-y-hidden overscroll-x-contain pr-25 pl-68"
      aria-busy={sides.some(({ drawing, stale }) => !drawing || stale)}
      onWheel={(event) => {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
          event.currentTarget.scrollLeft += event.deltaY
      }}
    >
      {SIDES.map((side, index) => (
        <Sheet
          key={side.name}
          name={side.name}
          drawing={sides[index].drawing}
          measures={sides[index].measures}
          stale={sides[index].stale}
          onSave={() => save(index)}
        />
      ))}
    </div>
  )
}
