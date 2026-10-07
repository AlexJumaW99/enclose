import * as React from "react"
import { cn } from "cn"
import {
  FolderPlusIcon,
  PlusIcon,
  SquareIcon,
  TriangleAlertIcon,
} from "lucide-react"

import type { Project } from "@shared/api"
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
import { readModel } from "@/lib/model"
import { spokenFor } from "@/lib/keys"
import { MAC } from "@/lib/platform"
import { notCalledOn, partsOf } from "@/lib/mentions"
import { VIEWS } from "@/lib/orient"
import {
  SPREAD,
  useStore,
  type Called,
  type Note,
  type Only,
  type Selection,
} from "@/lib/store"
import { AxisGizmo } from "./axis-gizmo"
import { bridge } from "./bridge"
import { ExplodeSlider } from "./explode-slider"
import { disposeModel, loadModel, standInModel, type LoadedModel } from "./load"
import { picturesOf } from "./pictures"
import { appearance, Scene } from "./scene"
import { ShadingPie } from "./shading-pie"
import { useThumbnails } from "./thumbnails"
import { sectionAcross, sectionFacing, SectionPlanes } from "./section-planes"

/** Stable when a project has nothing said of its parts, or no colours given. */
const NO_NOTES: Note[] = []
const NO_COLOURS: Record<string, string> = {}
const NO_PARTS: string[] = []
const NO_CALLED: Called[] = []

/** The parts that I has shown on their own and gone up to: none, if nothing is. */
function nearOf(only: Only | null): string[] {
  if (!only?.near) return NO_PARTS
  return only.kind === "parts"
    ? only.ids
    : only.kind === "part"
      ? [only.id]
      : NO_PARTS
}

/** The parts picked out, by id: the several, or the one. */
function pickedOut(): string[] {
  const { several, selection } = useStore.getState()
  return several.length > 0
    ? several
    : selection
      ? [selection.part.id]
      : NO_PARTS
}

/**
 * With parts picked out together, at the foot of the view: they are called on for the
 * message to Claude, where each shows as a chip, and the message is brought up to be
 * gone on with. It is there for as long as the message does not name them all, by a
 * chip or in its own words.
 */
function AddToChat({
  loaded,
  projectId,
}: {
  loaded: LoadedModel
  projectId: string
}) {
  const several = useStore((s) => s.several)
  const sweeping = useStore((s) => s.sweep !== null)
  const draft = useStore((s) => s.drafts[projectId] ?? "")
  const called = useStore((s) => s.called[projectId] ?? NO_CALLED)
  const callOn = useStore((s) => s.callOn)
  const count = notCalledOn(draft, several).filter(
    (id) => !called.some((part) => part.id === id)
  ).length
  if (count === 0 || sweeping) return null
  const picked = loaded.parts.flatMap(({ part }) =>
    several.includes(part.id) ? [{ id: part.id, label: part.label }] : []
  )
  return (
    <Button
      // room either side of the words, a little less of it past the sign
      className="pointer-events-auto animate-in gap-2 pl-5 shadow-md duration-150 fade-in slide-in-from-bottom-2 has-data-[icon=inline-end]:pr-4"
      onClick={() => callOn(picked)}
    >
      Add {count} {count === 1 ? "part" : "parts"} to chat
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
  /** These parts with what is picked out already, in the order the model has them. */
  const withPicked = React.useCallback(
    (ids: string[]) => {
      const had = pickedOut()
      return (loaded?.parts ?? [])
        .map((part) => part.part.id)
        .filter((id) => had.includes(id) || ids.includes(id))
    },
    [loaded]
  )
  const pick = React.useCallback(
    (selection: Selection | null, add: boolean) => {
      const { select, selectSeveral } = useStore.getState()
      const had = pickedOut()
      // the first part picked out is picked out the same, Shift or no
      if (!add || (selection && had.length === 0)) return select(selection)
      // Shift on nothing leaves what is picked out as it is
      if (!selection) return
      const { id } = selection.part
      selectSeveral(
        had.includes(id)
          ? had.filter((other) => other !== id)
          : withPicked([id])
      )
    },
    [withPicked]
  )
  const sweepTo = React.useCallback(
    (ids: string[] | null, add: boolean) =>
      useStore.getState().sweepOver(ids && add ? withPicked(ids) : ids),
    [withPicked]
  )
  const take = React.useCallback(
    (ids: string[], add: boolean) => {
      const { selectSeveral } = useStore.getState()
      if (!add) return selectSeveral(ids)
      // nothing more than was picked out already: it stays as it was
      const had = pickedOut()
      if (!ids.every((id) => had.includes(id))) selectSeveral(withPicked(ids))
    },
    [withPicked]
  )

  // Cmd+1 is the view the model opened with; Cmd+2 to 7 are the six flat ones. S cuts
  // the model open and E pulls it apart, both again to undo. I shows what is picked
  // out, one part or several, on its own and close to, and again brings the rest back.
  // P brings up the list of parts, and puts it away. While the model is cut open, X and
  // Y choose the axis the cut goes across (and Z, which the shading menu passes on). Esc
  // puts the parts list away, and then gets out of the section, the explode or what was
  // shown on its own, whichever was gone into last. Shift+G rules the ground and draws
  // the world's axes, as it brings up the grid in Figma, and again takes them away.
  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.altKey || lookingOver) return
      if (useStore.getState().settingsOpen) return
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
        const near = nearOf(view.only)
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
  const near = React.useMemo(() => nearOf(view.only), [view.only])
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
  // And of the parts picked out together, the ones it takes away are no longer.
  React.useEffect(() => {
    if (!loaded) return
    const { several, selectSeveral } = useStore.getState()
    const still = several.filter((id) =>
      loaded.parts.some((part) => part.part.id === id)
    )
    if (still.length < several.length) selectSeveral(still)
  }, [loaded])

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
          several={several}
          // the stand-in is nothing Claude was asked to change
          changing={loaded.standIn ? NO_PARTS : lookingOver ? every : changing}
          reading={lookingOver}
          sweep={sweep}
          hoveredId={hoveredId}
          seeking={seeking && !loaded.standIn}
          plain={plain}
          // the first model made takes the cube's place, and is framed afresh
          homeKey={`${project.id}:${loaded.standIn ? "cube" : "model"}:${homeRequests}`}
          // the stand-in is nothing to ask about: it is not picked, and does not light up
          onPick={loaded.standIn ? nothing : pick}
          onSweep={loaded.standIn ? nothing : sweepTo}
          onTake={loaded.standIn ? nothing : take}
          onHover={loaded.standIn ? nothing : hover}
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
          <AddToChat loaded={loaded} projectId={project.id} />
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
