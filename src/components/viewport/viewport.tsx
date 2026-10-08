import * as React from "react"
import { cn } from "cn"
import {
  FolderPlusIcon,
  PlusIcon,
  SquareIcon,
  TriangleAlertIcon,
} from "lucide-react"

import type { PartRef, Project } from "@shared/api"
import { Mark } from "@/components/mark"
import { RESTING_WIDTH } from "@/lib/mark"
import { atWork } from "@/lib/steps"
import { duration, useNow } from "@/lib/time"
import { PartsPanel } from "@/components/parts-panel"
import { Tools } from "@/components/tools"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { lookFor, type Found } from "@/lib/find"
import { readModel } from "@/lib/model"
import { spokenFor } from "@/lib/keys"
import { MAC } from "@/lib/platform"
import { notCalledOn, partsOf } from "@/lib/mentions"
import { VIEWS } from "@/lib/orient"
import {
  allOf,
  calledAs,
  SPREAD,
  useStore,
  type Called,
  type Note,
  type Only,
  type Selection,
} from "@/lib/store"
import { objectsOf, pieceWith, wholeOf } from "./apart"
import { AxisGizmo } from "./axis-gizmo"
import { bridge } from "./bridge"
import { ExplodeSlider } from "./explode-slider"
import { disposeModel, loadModel, standInModel, type LoadedModel } from "./load"
import { picturesOf } from "./pictures"
import { appearance, Scene } from "./scene"
import { Search } from "./search"
import { ShadingPie } from "./shading-pie"
import { useThumbnails } from "./thumbnails"
import { sectionAcross, sectionFacing, SectionPlanes } from "./section-planes"

/** Stable when a project has nothing said of its parts, or no colours given. */
const NO_NOTES: Note[] = []
const NO_COLOURS: Record<string, string> = {}
const NO_PARTS: string[] = []
const NO_CALLED: Called[] = []

/**
 * The parts that have been shown on their own and gone up to, with I or from what was
 * found by name: none, if nothing has.
 */
function nearOf(only: Only | null, loaded: LoadedModel | null): string[] {
  if (!only?.near) return NO_PARTS
  return only.kind === "parts"
    ? only.ids
    : only.kind === "part"
      ? [only.id]
      : only.kind === "group"
        ? (loaded?.model.parts ?? [])
            .filter((part) => part.group === only.id)
            .map((part) => part.id)
        : NO_PARTS
}

/** The parts picked out, by id: the several, or the one, or those of the one piece. */
function pickedOut(): string[] {
  const { several, selection } = useStore.getState()
  return several.length > 0
    ? several
    : selection
      ? allOf(selection.part)
      : NO_PARTS
}

/** A part as what a piece is made out from: see `listed`, in Model. */
type Listed = Parameters<typeof objectsOf<string>>[0][number]

const counted = (many: number, what: string) =>
  `${many} ${what}${many === 1 ? "" : "s"}`

/**
 * With parts picked out together, at the foot of the view: they are called on for the
 * message to Claude, where each shows as a chip, and the message is brought up to be
 * gone on with. It is there for as long as the message does not name them all, by a
 * chip or in its own words.
 *
 * What is picked out goes by the piece here too. A whole object among it is called on
 * as one thing, a chip of its own, and not as the many parts it is made of: the button
 * counts those as groups. The parts left over, picked out for themselves, go one by one.
 */
function AddToChat({
  listed,
  groups,
  projectId,
}: {
  listed: Listed[]
  groups: LoadedModel["model"]["groups"]
  projectId: string
}) {
  const several = useStore((s) => s.several)
  const sweeping = useStore((s) => s.sweep !== null)
  const draft = useStore((s) => s.drafts[projectId] ?? "")
  const called = useStore((s) => s.called[projectId] ?? NO_CALLED)
  const callOn = useStore((s) => s.callOn)
  const picked = React.useMemo(
    () => objectsOf(listed, groups, several),
    [listed, groups, several]
  )
  const fresh = (one: Called) => !called.some((other) => other.id === one.id)
  const objects = picked.objects.map(calledAs).filter(fresh)
  const unnamed = notCalledOn(draft, picked.loose)
  const parts = listed
    .filter((part) => unnamed.includes(part.id))
    .map((part): Called => ({ id: part.id, label: part.label }))
    .filter(fresh)
  if (objects.length + parts.length === 0 || sweeping) return null
  return (
    <Button
      // room either side of the words, a little less of it past the sign
      className="pointer-events-auto animate-in gap-2 pl-5 shadow-md duration-150 fade-in slide-in-from-bottom-2 has-data-[icon=inline-end]:pr-4"
      onClick={() => callOn([...objects, ...parts])}
    >
      Add{" "}
      {[
        ...(objects.length > 0 ? [counted(objects.length, "group")] : []),
        ...(parts.length > 0 ? [counted(parts.length, "part")] : []),
      ].join(" and ")}{" "}
      to chat
      <PlusIcon data-icon="inline-end" />
    </Button>
  )
}

/**
 * The parts Claude is at work on, by id: the ones the message it is answering is about.
 * None while it is not at work in the project.
 */
function useChanging(project: Project): string[] {
  const running = project.conversations.find((c) => c.status !== "idle")?.id
  const load = useStore((s) => s.load)
  // what was asked is there to be read, whether or not that conversation is looked at
  React.useEffect(() => {
    if (running) load(project.id, running)
  }, [project.id, running, load])
  // the same message for as long as the turn lasts, whatever else is said in it
  const asked = useStore((s) =>
    running
      ? s.items[running]?.findLast((item) => item.kind === "user")
      : undefined
  )
  return React.useMemo(
    () => (asked?.kind === "user" ? partsOf(asked) : NO_PARTS),
    [asked]
  )
}

/** How long the app's saying something stays at the foot of the view, ms. */
const SAID_FOR_MS = 3200

/**
 * At the foot of the view, for a moment: what the app has to say of something just done
 * that would otherwise go unsaid. What Cmd+Z took back, or why it could not.
 */
function Saying() {
  const saying = useStore((s) => s.saying)
  React.useEffect(() => {
    if (!saying) return
    const over = setTimeout(
      () =>
        // unless something else has been said since
        useStore.setState((state) =>
          state.saying === saying ? { saying: null } : {}
        ),
      SAID_FOR_MS
    )
    return () => clearTimeout(over)
  }, [saying])
  if (!saying) return null
  return (
    <div
      key={saying.key}
      role="status"
      className="glass max-w-[min(34rem,calc(100%-22rem))] animate-in truncate rounded-full bg-background/60 px-5 py-2.5 text-sm shadow-md ring-1 ring-foreground/10 duration-200 select-none fade-in slide-in-from-bottom-2"
      title={saying.text}
    >
      {saying.text}
    </div>
  )
}

/** How big the square the mark turns in is while something is waited for, px. */
const MARK_SIZE = 96

/**
 * What is waited for, in the middle of the view while it has nothing else to show: the
 * mark, turning; what is being done, and under that how far along it is; and a bar of
 * the same, as wide as the mark is at rest. `progress` runs from 0 to 1, or is null
 * while there is no telling.
 */
function Waiting({
  title,
  detail,
  progress,
  late,
}: {
  title: string
  detail: string
  progress: number | null
  /** not shown at once: what is waited for may be here before anyone could read this */
  late: boolean
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex animate-in flex-col items-center justify-center fill-mode-both select-none fade-in",
        late ? "delay-300 duration-300" : "duration-200"
      )}
    >
      <Mark moving size={MARK_SIZE} />
      {/* The mark, the words and the bar each have room to themselves, and as much of
          it one way as the other by what is seen of them: the mark comes out to the
          edge of its square as it turns, and a line of words has a little over and
          under its letters. */}
      <div className="mt-7 flex max-w-md flex-col items-center text-center text-xl/[1.3]">
        <div className="max-w-full truncate font-bold">{title}</div>
        <div className="text-foreground/45">{detail}</div>
      </div>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          progress === null ? undefined : Math.round(progress * 100)
        }
        className="mt-8 h-0.5 overflow-hidden rounded-full bg-foreground/20"
        style={{ width: Math.round(MARK_SIZE * RESTING_WIDTH) }}
      >
        {progress === null ? (
          <div className="h-full w-1/3 animate-[passing_1.3s_ease-in-out_infinite] rounded-full bg-foreground" />
        ) : (
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * At the foot of the view while Claude looks over the model of files just opened: how
 * long it has been at it, what it is at just now, as the conversation would say it, and
 * a way to have it leave off.
 */
function LookingOver({ project }: { project: Project }) {
  const turn = project.conversations.find((c) => c.status !== "idle")
  const items = useStore((s) => (turn ? s.items[turn.id] : undefined))
  // Counted from when this came up, which is a moment before Claude is set to it; or
  // from when it was, if this is come back to with the turn already under way.
  const [shown] = React.useState(() => Date.now())
  const now = useNow(1000)
  const taken = now - Math.min(shown, turn?.since ?? Infinity)
  const doing = (items && atWork(items)) ?? "Understanding the model"
  return (
    // the button is as far from the end it is at as from the top and the bottom, and
    // the words have a good deal more room than that at theirs
    <div className="glass pointer-events-auto flex animate-in items-center gap-3 rounded-full bg-background/60 py-2.5 pr-2.5 pl-6 text-sm shadow-md ring-1 ring-foreground/10 duration-200 select-none fade-in slide-in-from-bottom-2">
      {/* room for two figures and what they count in, so that the words beside it stay
          where they are as it goes up, in the figures everything else is set in */}
      <span className="min-w-[3ch] text-foreground/45">{duration(taken)}</span>
      {/* a light passes along it, as one does across the parts; and it is as wide as
          this whatever it says, so that the whole does not change size as it changes */}
      <span
        className="mr-2 w-52 shimmer truncate font-medium text-muted-foreground shimmer-color-foreground"
        title={doing}
      >
        {doing}
      </span>
      <Button
        size="icon-sm"
        className="shrink-0 bg-destructive text-white hover:bg-destructive/80"
        onClick={() => void window.cad.thread.stop(project.id)}
      >
        <SquareIcon className="size-3 fill-current" />
        <span className="sr-only">Stop</span>
      </Button>
    </div>
  )
}

/**
 * How much of bringing files in is making the model of them: the rest is the model being
 * loaded into the view, which is the quicker of the two.
 */
const MAKING = 0.8

type Loading =
  | { status: "loading"; done: number; total: number }
  | { status: "error"; message: string }
  | { status: "ready" }

/**
 * The project's model, loaded - or a cube standing in for it, while the project has none.
 * While a rebuilt model is coming in, the previous one stays on screen, so a rebuild swaps
 * the picture rather than blanking it.
 */
function useLoadedModel(project: Project) {
  const blank = project.manifest === null
  // Files opened into it that are not a model yet. There is nothing of the project's to
  // show meanwhile, and a cube would be taken for what was opened.
  const coming = blank && project.bringingIn !== null
  const [loaded, setLoaded] = React.useState<LoadedModel | null>(null)
  const [state, setState] = React.useState<Loading>({
    status: "loading",
    done: 0,
    total: 0,
  })

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!blank) setState({ status: "loading", done: 0, total: 0 })
      // nothing made in the folder yet: there is a cube to look at meanwhile
      if (blank) {
        await Promise.resolve()
        if (cancelled) return
        setLoaded(coming ? null : standInModel())
        setState({ status: "ready" })
        return
      }
      const source = await window.cad.model.read(project.id)
      if (!source) throw new Error("The model's manifest could not be read.")
      const model = readModel(source.manifest)
      const next = await loadModel(
        model,
        source.baseUrl,
        project.revision,
        (done, total) => {
          if (!cancelled) setState({ status: "loading", done, total })
        }
      )
      if (cancelled) return disposeModel(next)
      setLoaded(next)
      setState({ status: "ready" })
    }
    run().catch((error: unknown) => {
      if (!cancelled)
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        })
    })
    return () => {
      cancelled = true
    }
  }, [project.id, project.revision, blank, coming])

  // free the previous model's meshes once it is off screen
  React.useEffect(
    () => () => {
      if (loaded) disposeModel(loaded)
    },
    [loaded]
  )

  return { loaded, state }
}

function Model({ project }: { project: Project }) {
  const { loaded, state } = useLoadedModel(project)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const selection = useStore((s) => s.selection)
  const several = useStore((s) => s.several)
  const sweep = useStore((s) => s.sweep)
  const hoveredId = useStore((s) => s.hoveredId)
  const seeking = useStore((s) => s.seeking)
  const finding = useStore((s) => s.finding)
  const plain = useStore((s) => s.plain)
  const hover = useStore((s) => s.hover)
  const homeRequests = useStore((s) => s.homeRequests)
  const partsOpen = useStore((s) => s.partsOpen)
  const notes = useStore((s) => s.notes[project.id] ?? NO_NOTES)
  const colours = useStore((s) => s.colours[project.id] ?? NO_COLOURS)
  const changing = useChanging(project)
  const lookOver = useStore((s) => s.lookOver)
  const thumbs = useThumbnails(loaded, partsOpen, colours)
  const goHome = useStore((s) => s.goHome)
  const setThreadOpen = useStore((s) => s.setThreadOpen)

  // A project with nothing made in it opens with the conversation beside it: that is
  // where the first thing to do is. Put away, it stays away. (Files being made a model
  // of are not nothing: there is a model on its way, and nothing to say until it is here.)
  const blank = project.manifest === null
  const bringingIn = blank ? project.bringingIn : null
  const reading = bringingIn?.state === "working"
  React.useEffect(() => {
    if (blank && !reading) setThreadOpen(true)
  }, [blank, reading, setThreadOpen])
  // files were brought in while this was up: loading their model is the end of that
  const [brought, setBrought] = React.useState(false)
  if (reading && !brought) setBrought(true)

  // Files just opened are looked over by Claude as soon as their model is here to be
  // seen: it is shown pictures of the model, drawn for it, and names and groups the
  // parts. Until it is through, a light goes across every part, as across the ones it
  // is at work on at any other time.
  const real = loaded && !loaded.standIn ? loaded : null
  const lookingOver = real !== null && project.lookOver !== null
  const wanted = real !== null && project.lookOver === "wanted"
  React.useEffect(() => {
    if (!wanted || !real) return
    let over = false
    const given = useStore.getState().colours[project.id] ?? NO_COLOURS
    void picturesOf(real, given).then((seen) => {
      if (!over) void lookOver(project.id, seen)
    })
    return () => {
      over = true
    }
  }, [wanted, real, project.id, lookOver])
  const every = React.useMemo(
    () => real?.parts.map((part) => part.part.id) ?? NO_PARTS,
    [real]
  )
  // Meanwhile the view is Claude's: the camera goes round the model by itself, and
  // nothing in the view answers the hand or the keys. When it is through, the camera
  // goes back to where a model opens, as Cmd+1 would take it.
  const looked = React.useRef(false)
  React.useEffect(() => {
    if (looked.current && !lookingOver) goHome()
    looked.current = lookingOver
  }, [lookingOver, goHome])

  // Parts and groups are looked for by name (Cmd+F): what goes by the name so far is lit
  // up in the view, through all the rest. There is nothing to look through in the cube
  // that stands in for a model, or while the view is Claude's.
  const searched = lookingOver ? null : real
  const finds = React.useMemo(
    () =>
      searched && finding !== null ? lookFor(searched.model, finding) : null,
    [searched, finding]
  )
  // What was found is shown on its own, and the camera brought to it, the way I does
  // with what is picked out: the one thing whose name was pressed, or all of it. That is
  // the end of looking. A part of it that had been put out of sight is back in sight.
  const showFound = React.useCallback((things: Found[]) => {
    const { view, setView, find } = useStore.getState()
    const ids = [...new Set(things.flatMap((thing) => thing.parts))]
    if (ids.length === 0) return
    const [one] = things
    setView({
      only:
        things.length === 1 && one.kind === "group"
          ? { kind: "group", id: one.id, near: true }
          : ids.length === 1
            ? { kind: "part", id: ids[0], near: true }
            : { kind: "parts", ids, near: true },
      ...(view.hidden.some((id) => ids.includes(id)) && {
        hidden: view.hidden.filter((id) => !ids.includes(id)),
      }),
    })
    find(null)
  }, [])
  const showOne = React.useCallback(
    (thing: Found) => showFound([thing]),
    [showFound]
  )

  // Nothing to see yet: how far along it is, in the middle of the view, from the files
  // being read to their model being loaded, as one thing. (A model built again comes in
  // behind the one on screen, and takes its place when it is all there: nothing is said
  // of that.)
  const loading = state.status === "loading" ? state : { done: 0, total: 0 }
  const waiting = loaded
    ? null
    : bringingIn?.state === "working"
      ? {
          title: `Importing ${project.name}`,
          detail: bringingIn.total
            ? `Preparing ${bringingIn.done} of ${bringingIn.total} parts`
            : "Reading the files",
          progress: bringingIn.total
            ? (MAKING * bringingIn.done) / bringingIn.total
            : null,
          late: false,
        }
      : // a model there is, and none of it here yet: it is loading, or about to
        !blank && state.status !== "error"
        ? {
            title: `${brought ? "Importing" : "Opening"} ${project.name}`,
            detail:
              loading.total > 0
                ? `Loading ${loading.done} of ${loading.total} parts`
                : "Loading the model",
            progress:
              (brought ? MAKING : 0) +
              ((brought ? 1 - MAKING : 1) * loading.done) /
                (loading.total || 1),
            late: !brought,
          }
        : null

  const middle = React.useMemo(
    () => loaded?.box.getCenter(loaded.box.min.clone()).toArray() ?? null,
    [loaded]
  )

  // Picking parts out. A click picks one, at the place on it that was clicked, and what
  // can be done with that part is shown there. A box drawn across the view picks every
  // part it takes in, together, and so does a click with Shift held: it adds a part to
  // what is picked out, or takes back out one that was among it. Parts picked out
  // together are hinted at through whatever of the model is in front of them.
  //
  // A click and a box go by the piece: the parts of a group that are one object, a
  // circuit board with all that is on it, are picked out as one, the way they come
  // apart as one (see apart.ts). So a click on any of a piece picks out all of it, at
  // that place on it, and a box that takes in any of it takes all of it. Shift with a
  // click goes by the part, and is how the one part is got at: it picks out the part
  // itself, adds it to what is picked out, or takes it back out. So does a second
  // click, or a click with Cmd held, which pick out the part and nothing else.
  //
  // A second click works the other way about with Shift held. The first has gone by the
  // part, and the second, coming straight after it on the same spot, takes in the whole
  // of the piece the part is of: added to what is picked out, which is how one object is
  // picked out together with another.
  /** The parts, as what a piece is made out from. */
  const listed = React.useMemo(
    () =>
      (loaded?.parts ?? []).map(({ part, piece, box }) => ({
        id: part.id,
        label: part.label,
        group: part.group,
        piece,
        across: box.min.distanceTo(box.max),
      })),
    [loaded]
  )
  /** These parts and the rest of their pieces, in the order the model has them. */
  const whole = React.useCallback(
    (ids: string[]) => wholeOf(listed, ids),
    [listed]
  )
  /** A part as the piece it is of, where it is one of several in a piece. */
  const asPiece = React.useCallback(
    (part: PartRef): PartRef => {
      const piece = loaded && pieceWith(listed, loaded.model.groups, part.id)
      return piece ? { ...part, piece } : part
    },
    [loaded, listed]
  )
  /** These parts with what is picked out already, in the order the model has them. */
  const withPicked = React.useCallback(
    (ids: string[]) => {
      const had = pickedOut()
      return listed
        .map((part) => part.id)
        .filter((id) => had.includes(id) || ids.includes(id))
    },
    [listed]
  )
  const pick = React.useCallback(
    (selection: Selection | null, add: boolean, alone: boolean) => {
      const { select, selectSeveral, selection: was } = useStore.getState()
      if (!add)
        return select(
          selection && !alone
            ? { ...selection, part: asPiece(selection.part) }
            : selection
        )
      // Shift on nothing leaves what is picked out as it is
      if (!selection) return
      const { id } = selection.part
      const had = pickedOut()
      // The second click of two: all of the part's piece is picked out, with whatever
      // else is. Where nothing else is, it is picked out as a click on it alone would.
      if (!alone) {
        const all = whole([id])
        if (had.every((other) => all.includes(other)))
          return select({ ...selection, part: asPiece(selection.part) })
        return selectSeveral(withPicked(all))
      }
      // With nothing picked out, the part is picked out as a click on it alone would:
      // and so is a part of the piece that is picked out, which is the part meant.
      if (had.length === 0 || (was?.part.piece && had.includes(id)))
        return select(selection)
      selectSeveral(
        had.includes(id)
          ? had.filter((other) => other !== id)
          : withPicked([id])
      )
    },
    [asPiece, whole, withPicked]
  )
  const sweepTo = React.useCallback(
    (ids: string[] | null, add: boolean) =>
      useStore
        .getState()
        .sweepOver(ids && (add ? withPicked(whole(ids)) : whole(ids))),
    [whole, withPicked]
  )
  const take = React.useCallback(
    (ids: string[], add: boolean) => {
      const { selectSeveral } = useStore.getState()
      const taken = whole(ids)
      if (!add) return selectSeveral(taken)
      // nothing more than was picked out already: it stays as it was
      const had = pickedOut()
      if (!taken.every((id) => had.includes(id)))
        selectSeveral(withPicked(taken))
    },
    [whole, withPicked]
  )
  const selectedWith = React.useMemo(
    () => (selection ? allOf(selection.part) : NO_PARTS),
    [selection]
  )
  // What a click would pick out is what lights up under the pointer: in the view, all
  // of a piece, or the part by itself while a key is held that a click would pick out
  // just the part with. A part pointed at in the list of parts is lit up alone.
  const [over, setOver] = React.useState<string | null>(null)
  const hoverOver = React.useCallback(
    (id: string | null, alone: boolean) => {
      setOver(alone ? null : id)
      hover(id)
    },
    [hover]
  )
  const hoveredWith = React.useMemo(
    () =>
      hoveredId === null
        ? NO_PARTS
        : hoveredId === over
          ? whole([hoveredId])
          : [hoveredId],
    [hoveredId, over, whole]
  )

  // Cmd+1 is the view the model opened with; Cmd+2 to 7 are the six flat ones. S cuts
  // the model open and E pulls it apart, both again to undo. I shows what is picked
  // out, one part or several, on its own and close to, and again brings the rest back.
  // H is the other way about: it puts what is picked out, one part or several, out of
  // sight, and with nothing picked out brings back all that was. P brings up the list
  // of parts, and puts it away. While the model is cut open, X and Y choose the axis
  // the cut goes across (and Z, which the shading menu passes on). Esc stops looking
  // for parts by name, puts the parts list away, and then gets out of the section, the
  // explode, what was shown on its own or what was put out of sight, whichever was gone
  // into last. Shift+G rules the ground and draws the world's axes, as it brings up the
  // grid in Figma, and again takes them away. (Cmd+F, which looks for parts by name, is
  // listened for where the name is typed: see Search.)
  //
  // Cmd+Z takes back the last thing done to the model, a colour given by hand or what
  // Claude did in a turn, and with Shift puts it back. In a box that is written in it is
  // the writing's, as ever, for as long as there is any: with nothing written there,
  // which is how the message box is left by a message just sent, it is the model's.
  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.altKey || lookingOver) return
      if (useStore.getState().settingsOpen) return
      if (
        (MAC ? event.metaKey && !event.ctrlKey : event.ctrlKey) &&
        event.key.toLowerCase() === "z"
      ) {
        const on = event.target
        const written =
          on instanceof HTMLInputElement || on instanceof HTMLTextAreaElement
            ? on.value !== ""
            : spokenFor(on)
        if (written) return
        event.preventDefault()
        if (event.repeat) return
        const { undo, redo } = useStore.getState()
        void (event.shiftKey ? redo() : undo())
        return
      }
      if (event.shiftKey) {
        // the one key here that Shift goes with: and not a capital G being typed
        const alone = !event.metaKey && !event.ctrlKey && !event.repeat
        if (!loaded || !alone || event.key.toLowerCase() !== "g") return
        if (spokenFor(event.target)) return
        const { view, setView } = useStore.getState()
        setView({ grid: !view.grid })
        event.preventDefault()
        return
      }
      if (event.metaKey || event.ctrlKey) {
        const digit = /^Digit([1-7])$/.exec(event.code)?.[1]
        if (!digit) return
        event.preventDefault()
        const view = VIEWS[Number(digit) - 2]
        if (view) bridge.lookFrom?.(view.axis, view.sign)
        else goHome()
        return
      }
      if (event.key === "Escape") {
        // not when the key is already closing something of its own: a menu, or what
        // is being written of a part
        const { writing, leave } = useStore.getState()
        const taken =
          event.defaultPrevented || writing !== null || spokenFor(event.target)
        if (!taken && leave()) event.preventDefault()
        return
      }
      // a letter on its own: not one held down, and not one being typed somewhere
      if (!loaded || !middle || event.repeat || spokenFor(event.target)) return
      const { view, setView, cutOpen } = useStore.getState()
      const letter = event.key.toLowerCase()
      if (letter === "s") {
        if (view.section) setView({ section: null })
        else cutOpen(() => sectionFacing(loaded.box))
      } else if (letter === "e")
        setView({ exploded: !view.exploded, spread: SPREAD.min })
      else if (letter === "i") {
        const wanted = pickedOut()
        const near = nearOf(view.only, loaded)
        const there =
          wanted.length === near.length &&
          wanted.every((id) => near.includes(id))
        if (wanted.length > 0 && !there)
          setView({
            only:
              wanted.length > 1
                ? { kind: "parts", ids: wanted, near: true }
                : { kind: "part", id: wanted[0], near: true },
          })
        else if (near.length > 0) setView({ only: null })
        else return
      } else if (letter === "h") {
        // what is picked out goes out of sight, with whatever is out of sight already,
        // and is picked out no longer; with nothing picked out, all of it comes back
        const wanted = pickedOut()
        if (wanted.length > 0) {
          useStore.getState().select(null)
          setView({ hidden: [...new Set([...view.hidden, ...wanted])] })
        } else if (view.hidden.length > 0) setView({ hidden: NO_PARTS })
        else return
      } else if (letter === "p") {
        const { partsOpen, setPartsOpen } = useStore.getState()
        setPartsOpen(!partsOpen)
      } else if (view.section && (letter === "x" || letter === "y"))
        setView({ section: sectionAcross(letter, middle) })
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [goHome, loaded, middle, lookingOver])

  // The camera goes to what I shows on its own, one part or several together, and
  // follows it if it is pulled out from the rest; and goes back when that is no longer
  // what is shown.
  const near = React.useMemo(
    () => nearOf(view.only, loaded),
    [view.only, loaded]
  )
  const explode = view.exploded ? view.spread : 0
  React.useEffect(() => {
    const boxes = (loaded?.parts ?? [])
      .filter((part) => near.includes(part.part.id))
      .map((part) =>
        part.box
          .clone()
          .applyMatrix4(part.home)
          .translate(part.away.clone().multiplyScalar(explode))
      )
    bridge.focus?.(
      boxes.length > 0 ? boxes.reduce((all, box) => all.union(box)) : null
    )
  }, [loaded, near, explode])

  // Z is the shading menu's key. While the model is cut open a tap of it still chooses
  // the cut across Z, and the menu comes up when the key is held instead.
  const cut = view.section !== null
  const cutAcrossZ = React.useMemo(
    () =>
      cut && middle
        ? () => setView({ section: sectionAcross("z", middle) })
        : null,
    [cut, middle, setView]
  )

  // A rebuild can take away the part or the group that was picked out, which would
  // leave nothing showing: then everything shows again.
  React.useEffect(() => {
    const { only } = useStore.getState().view
    if (!loaded || !only) return
    const { parts, groups, keepouts } = loaded.model
    const there =
      only.kind === "part"
        ? parts.some((part) => part.id === only.id)
        : only.kind === "parts"
          ? parts.some((part) => only.ids.includes(part.id))
          : only.kind === "group"
            ? groups.some((group) => group.id === only.id) &&
              parts.some((part) => part.group === only.id)
            : keepouts.length > 0
    if (!there) setView({ only: null })
  }, [loaded, setView])
  // Nor is a part it takes away out of sight any longer: there is none to bring back.
  React.useEffect(() => {
    const { hidden } = useStore.getState().view
    if (!loaded || hidden.length === 0) return
    const still = hidden.filter((id) =>
      loaded.parts.some((part) => part.part.id === id)
    )
    if (still.length < hidden.length) setView({ hidden: still })
  }, [loaded, setView])
  // What is picked out is there to be seen. A part that was put out of sight and is
  // picked out again, by going back to what was said of it, is brought back.
  React.useEffect(() => {
    if (!selection) return
    const { hidden } = useStore.getState().view
    const picked = allOf(selection.part)
    if (hidden.some((id) => picked.includes(id)))
      setView({ hidden: hidden.filter((id) => !picked.includes(id)) })
  }, [selection, setView])
  // And of the parts picked out together, the ones it takes away are no longer.
  React.useEffect(() => {
    if (!loaded) return
    const { several, selectSeveral } = useStore.getState()
    const still = several.filter((id) =>
      loaded.parts.some((part) => part.part.id === id)
    )
    if (still.length < several.length) selectSeveral(still)
  }, [loaded])
  // A piece that is picked out is the piece as the model now has it: what it has gained
  // or lost, or come to be called, in a rebuild.
  React.useEffect(() => {
    const { selection } = useStore.getState()
    if (!loaded || !selection?.part.piece) return
    const { piece } = asPiece({ ...selection.part, piece: undefined })
    const was = selection.part.piece
    if (piece?.label === was.label && piece.parts.join() === was.parts.join())
      return
    // (not picked out afresh: what is being written of it is still being written)
    useStore.setState({
      selection: { ...selection, part: { ...selection.part, piece } },
    })
  }, [loaded, asPiece])

  // what Claude gets when it asks which parts are on screen
  React.useEffect(() => {
    if (!loaded) return
    bridge.parts = () =>
      loaded.parts.map((part) => {
        const box = part.box.clone().applyMatrix4(part.home)
        const round = (n: number) => Math.round(n * 100) / 100
        return {
          id: part.part.id,
          label: part.part.label,
          group: part.part.group,
          min: box.min.toArray().map(round),
          max: box.max.toArray().map(round),
          faces: part.faces,
          // the colour the user gave it in the app, or the model's own; null if neither
          color:
            useStore.getState().colours[project.id]?.[part.part.id] ??
            part.part.color,
          shown: appearance(part, loaded, useStore.getState().view).shown,
        }
      })
    return () => {
      bridge.parts = null
    }
  }, [loaded, project.id])

  // the section's handle was dragged in the view: the cut moves, the side shown stays
  const moveSection = React.useCallback(
    (moved: Parameters<React.ComponentProps<typeof Scene>["onSection"]>[0]) => {
      const { section } = useStore.getState().view
      if (section) setView({ section: { ...section, ...moved } })
    },
    [setView]
  )

  return (
    <>
      {loaded && (
        <Scene
          loaded={loaded}
          projectId={project.id}
          notes={notes}
          colours={colours}
          view={view}
          selectedId={selection?.part.id ?? null}
          selectedWith={selectedWith}
          several={several}
          // the stand-in is nothing Claude was asked to change
          changing={loaded.standIn ? NO_PARTS : lookingOver ? every : changing}
          reading={lookingOver}
          sweep={sweep}
          hoveredId={hoveredId}
          hoveredWith={hoveredWith}
          seeking={seeking && !loaded.standIn}
          found={finds}
          plain={plain}
          // the first model made takes the cube's place, and is framed afresh
          homeKey={`${project.id}:${loaded.standIn ? "cube" : "model"}:${homeRequests}`}
          // the stand-in is nothing to ask about: it is not picked, and does not light up
          onPick={loaded.standIn ? nothing : pick}
          onSweep={loaded.standIn ? nothing : sweepTo}
          onTake={loaded.standIn ? nothing : take}
          onHover={loaded.standIn ? nothing : hoverOver}
          onShow={showOne}
          onSection={moveSection}
        />
      )}

      {waiting && <Waiting {...waiting} />}
      {state.status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Alert variant="destructive" className="max-w-md">
            <TriangleAlertIcon />
            <AlertTitle>The model could not be shown</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {bringingIn?.state === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          {bringingIn.why === "python" ? (
            <Alert className="max-w-md">
              <TriangleAlertIcon />
              <AlertTitle>Nothing to read the files with yet</AlertTitle>
              <AlertDescription>
                Enclose reads CAD files with Python and build123d, and did not
                find both on this machine. The files are in the project: ask
                Claude to set it up, and it will see to the rest.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="max-w-md">
              <TriangleAlertIcon />
              <AlertTitle>The files could not be made a model of</AlertTitle>
              <AlertDescription>
                <p>{bringingIn.detail}</p>
                <p>The files are in the project: ask Claude to look into it.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {searched && <Search finds={finds} onShow={showFound} />}
      <Tools loaded={loaded} projectId={project.id} locked={lookingOver} />
      {loaded && partsOpen && !lookingOver && (
        <PartsPanel
          loaded={loaded}
          thumbs={thumbs}
          // further in while the section's other buttons stand where it would be
          className={cn(
            "absolute top-1/2 max-h-[70%] -translate-y-1/2 transition-[right]",
            view.section ? "right-36" : "right-15"
          )}
        />
      )}
      {/* at the foot of the view, in the middle: what to do with the parts picked out
          together, over how far apart the parts are pulled */}
      {loaded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-2.5">
          {lookingOver && <LookingOver project={project} />}
          <Saying />
          <AddToChat
            listed={listed}
            groups={loaded.model.groups}
            projectId={project.id}
          />
          {view.exploded && <ExplodeSlider />}
        </div>
      )}
      {loaded && middle && !lookingOver && (
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1">
          <SectionPlanes middle={middle} />
          <AxisGizmo />
        </div>
      )}
      <ShadingPie enabled={loaded !== null && !lookingOver} tap={cutAcrossZ} />
    </>
  )
}

const nothing = () => {}

/** No projects at all: how one is started. */
function Welcome() {
  const addProject = useStore((s) => s.addProject)
  const createProject = useStore((s) => s.createProject)
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderPlusIcon />
        </EmptyMedia>
        <EmptyTitle>Drop a file or folder here</EmptyTitle>
        <EmptyDescription>
          A STEP file, a folder of them, or a folder to start in: it becomes a
          project.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        {/* a Mac's picker takes files and folders alike; no other system's does */}
        {MAC ? (
          <Button variant="outline" onClick={() => void addProject()}>
            Open file or folder
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => void addProject("file")}>
              Open file
            </Button>
            <Button variant="outline" onClick={() => void addProject("folder")}>
              Open folder
            </Button>
          </>
        )}
        <Button onClick={() => void createProject()}>Create</Button>
      </EmptyContent>
    </Empty>
  )
}

/** The middle of the window: the open project's model, or what to do about not having one. */
export function Viewport({ project }: { project: Project | null }) {
  if (!project) return <Welcome />
  // keyed by project, so one project's model never lingers under another's name
  return <Model key={project.id} project={project} />
}
