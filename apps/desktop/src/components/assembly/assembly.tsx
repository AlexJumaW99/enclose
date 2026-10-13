// The assembly guides of a model: how the thing is put together, a step at a time, each
// guide a page of its own that is opened in the browser. Their covers stand in a row
// where the view of the model was, the way a blueprint's sheets do, the one written last
// first: what each is a guide to, when it was written and which writing of it it is,
// and a drawing of the thing, large, as on the cover of a manual. A cover that is
// pressed opens its guide; the arrow over it takes the guide away as one archive, with
// the parts in it.
//
// A guide is written by Claude, when it is asked for at the foot of the row (see
// AskForGuide): of the whole model, or of what was picked out of it before the guides
// were turned to.
import * as React from "react"
import * as THREE from "three"
import { cn } from "cn"
import { DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react"

import type { GuideSummary, Looks, ObjectRef, Project, Vec3 } from "@shared/api"
import {
  keyOf,
  laidOut,
  Lines,
  type Drawing,
} from "@/components/blueprint/blueprint"
import { drawn, type Looking, type Stroke } from "@/components/blueprint/lines"
import { lookingFrom, SHEET, type Seen } from "@/components/blueprint/sheet"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { objectsOf } from "@/components/viewport/apart"
import type { LoadedModel, LoadedPart } from "@/components/viewport/load"
import { MAC } from "@/lib/platform"
import { allOf, goesBy, useStore } from "@/lib/store"

/** Stable while a project's guides are not read yet. */
const NOT_READ: GuideSummary[] = []
const NO_COLOURS: Record<string, string> = {}

/**
 * How a cover's drawing is set on its sheet, as shares of the sheet: how far down it
 * begins and how far down it ends, and how much of each side is kept clear. That is
 * nearly all of the sheet: the drawing has the sheet to itself, and what is written on
 * the cover is written over it, in the corners, and is not something it begins after.
 * It is what the cover is filled with that is kept within these: the rest of the thing
 * goes where it goes, off the sheet's edge if it comes to that.
 */
const SET = { top: 0.07, foot: 0.97, side: 0.06 }
/** How long the drawing goes on at a time, in ms, before the window is let draw itself. */
const AT_A_TIME_MS = 10
/**
 * How far the pointer has to go, held down on the row of covers, before the row is being
 * pulled along by it, in pixels: less, and it is a press on whatever is under it.
 */
const PULLED_PX = 4
/** How long after the cover before it each cover comes in, as the guides come up, ms. */
const AFTER_MS = 70

const counted = (many: number, what: string) =>
  `${many} ${what}${many === 1 ? "" : "s"}`

/** What the system calls where a file goes that is taken away, to be had back from. */
const BIN = MAC ? "Trash" : "Recycle Bin"

/** A day as a cover says it: "Oct 12, 2026". */
const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

/** A project's guides, as their covers have them: read again whenever one is written. */
function useGuides(project: Project): GuideSummary[] | null {
  const [guides, setGuides] = React.useState<GuideSummary[] | null>(null)
  React.useEffect(() => {
    let over = false
    void (
      project.assembly === null
        ? Promise.resolve(NOT_READ)
        : window.cad.assembly.read(project.id)
    ).then((read) => {
      // (those it had stay up until the ones it has now are read)
      if (!over) setGuides(read)
    })
    return () => {
      over = true
    }
  }, [project.id, project.assembly])
  return guides
}

/** The drawings made for covers, by what they are of: the last few, to come up with at once. */
const kept = new Map<string, Drawing>()
const KEPT = 8

/** Where a thing is drawn from on its cover when its guide does not say: its front right corner, from above. */
const FROM: Vec3 = [1, -1, 1]

/**
 * How the model is looked at from somewhere, said as the way from the model to the eye:
 * whatever way that is, since a cover is drawn from wherever the thing looks its best.
 * Straight above and straight below are a hair off, so that there is a front to them.
 */
function lookingAt([x, y, z]: Vec3): Looking {
  const far = Math.hypot(x, y, z) || 1
  return lookingFrom({
    // round from the front, which is the model's -Y, towards its right
    azimuth: Math.atan2(x, -y),
    // and down from straight above
    polar: Math.min(Math.PI - 0.01, Math.max(0.01, Math.acos(z / far))),
  })
}

/** The room some parts take up as they are looked at, in the model's own measure. */
function roomOf(parts: LoadedPart[], { right, up }: Looking): Seen {
  const room = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }
  const corner = new THREE.Vector3()
  const [across, high] = [new THREE.Vector3(...right), new THREE.Vector3(...up)]
  for (const { box, home } of parts)
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z
        )
        .applyMatrix4(home)
      room.x0 = Math.min(room.x0, corner.dot(across))
      room.x1 = Math.max(room.x1, corner.dot(across))
      room.y0 = Math.min(room.y0, corner.dot(high))
      room.y1 = Math.max(room.y1, corner.dot(high))
    }
  return room
}

/**
 * A drawing of these parts for a cover: their lines from one corner, as a blueprint
 * draws them, a little at a time so that the window is never held up. It is set on a
 * sheet the shape of the cover, as big as makes the parts the cover is filled with
 * (`filled`, or all of them) fill what room the sheet has under its title: the rest are
 * drawn where that leaves them, which may be off its edge. Null until it is done, and
 * of no parts at all.
 */
function useDrawing(
  parts: LoadedPart[],
  cover: GuideSummary["cover"]
): Drawing | null {
  const filled = cover.parts.join("\n")
  const from = (cover.view ?? FROM).join()
  const of = React.useMemo(
    () => `${keyOf(parts, 0)} from ${from} of ${filled}`,
    [parts, from, filled]
  )
  const [made, setMade] = React.useState<{
    of: string
    drawing: Drawing
  } | null>(null)
  React.useEffect(() => {
    if (parts.length === 0 || kept.has(of)) return
    let stopped = false
    const draw = async () => {
      const looking = lookingAt(cover.view ?? FROM)
      const run = drawn(laidOut(parts, 0).bodies, looking)
      let strokes: Stroke[][]
      let since = performance.now()
      for (;;) {
        const step = run.next()
        if (step.done) {
          strokes = step.value
          break
        }
        if (performance.now() - since < AT_A_TIME_MS) continue
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (stopped) return
        since = performance.now()
      }
      // What the cover is filled with fits the room the sheet has for it, and is in
      // the middle of that room: which is lower on the sheet than the sheet's own.
      const wanted = new Set(cover.parts)
      const some = parts.filter((part) => wanted.has(part.part.id))
      const room = roomOf(some.length > 0 ? some : parts, looking)
      const by = Math.max(
        (room.x1 - room.x0) / (SHEET.width * (1 - 2 * SET.side)),
        (room.y1 - room.y0) / (SHEET.height * (SET.foot - SET.top)),
        1e-6
      )
      const drawing: Drawing = {
        strokes,
        placing: {
          middle: [
            (room.x0 + room.x1) / 2,
            (room.y0 + room.y1) / 2 +
              by * SHEET.height * ((SET.top + SET.foot) / 2 - 0.5),
          ],
          by,
          paper: SHEET,
        },
      }
      kept.set(of, drawing)
      for (const old of [...kept.keys()].slice(0, -KEPT)) kept.delete(old)
      setMade({ of, drawing })
    }
    void draw()
    return () => {
      stopped = true
    }
    // (what the cover says is all in `of`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [of, parts])
  return kept.get(of) ?? (made?.of === of ? made.drawing : null)
}

/** What every cover is, in the row: a sheet of paper, upright, four wide to five high. */
const PAPERED =
  "relative overflow-hidden rounded-[18px] h-[min(744px,calc(100cqh-180px))] w-[calc(min(744px,100cqh-180px)*0.8)]"

/**
 * Under the one sheet there is, which stands in the middle of the view: as much room as
 * its heading takes over it, so that it is the paper that is in the middle, where the
 * empty sheet was before it.
 */
const UNDER = <div className="mt-2.5 h-9" aria-hidden />

/** One guide's cover: what it is to and the way to take it away, over the paper that opens it. */
function Cover({
  guide,
  place,
  parts,
  alone,
  busy,
  onOpen,
  onSave,
  onRemove,
}: {
  guide: GuideSummary
  /** its place in the row, from the left: it comes in that much after the first */
  place: number
  /** the parts of the model that it shows, as far as the model still has them */
  parts: LoadedPart[]
  /** it is the only sheet there is, and stands in the middle of the view */
  alone: boolean
  /** Claude is at work in the project: nothing is taken out of its folder meanwhile */
  busy: boolean
  onOpen: () => void
  onSave: () => void
  onRemove: () => void
}) {
  const drawing = useDrawing(parts, guide.cover)
  // parts it names that the model has no longer: they are left out of what it shows
  const gone = guide.parts.length - parts.length
  const readable = guide.trouble === null
  return (
    <section
      className="flex shrink-0 animate-in flex-col duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-both fade-in slide-in-from-bottom-6 motion-reduce:animate-none"
      style={{ animationDelay: `${place * AFTER_MS}ms` }}
    >
      <header className="mb-2.5 flex h-9 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-medium">
          {guide.title}
          <span className="ml-2 text-foreground/45 tabular-nums">
            v{guide.version}
          </span>
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-foreground/8 hover:bg-foreground/14 dark:hover:bg-foreground/14"
                  disabled={!readable}
                  onClick={onSave}
                />
              }
            >
              <DownloadIcon />
              <span className="sr-only">Download as a zip</span>
            </TooltipTrigger>
            <TooltipContent side="top">Download as a zip</TooltipContent>
          </Tooltip>
          {/* And what takes the guide away, in the colour of something not to be
              pressed by mistake: red on a darker red. It goes to the system's bin,
              and can be had back from there. (A guide that does not read can still
              be taken away: it is the one most likely to be.) */}
          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-destructive/20 text-destructive hover:bg-destructive/30 hover:text-destructive dark:bg-destructive/25 dark:hover:bg-destructive/40"
                  disabled={busy}
                  onClick={onRemove}
                />
              }
            >
              <Trash2Icon />
              <span className="sr-only">Delete</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {busy ? AT_WORK : `Move to the ${BIN}`}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
      <button
        type="button"
        data-paper
        aria-label={`Open the guide to ${guide.title}, version ${guide.version}`}
        disabled={!readable}
        onClick={onOpen}
        className={cn(
          PAPERED,
          "cursor-pointer bg-white text-left text-black ring-1 ring-foreground/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default dark:bg-[#f5f6ec] dark:ring-0 dark:focus-visible:ring-[3px]"
        )}
      >
        {/* The thing, drawn as a blueprint draws it, on all of the sheet, from edge to
            edge and from top to foot: as big as its guide has it, and going off the
            sheet's edge where it does. */}
        {readable &&
          (drawing ? (
            <div className="absolute inset-0 animate-in duration-300 fade-in">
              <Lines drawing={drawing} measures={null} labels={null} />
            </div>
          ) : (
            parts.length > 0 && (
              <div className="absolute inset-0 flex animate-in items-center justify-center delay-300 duration-300 fill-mode-both fade-in">
                <Spinner className="size-5 text-black/35" />
              </div>
            )
          ))}
        {/* What is written on it is over the drawing, in its top corners, in the
            app's own sizes whatever size the sheet is: at the left what it is a
            guide to, and under that, smaller, how much there is to it; at the right,
            which writing of it this is. The lines may well run on under any of it:
            each word has the paper's own colour close round it, to be read over them. */}
        <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-4 [text-shadow:0_0_2px_#fff,0_0_3px_#fff,0_0_6px_#fff] dark:[text-shadow:0_0_2px_#f5f6ec,0_0_3px_#f5f6ec,0_0_6px_#f5f6ec]">
          <div className="min-w-0">
            <div className="text-sm/5">
              <div className="truncate font-semibold">{guide.title}</div>
              <div className="text-black/45">Assembly Guide</div>
              <div className="text-black/45">{day.format(guide.made)}</div>
            </div>
            <div className="mt-1.5 text-[11px]/4 text-black/45 tabular-nums">
              {readable ? (
                <div className="truncate">
                  {counted(guide.steps, "step")},{" "}
                  {gone > 0
                    ? `${counted(gone, "part")} no longer in the model`
                    : counted(guide.parts.length, "part")}
                </div>
              ) : (
                <div className="mt-2 text-black/55">
                  This guide could not be read. {guide.trouble}
                </div>
              )}
            </div>
          </div>
          {/* (level with the first line across from it) */}
          <div className="shrink-0 text-[11px]/5 text-black/45 tabular-nums">
            Version {guide.version}
          </div>
        </div>
      </button>
      {alone && UNDER}
    </section>
  )
}

/** In the row where a guide will be, while Claude is writing it. */
function BeingWritten({ alone }: { alone: boolean }) {
  return (
    <section className="flex shrink-0 animate-in flex-col duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-both fade-in slide-in-from-bottom-6 motion-reduce:animate-none">
      <header className="mb-2.5 flex h-9 items-center">
        <h2 className="shimmer text-base font-medium text-muted-foreground shimmer-color-foreground">
          Writing a guide
        </h2>
      </header>
      <div
        className={cn(
          PAPERED,
          "flex items-center justify-center bg-white/55 dark:bg-[#f5f6ec]/45"
        )}
      >
        <Spinner className="size-5 text-black/45" />
      </div>
      {alone && UNDER}
    </section>
  )
}

/**
 * Where a cover would be, of a model that has no guide yet: an empty sheet in the middle
 * of the view, which says so in two lines and, pressed, asks for the first, as the
 * button at the foot does.
 */
function NoneYet({ asking }: { asking: Asking }) {
  const { of, busy, ask } = asking
  return (
    <button
      type="button"
      data-paper
      disabled={busy}
      title={busy ? AT_WORK : undefined}
      onClick={ask}
      className={cn(
        PAPERED,
        "flex shrink-0 animate-in cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-foreground/20 px-10 text-center transition-colors duration-500 fill-mode-both outline-none fade-in hover:border-foreground/40 hover:bg-foreground/[0.03] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:border-foreground/20 disabled:hover:bg-transparent"
      )}
    >
      <span className="text-base font-medium">No assembly guide yet</span>
      <span className="max-w-full truncate text-sm text-muted-foreground">
        {of ? `Click to create one for ${of.label}` : "Click to create one"}
      </span>
    </button>
  )
}

export function Assembly({
  project,
  loaded,
  listed,
}: {
  project: Project
  loaded: LoadedModel
  /** its parts, as what a piece is made out from: what a guide can be asked for of */
  listed: Listed[]
}) {
  const guides = useGuides(project)
  const asking = useAsking(project, listed, loaded.model.groups)
  // with no guide to show, and none on its way, there is only what asks for the first
  const none = guides?.length === 0 && !project.assembling
  // That is in the middle of the view, and so is the first guide, while it is being
  // written and once it is: one sheet is no row. With a second they stand in a row,
  // from the left.
  const alone =
    guides !== null && guides.length + (project.assembling ? 1 : 0) <= 1
  const colours = useStore((state) => state.colours[project.id] ?? NO_COLOURS)
  const say = useStore((state) => state.say)
  const looks = React.useMemo((): Looks => ({ colours }), [colours])
  // The parts each guide shows, as the model has them: those of every guide to the
  // whole model are the same ones, and are drawn the once.
  const every = loaded.parts
  const shown = React.useMemo(() => {
    const of = new Map<string, LoadedPart[]>()
    return (guides ?? []).map((guide) => {
      const ids = new Set(guide.parts)
      const parts = every.filter((part) => ids.has(part.part.id))
      if (parts.length === every.length) return every
      const key = parts.map((part) => part.part.id).join("\n")
      if (!of.has(key)) of.set(key, parts)
      return of.get(key)!
    })
  }, [guides, every])

  // The row is gone along by taking hold of it anywhere and pulling, as a blueprint's
  // is: where the pointer went down, and how far along the row was then.
  const held = React.useRef<{
    x: number
    left: number
    pulled: boolean
  } | null>(null)
  const [pulling, setPulling] = React.useState(false)
  /** it was pulled, and let go: the press that ends that is not one on a cover */
  const pulled = React.useRef(false)

  const open = (guide: GuideSummary) =>
    void window.cad.assembly.open(project.id, guide.id, looks)
  const save = (guide: GuideSummary) =>
    void window.cad.assembly.save(project.id, guide.id, looks).then((saved) => {
      if (saved) say(`Saved the guide to ${guide.title} as a zip`)
    })
  const remove = (guide: GuideSummary) =>
    void window.cad.assembly.remove(project.id, guide.id).then((went) => {
      say(
        went
          ? `Moved ${guide.title}, version ${guide.version}, to the ${BIN}`
          : "That guide could not be moved away"
      )
    })

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        // The covers go off to the right, and are gone along sideways: a wheel that
        // only turns up and down goes along them too. The first starts clear of the
        // projects' cards, and the last can be brought clear of the buttons down the
        // other edge. (It is what their sizes are said as lengths of: see PAPERED.)
        className={cn(
          "[container-type:size] absolute inset-0 flex [scrollbar-width:none] items-center overflow-x-auto overflow-y-hidden overscroll-x-contain select-none",
          // (the one sheet there is, is in the middle of the view, over what is at its
          // foot, and there is no row to take hold of)
          alone
            ? "justify-center"
            : cn(
                "gap-10 pr-25 pl-68",
                pulling
                  ? "cursor-grabbing [&_*]:cursor-grabbing"
                  : "cursor-grab"
              )
        )}
        aria-busy={guides === null}
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
        {project.assembling && <BeingWritten alone={alone} />}
        {(guides ?? []).map((guide, index) => (
          <Cover
            key={guide.id}
            guide={guide}
            place={index + (project.assembling ? 1 : 0)}
            parts={shown[index]}
            alone={alone}
            busy={asking.busy}
            onOpen={() => open(guide)}
            onSave={() => save(guide)}
            onRemove={() => remove(guide)}
          />
        ))}
        {none && <NoneYet asking={asking} />}
      </div>
    </div>
  )
}

/** A part as what a piece is made out from. */
type Listed = Parameters<typeof objectsOf<string>>[0][number]

/** What is said of asking for a guide while Claude is at work on something else. */
const AT_WORK = "Claude is at work in this project"

/**
 * How a guide is asked for, as things stand: of the one thing that was picked out of
 * the model before the guides were turned to, or of the whole model (null). Not while
 * Claude is at work in the project: one thing at a time is done there.
 */
type Asking = {
  of: ObjectRef | null
  busy: boolean
  /** ask for a guide of that */
  ask: () => void
  /** ask for one of the whole model, whatever is picked out */
  whole: () => void
}

function useAsking(
  project: Project,
  listed: Listed[],
  groups: LoadedModel["model"]["groups"]
): Asking {
  const selection = useStore((state) => state.selection)
  const several = useStore((state) => state.several)
  const assemble = useStore((state) => state.assemble)
  const busy = project.conversations.some((one) => one.status !== "idle")
  const of = React.useMemo((): ObjectRef | null => {
    const picked = selection
      ? { label: goesBy(selection.part), parts: allOf(selection.part) }
      : several.length > 0
        ? (() => {
            // one whole object goes by its name, and anything else by how much it is
            const { objects, loose } = objectsOf(listed, groups, several)
            return objects.length === 1 && loose.length === 0
              ? objects[0]
              : { label: counted(several.length, "part"), parts: several }
          })()
        : null
    // (all of the model picked out is the whole model)
    return picked && picked.parts.length < listed.length ? picked : null
  }, [selection, several, listed, groups])
  return {
    of,
    busy,
    ask: () => assemble(of),
    whole: () => assemble(null),
  }
}

/**
 * At the foot of the guides: what asks Claude for one. Of the whole model; or, where
 * something was picked out of the model before the guides were turned to, of that, with
 * the whole model still to be had beside it. It is not there while a guide is being
 * written, which is said in its place, and is not to be pressed while Claude is at work
 * on something else in the project.
 */
export function AskForGuide({
  project,
  listed,
  groups,
}: {
  project: Project
  listed: Listed[]
  groups: LoadedModel["model"]["groups"]
}) {
  const { of, busy, ask, whole } = useAsking(project, listed, groups)
  if (project.assembling) return null
  return (
    <div
      className="pointer-events-auto flex animate-in items-center gap-2 duration-150 fade-in slide-in-from-bottom-2"
      title={busy ? AT_WORK : undefined}
    >
      <Button
        size="lg"
        // room either side of the words, a little less of it past the sign
        className="max-w-md gap-2 pr-4 pl-5 shadow-md"
        disabled={busy}
        onClick={ask}
      >
        <span className="truncate">
          {of ? `New guide for ${of.label}` : "New assembly guide"}
        </span>
        <PlusIcon data-icon="inline-end" />
      </Button>
      {of && (
        <Button
          size="lg"
          variant="outline"
          className="glass bg-background/60 px-5 shadow-md"
          disabled={busy}
          onClick={whole}
        >
          Whole model
        </Button>
      )}
    </div>
  )
}
