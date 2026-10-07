// What is shown with a part that is picked out, and on a part something has been said
// of. All of it is drawn over the view and keeps to the part as the view is turned: the
// part's name to one side of it, what can be done with it to the other, and a mark on
// every part that has something waiting to be sent about it.
import * as React from "react"
import * as THREE from "three"
import { Html } from "@react-three/drei"
import { cn } from "cn"
import {
  ArrowUpIcon,
  DownloadIcon,
  MessageSquareIcon,
  XIcon,
} from "lucide-react"

import type { Vec3 } from "@shared/api"
import { PALETTE, type PaletteName } from "@shared/palette"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Model } from "@/lib/model"
import { MAC } from "@/lib/platform"
import { useStore, type Note } from "@/lib/store"
import type { LoadedPart } from "./load"

/** Over the view, under whatever of the window floats over it. */
const OVER: [number, number] = [30, 0]
/** How near the edges of the view these may be drawn: the window has things there. */
const ROOM = { left: 290, right: 76, top: 60, bottom: 90 }
/** How far what is shown at a place on a part reaches from it, each way, about. */
const BUTTONS = { left: 250, right: 70, up: 24, down: 24 }
const WRITING = { left: 150, right: 150, up: 60, down: 130 }
const RING = { left: 150, right: 108, up: 108, down: 108 }
/** How wide the box that is written in is, and how far above the place it starts, px. */
const WRITING_WIDTH = 288
const WRITING_ABOVE = 24
/** What every button floating over the view is: a frosted circle of its own. */
const ROUND =
  "glass size-9 rounded-full bg-background/60 px-0 shadow-sm ring-1 ring-foreground/10"

// A press on any of these is not a press on the view under it: the view is not turned
// by it. (Each is drawn by a root of its own inside the view, so this is where a press
// stops before the view hears of it.)
const held = (event: React.PointerEvent) => event.stopPropagation()

const between = (value: number, least: number, most: number) =>
  Math.min(Math.max(value, least), Math.max(least, most))

type Size = { width: number; height: number }

/** The STEP file of one part, if the model hands one out. */
function downloadFor(model: Model, partId: string, label: string) {
  return (
    model.downloads.find((d) => d.part === partId) ??
    model.downloads.find(
      (d) => d.kind === "part" && d.label.toLowerCase() === label.toLowerCase()
    )
  )
}

/**
 * The box becoming a chip on the message box: it goes there as it shrinks, quickly, and
 * most of the way at once. `from` is where the box was; the chip is found by its note.
 */
function fly(from: DOMRect, note: string) {
  const ghost = document.createElement("div")
  ghost.className =
    "pointer-events-none fixed z-50 rounded-2xl border bg-popover shadow-xl"
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    transformOrigin: "top left",
  })
  document.body.append(ghost)
  // the chip is on the message box a moment after the note is made
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const to = document
        .querySelector(`[data-note="${note}"]`)
        ?.getBoundingClientRect()
      if (!to) return ghost.remove()
      void ghost
        .animate(
          [
            { transform: "none", opacity: 1 },
            {
              transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
              opacity: 0.35,
            },
          ],
          // out fast and settling: "expo out"
          { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
        )
        .finished.finally(() => ghost.remove())
    })
  )
}

/**
 * Where something is said of the part: what should change at the place that was clicked.
 * Enter keeps it for the next message, as a chip on the message box, where more can be
 * gathered from other parts; with Cmd (or Ctrl) held, it and everything waiting are
 * sent at once. Esc, or Cancel, leaves things as they were.
 */
function Writing({ label, note }: { label: string; note: Note | null }) {
  const write = useStore((state) => state.write)
  const [text, setText] = React.useState(note?.text ?? "")
  const box = React.useRef<HTMLDivElement>(null)

  const keep = (now: boolean) => {
    const from = box.current?.getBoundingClientRect()
    const { keepNote, send, setThreadOpen } = useStore.getState()
    const id = keepNote(text)
    if (!id) return
    // where it has gone is on show
    setThreadOpen(true)
    if (now) send()
    else if (from) fly(from, id)
  }

  return (
    <div onPointerDown={held} style={{ width: WRITING_WIDTH }}>
      <div
        ref={box}
        className="flex w-full flex-col gap-2 rounded-2xl border bg-popover/95 p-3 shadow-xl"
      >
        {/* which part this is said of */}
        <Badge variant="secondary" className="max-w-full self-start">
          <span className="truncate">{label}</span>
        </Badge>
        <textarea
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={(event) => {
            // carrying on from the end of what was written
            const end = event.target.value.length
            event.target.setSelectionRange(end, end)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation()
              write(null)
            }
            if (
              event.key !== "Enter" ||
              event.shiftKey ||
              event.nativeEvent.isComposing
            )
              return
            event.preventDefault()
            keep(event.metaKey || event.ctrlKey)
          }}
          placeholder="What should change here?"
          rows={2}
          className="field-sizing-content max-h-40 min-h-11 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2">
          {/* the sign for the key has room of its own to its left, which would set
              the line in from the words above it */}
          <span
            className={cn("text-xs text-muted-foreground", MAC && "-ml-px")}
          >
            {MAC ? "⌘" : "Ctrl"} Enter to send now
          </span>
          <Button
            size="icon-sm"
            className="rounded-full"
            disabled={!text.trim() && !note}
            onClick={() => keep(false)}
          >
            <ArrowUpIcon />
            <span className="sr-only">Add to the message</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

/** A round button over the view, named by what it does. */
function Does({
  label,
  children,
  ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" className={ROUND} {...props} />
        }
      >
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** How far out from the middle the colours stand when a part is given one, px. */
const RING_OUT = 84
/** How long a part stays in the colour it was just given before the selection's is back, ms. */
const SEEN_FOR_MS = 1400
/** How far apart the middles of two of the buttons are, side by side, px. */
const STEP = 42

/**
 * The colours a part can be given, for as long as one is being chosen: the app's own, in
 * a ring round the button that was pressed for them, which stays just where it was and
 * as it was. Choosing one puts them away, and choosing the one the part already has
 * takes it back; Esc, or the button in the middle, puts them away with nothing changed.
 */
function Colours({
  partId,
  shown,
  onDone,
}: {
  partId: string
  /** the colour the part is drawn in, "#rrggbb" */
  shown: string
  /** the ring is done with: a colour was given or taken back, or nothing was */
  onDone: (gave: boolean) => void
}) {
  const chosen = useStore((state) =>
    state.activeId ? (state.colours[state.activeId]?.[partId] ?? null) : null
  )
  const setColour = useStore((state) => state.setColour)
  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // and it is not taken for leaving anything else, by whoever else listens for it
      event.preventDefault()
      event.stopImmediatePropagation()
      onDone(false)
    }
    window.addEventListener("keydown", key, true)
    return () => window.removeEventListener("keydown", key, true)
  }, [onDone])

  const names = Object.keys(PALETTE) as PaletteName[]
  return (
    <div onPointerDown={held} className="relative size-0">
      <Button
        variant="ghost"
        size="icon"
        title="Leave it as it is"
        onClick={() => onDone(false)}
        className={cn(ROUND, "absolute top-0 left-0 -translate-1/2")}
      >
        <span
          className="size-4 rounded-full ring-1 ring-foreground/20"
          style={{ background: shown }}
        />
      </Button>
      {names.map((name, index) => {
        // round from the top, the way the colours go round
        const turn = (index / names.length) * 2 * Math.PI
        // as it is said, where the name it goes by in a model runs two words together
        const said = name === "lightgrey" ? "light grey" : name
        const called = said[0].toUpperCase() + said.slice(1)
        return (
          <Button
            key={name}
            variant="ghost"
            size="icon"
            title={chosen === name ? `${called}: take it back` : called}
            aria-pressed={chosen === name}
            onClick={() => {
              setColour(partId, chosen === name ? null : name)
              onDone(true)
            }}
            style={{
              left: Math.sin(turn) * RING_OUT,
              top: -Math.cos(turn) * RING_OUT,
            }}
            className={cn(
              ROUND,
              "absolute -translate-1/2 animate-in duration-150 zoom-in-50 fade-in aria-pressed:ring-2 aria-pressed:ring-foreground"
            )}
          >
            <span
              className="size-4 rounded-full"
              style={{ background: PALETTE[name] }}
            />
          </Button>
        )
      })}
    </div>
  )
}

/**
 * Leaving what is being written, without keeping it. It stands on its own over the view,
 * off the top corner of the box, in white that is turned to the opposite of whatever is
 * behind it, so that it shows on any part. With the pointer on it, it is plain: black on
 * white.
 */
function Cancel({
  at,
  kept,
}: {
  at: THREE.Vector3
  kept: (el: THREE.Object3D, camera: THREE.Camera, size: Size) => number[]
}) {
  const [over, setOver] = React.useState(false)
  return (
    <Html
      position={at}
      calculatePosition={kept}
      zIndexRange={OVER}
      // the whole of it is set against the view, which is how its colour is turned
      wrapperClass={over ? "mix-blend-normal" : "mix-blend-difference"}
    >
      <button
        type="button"
        onPointerDown={held}
        onPointerEnter={() => setOver(true)}
        onPointerLeave={() => setOver(false)}
        onClick={() => useStore.getState().write(null)}
        // its right end over the right end of the box, a little above it
        style={{ left: WRITING_WIDTH / 2, bottom: WRITING_ABOVE + 6 }}
        className={cn(
          "absolute flex h-6 -translate-x-full cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap outline-none",
          over ? "bg-white text-black" : "text-white"
        )}
      >
        <XIcon className="size-3.5" />
        Cancel
      </button>
    </Html>
  )
}

/** A place on a part, kept where the part really sits, in the part's own frame. */
const placeOn = (loaded: LoadedPart, point: Vec3 | null) =>
  point
    ? new THREE.Vector3(...point).applyMatrix4(loaded.home.clone().invert())
    : loaded.box.getCenter(new THREE.Vector3())

/**
 * With the part that is picked out, at the very place on it that was clicked: what can
 * be done with it, and its name beside that - or, once something is being said of it,
 * where that is written. They are fixed to that place on the part, and go where it goes
 * as the view is turned; only the edges of the view hold them back, so that they can
 * always be reached.
 */
export function PartMarks({
  loaded,
  model,
  projectId,
  shown,
}: {
  loaded: LoadedPart
  model: Model
  projectId: string
  /** the colour the part is drawn in, "#rrggbb" */
  shown: string
}) {
  const { part } = loaded
  const writing = useStore((state) => state.writing)
  const write = useStore((state) => state.write)
  const point = useStore((state) => state.selection?.part.point ?? null)
  const note = useStore((state) =>
    writing && writing !== "new"
      ? (state.notes[projectId]?.find((one) => one.id === writing) ?? null)
      : null
  )
  const download = downloadFor(model, part.id, part.label)
  const written = writing !== null
  const at = React.useMemo(() => placeOn(loaded, point), [loaded, point])
  // a colour is being chosen, here: clicking anywhere else on the part is done with that
  const [choosingAt, setChoosingAt] = React.useState<THREE.Vector3 | null>(null)
  const choosing = !written && choosingAt === at
  // While a colour is chosen for the part it is seen in its own, not the selection's;
  // and for a moment after one has been given, so that it is seen to have taken.
  const showPlain = useStore((state) => state.showPlain)
  const gave = React.useRef(false)
  const chosen = React.useCallback((given: boolean) => {
    gave.current = given
    setChoosingAt(null)
  }, [])
  React.useEffect(() => {
    if (choosing) {
      gave.current = false
      showPlain(true)
      return
    }
    if (!gave.current) {
      showPlain(false)
      return
    }
    const timer = setTimeout(() => showPlain(false), SEEN_FOR_MS)
    return () => clearTimeout(timer)
  }, [choosing, showPlain])
  React.useEffect(() => () => showPlain(false), [showPlain])

  // where that place is on the screen, kept far enough in from the edges of the view
  // for what is shown there to fit
  const kept = React.useMemo(() => {
    const seen = new THREE.Vector3()
    const fits = written ? WRITING : choosing ? RING : BUTTONS
    return (el: THREE.Object3D, camera: THREE.Camera, size: Size) => {
      seen.setFromMatrixPosition(el.matrixWorld).project(camera)
      return [
        between(
          ((seen.x + 1) / 2) * size.width,
          ROOM.left + fits.left,
          size.width - ROOM.right - fits.right
        ),
        between(
          ((1 - seen.y) / 2) * size.height,
          ROOM.top + fits.up,
          size.height - ROOM.bottom - fits.down
        ),
      ]
    }
  }, [written, choosing])

  return (
    <>
      {written && <Cancel at={at} kept={kept} />}
      <Html position={at} calculatePosition={kept} zIndexRange={OVER}>
        {writing !== null ? (
          // over the place, where the buttons were
          <div
            className="-translate-x-1/2"
            style={{ marginTop: -WRITING_ABOVE }}
          >
            <Writing key={writing} label={part.label} note={note} />
          </div>
        ) : choosing ? (
          // round the first of the buttons, which is the one that was pressed
          <div
            className="absolute"
            style={{ left: -((download ? 2 : 1) * STEP) / 2 }}
          >
            <Colours partId={part.id} shown={shown} onDone={chosen} />
          </div>
        ) : (
          <div
            onPointerDown={held}
            className="relative flex -translate-1/2 gap-1.5"
          >
            {/* its name, beside them and of a piece with them; a long one is cut short */}
            <span className="pointer-events-none absolute top-1/2 right-full mr-1.5 flex h-9 max-w-44 -translate-y-1/2 items-center rounded-full bg-foreground px-3.5 text-xs font-medium text-background shadow-sm ring-1 ring-background/25">
              <span className="truncate">{part.label}</span>
            </span>
            <Does label="Change color" onClick={() => setChoosingAt(at)}>
              <span
                className="size-4 rounded-full ring-1 ring-foreground/20"
                style={{ background: shown }}
              />
            </Does>
            {download && (
              <Does
                label="Download part"
                onClick={() =>
                  void window.cad.model.saveCopy(
                    projectId,
                    download.file,
                    download.name
                  )
                }
              >
                <DownloadIcon />
              </Does>
            )}
            <Does label="Edit part" onClick={() => write("new")}>
              <MessageSquareIcon />
            </Does>
          </div>
        )}
      </Html>
    </>
  )
}

/**
 * On a part that something has been said of and not yet sent: a mark at the place it was
 * said of, which goes where the part goes. Pressed, it opens what was said again.
 */
export function NoteMark({ loaded, note }: { loaded: LoadedPart; note: Note }) {
  const at = React.useMemo(
    () => placeOn(loaded, note.part.point),
    [loaded, note.part.point]
  )
  return (
    <Html position={at} center zIndexRange={OVER}>
      <button
        type="button"
        title={note.text}
        onPointerDown={held}
        onClick={() => useStore.getState().write(note.id)}
        className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-foreground text-background shadow-md ring-1 ring-black/15 outline-none"
      >
        <MessageSquareIcon className="size-3.5 fill-current" />
        <span className="sr-only">What was said of {note.part.label}</span>
      </button>
    </Html>
  )
}
