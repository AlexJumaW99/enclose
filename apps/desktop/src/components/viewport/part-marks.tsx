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
import { partFile, type Model } from "@/lib/model"
import { MAC } from "@/lib/platform"
import { goesBy, useStore, type Note, type Selection } from "@/lib/store"
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

/**
 * Where something is said of the part: what should change at the place that was clicked.
 * Enter keeps it for the next message, as a chip on the message box, where more can be
 * gathered from other parts; with Cmd (or Ctrl) held, it and everything waiting are
 * sent at once. Esc, or Cancel, leaves things as they were.
 */
function Writing({ label, note }: { label: string; note: Note | null }) {
  const write = useStore((state) => state.write)
  const [text, setText] = React.useState(note?.text ?? "")

  const keep = (now: boolean) => {
    const { keepNote, send, setThreadOpen } = useStore.getState()
    if (!keepNote(text)) return
    // where it has gone is on show
    setThreadOpen(true)
    if (now) send()
  }

  return (
    <div
      onPointerDown={held}
      className="relative"
      style={{ width: WRITING_WIDTH }}
    >
      <div className="flex w-full flex-col gap-2 rounded-2xl border bg-popover/95 p-3 shadow-xl">
        {/* which part this is said of: a chip like those on the message box, a little
            lighter, so that it shows on this one */}
        <Badge className="max-w-full self-start bg-foreground/20 text-foreground">
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
        <div className="flex items-end justify-between gap-2">
          {/* in its corner as the button is in its own: the letters stand as far up
              from the bottom of the box as in from its side. Its own box is cut down to
              the letters for that, and it is moved over by the room the sign for the key
              has of its own to its left */}
          <span
            className={cn(
              "text-xs text-muted-foreground [text-box:trim-both_cap_alphabetic]",
              MAC && "-ml-[1.5px]"
            )}
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
      {/* leaving what is being written, without keeping it: off the top corner of the
          box, and as plain to see over any part as the part's name is */}
      <button
        type="button"
        onClick={() => write(null)}
        className="absolute right-0 bottom-full mb-1.5 flex h-6 cursor-pointer items-center gap-1 rounded-full bg-foreground px-2 text-xs font-medium whitespace-nowrap text-background shadow-sm ring-1 ring-background/25 outline-none hover:bg-[color-mix(in_oklch,var(--foreground),var(--background)_15%)]"
      >
        <XIcon className="size-3.5" />
        Cancel
      </button>
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
 * A piece is given its colour as one thing: every part of it, the same.
 */
function Colours({
  partIds,
  shown,
  onDone,
}: {
  /** the part, or all the parts of the piece */
  partIds: string[]
  /** the colour the part is drawn in, "#rrggbb" */
  shown: string
  /** the ring is done with: a colour was given or taken back, or nothing was */
  onDone: (gave: boolean) => void
}) {
  // the colour they have been given, where it is the same one for them all
  const chosen = useStore((state) => {
    const given = state.activeId ? state.colours[state.activeId] : undefined
    const first = given?.[partIds[0]] ?? null
    return partIds.every((id) => (given?.[id] ?? null) === first) ? first : null
  })
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
              setColour(partIds, chosen === name ? null : name)
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
 *
 * Where it is the piece the part is of that is picked out, they are the piece's: its
 * name, a colour for all of it, and what is said is said of it. There is no file of a
 * piece to hand out.
 */
export function PartMarks({
  loaded,
  model,
  projectId,
  shown,
  onPick,
}: {
  loaded: LoadedPart
  model: Model
  projectId: string
  /** the colour the part is drawn in, "#rrggbb" */
  shown: string
  /** a click that fell on these was one on the part under them (see the view's own) */
  onPick: (selection: Selection | null, add: boolean, alone: boolean) => void
}) {
  const { part } = loaded
  const writing = useStore((state) => state.writing)
  const write = useStore((state) => state.write)
  const point = useStore((state) => state.selection?.part.point ?? null)
  const piece = useStore((state) => state.selection?.part.piece)
  const label = piece?.label ?? part.label
  const partIds = React.useMemo(() => piece?.parts ?? [part.id], [piece, part])
  const note = useStore((state) =>
    writing && writing !== "new"
      ? (state.notes[projectId]?.find((one) => one.id === writing) ?? null)
      : null
  )
  const download = piece
    ? undefined
    : partFile(model.downloads, part.id, part.label)
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
    <Html position={at} calculatePosition={kept} zIndexRange={OVER}>
      {writing !== null ? (
        // over the place, where the buttons were
        <div className="-translate-x-1/2" style={{ marginTop: -WRITING_ABOVE }}>
          <Writing key={writing} label={label} note={note} />
        </div>
      ) : choosing ? (
        // round the first of the buttons, which is the one that was pressed
        <div
          className="absolute"
          style={{ left: -((download ? 2 : 1) * STEP) / 2 }}
        >
          <Colours partIds={partIds} shown={shown} onDone={chosen} />
        </div>
      ) : (
        <div
          onPointerDown={held}
          // The second click of two on a part falls here, on what the first put under
          // the pointer. It is not a press of any of these: it is for the part by
          // itself, where the first picked out the piece it is of; or, with Shift
          // held, for all of the piece, where the first picked out the part.
          onClickCapture={(event) => {
            if (event.detail < 2) return
            event.stopPropagation()
            const { selection } = useStore.getState()
            if (!selection || (!event.shiftKey && !selection.part.piece)) return
            onPick(
              { ...selection, part: { ...selection.part, piece: undefined } },
              event.shiftKey,
              !event.shiftKey
            )
          }}
          className="relative flex -translate-1/2 gap-1.5"
        >
          {/* its name, beside them and of a piece with them; a long one is cut short */}
          <span className="pointer-events-none absolute top-1/2 right-full mr-1.5 flex h-9 max-w-44 -translate-y-1/2 items-center rounded-full bg-foreground px-3.5 text-xs font-medium text-background shadow-sm ring-1 ring-background/25">
            <span className="truncate">{label}</span>
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
          <Does
            label={piece ? "Edit object" : "Edit part"}
            onClick={() => write("new")}
          >
            <MessageSquareIcon />
          </Does>
        </div>
      )}
    </Html>
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
        <span className="sr-only">What was said of {goesBy(note.part)}</span>
      </button>
    </Html>
  )
}
