// Everything the window knows: the projects, their conversations, and how the model is
// being looked at.
import { create } from "zustand"

import {
  NOT_ARRANGED,
  readArrangement,
  type Arrangement,
  type Named,
} from "@/lib/arrange"
import { finishedNow, stackOf, type Stack } from "@/lib/conversations"
import { cutsOf, readCuts } from "@/lib/cuts"
import { mannerOf, savedAccess } from "@/lib/manner"
import { answering, offeredModels, usable } from "@/lib/providers"
import { callingOn, notCalledOn } from "@/lib/mentions"
import { usePreferences } from "@/lib/preferences"
import {
  back,
  coloured,
  forth,
  later,
  NO_HISTORY,
  rearranged,
  record,
  recolour,
  saidOf,
  type History,
} from "@/lib/undo"
import { PALETTE, type PaletteName } from "@shared/palette"

import {
  EFFORTS,
  PROVIDERS,
  type Access,
  type Commands,
  type ConversationSummary,
  type Effort,
  type ObjectRef,
  type PartNote,
  type PartRef,
  type Project,
  type Provider,
  type ProviderId,
  type ProviderSettings,
  type Seen,
  type ThreadItem,
  type Vec3,
} from "@shared/api"
import type { Turn } from "@/lib/orient"

/**
 * solid: as built. glass: the outside goes see-through. wireframe: lines only, as far as
 * the model itself does not hide them. outline: every line, the hidden ones too.
 */
export type DisplayMode = "solid" | "glass" | "wireframe" | "outline"

/** A flat cut through the model, with one side of it hidden. */
export type Section = {
  /** a point the cut passes through, model mm */
  position: Vec3
  /** how the cut is turned: the turn that carries +Z to the side that is kept */
  turn: Turn
  /** keep the other side instead */
  flipped: boolean
}

export type View = {
  mode: DisplayMode
  exploded: boolean
  /** how far apart the parts are pulled, as a multiple of the model's own distances */
  spread: number
  section: Section | null
  /** what the view is cut down to; null shows everything */
  only: Only | null
  /**
   * The parts put out of sight, by id: what was picked out when H was pressed. They are
   * not drawn, whatever else the view is cut down to, until they are brought back.
   */
  hidden: string[]
  /** whether the ground is ruled into squares, and the world's axes drawn across it */
  grid: boolean
  /**
   * Whether it is the model's blueprint that is looked at, and not the model: the sheets
   * it is drawn on, one to each side, in place of the view of it.
   */
  blueprint: boolean
  /** whether a blueprint says how big the model is: its width, height and depth */
  dimensions: boolean
  /**
   * The reference scene the model is set in, by what it is known by: things of a known
   * real size drawn round it, so that how big it is can be seen (see lib/reference).
   * Null while it is set in none.
   */
  reference: string | null
}

/**
 * What is picked out of the model, to be shown on its own: one part, a group of them,
 * several parts picked out together in the view, or the keep-outs, which are not parts
 * but are listed with them. What is picked out in the view, with I, is gone up to as
 * well: the camera is brought to it, and taken back when the rest is shown again.
 */
export type Only =
  | { kind: "part" | "group" | "keepouts"; id: string; near?: boolean }
  | { kind: "parts"; ids: string[]; near?: boolean }

/** Exploding starts at the model's own distances and can be pushed this much further. */
export const SPREAD = { min: 1, max: 4 }

/** How wide the conversation is, px: at the least, and until its edge is dragged. */
export const THREAD_WIDTH = { min: 320, initial: 400 }
/** How much of the window's width the conversation leaves the view, at the least. */
export const VIEW_MIN = 480

/** The nearest to a width that the conversation can have in a window this wide. */
export function fitThread(width: number, windowWidth: number): number {
  const most = Math.max(THREAD_WIDTH.min, windowWidth - VIEW_MIN)
  return Math.round(Math.min(most, Math.max(THREAD_WIDTH.min, width)))
}

/**
 * A part that is picked out: or, where the part says so (`part.piece`), the piece of the
 * model it is of, picked out as one thing at that place on it. `at` is where on screen
 * it was clicked, and is what the prompt opens beside.
 */
export type Selection = { part: PartRef; at: { x: number; y: number } | null }

/** What a part that was picked out goes by: the name of its piece, if it was picked out as that. */
export const goesBy = (part: PartRef) => part.piece?.label ?? part.label
/** And the parts that are, by id: the one, or all those of its piece. */
export const allOf = (part: PartRef) => part.piece?.parts ?? [part.id]

/** Stable while no parts are picked out together, or none are hidden. */
const NONE: string[] = []

const ACTIVE_KEY = "enclose:project"
const ACCESS_KEY = "enclose:access"
const PROVIDER_KEY = "enclose:provider"
const MODEL_KEY = "enclose:model"
const EFFORT_KEY = "enclose:effort"
/**
 * What is kept of one agent is kept under its name: all but Claude Code's, which was
 * kept before there were others.
 */
const keyOf = (key: string, provider: ProviderId) =>
  provider === "claude" ? key : `${key}:${provider}`
/** Something of each agent, by agent. */
const each = <Value>(of: (provider: ProviderId) => Value) =>
  Object.fromEntries(PROVIDERS.map((id) => [id, of(id)])) as Record<
    ProviderId,
    Value
  >
const MODE_KEY = "enclose:mode"
const GRID_KEY = "enclose:grid"
const DIMENSIONS_KEY = "enclose:dimensions"
const THREAD_WIDTH_KEY = "enclose:thread-width"
const CUTS_KEY = "enclose:cuts"
const FINISHED_KEY = "enclose:finished"
const COLOURS_KEY = "enclose:colours"
const ARRANGED_KEY = "enclose:arranged"
const REFERENCE_KEY = "enclose:reference"
const FIGURE_KEY = "enclose:figure"
const WAITING_KEY = "enclose:waiting"

/** What was saved under a key, or under the name the app had before it was Enclose. */
const saved = (key: string) =>
  localStorage.getItem(key) ??
  localStorage.getItem(key.replace("enclose:", "cad-ai:"))

const savedMode = (): DisplayMode => {
  const mode = saved(MODE_KEY)
  return mode === "glass" || mode === "wireframe" || mode === "outline"
    ? mode
    : "solid"
}
const savedThreadWidth = (): number => {
  const width = Number(saved(THREAD_WIDTH_KEY))
  return width >= THREAD_WIDTH.min ? width : THREAD_WIDTH.initial
}
const savedColours = (): Record<string, Record<string, PaletteName>> => {
  try {
    const kept: unknown = JSON.parse(saved(COLOURS_KEY) ?? "{}")
    if (!kept || typeof kept !== "object") return {}
    return Object.fromEntries(
      Object.entries(kept).map(([project, parts]) => [
        project,
        Object.fromEntries(
          Object.entries((parts ?? {}) as Record<string, unknown>).filter(
            (entry): entry is [string, PaletteName] =>
              typeof entry[1] === "string" && entry[1] in PALETTE
          )
        ),
      ])
    )
  } catch {
    return {}
  }
}
/**
 * How each project's parts were put into groups by hand, as it was kept: and the names
 * Claude gave the groups that were made so.
 */
const savedArranged = (): {
  arranged: Record<string, Arrangement>
  named: Record<string, Named>
} => {
  const arranged: Record<string, Arrangement> = {}
  const named: Record<string, Named> = {}
  try {
    const kept: unknown = JSON.parse(saved(ARRANGED_KEY) ?? "{}")
    if (!kept || typeof kept !== "object") return { arranged, named }
    for (const [project, one] of Object.entries(kept)) {
      const read = readArrangement(one)
      if (read !== NOT_ARRANGED) arranged[project] = read
      const names = (one as { named?: unknown } | null)?.named
      if (names && typeof names === "object")
        named[project] = Object.fromEntries(
          Object.entries(names).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          )
        )
    }
  } catch {
    // nothing kept that can be read: nothing was done by hand
  }
  return { arranged, named }
}
/** Keep how the projects' parts are arranged by hand, with the names given for it. */
function keepArranged(
  arranged: Record<string, Arrangement>,
  named: Record<string, Named>
) {
  const projects = new Set([...Object.keys(arranged), ...Object.keys(named)])
  localStorage.setItem(
    ARRANGED_KEY,
    JSON.stringify(
      Object.fromEntries(
        [...projects].map((project) => [
          project,
          {
            ...(arranged[project] ?? NOT_ARRANGED),
            named: named[project] ?? {},
          },
        ])
      )
    )
  )
}

/** The reference scene picked for each project by hand, as it was kept. */
const savedScenes = (): Record<string, string> => {
  try {
    const kept: unknown = JSON.parse(saved(REFERENCE_KEY) ?? "{}")
    if (!kept || typeof kept !== "object") return {}
    return Object.fromEntries(
      Object.entries(kept).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    )
  } catch {
    return {}
  }
}

/**
 * What was waiting to be sent when the window was last up: what was said of parts, the
 * parts called on from the view, and what was written in the message boxes. Whatever of
 * it does not read as that is dropped.
 */
function savedWaiting(): Pick<State, "notes" | "drafts" | "called"> {
  const nothing = { notes: {}, drafts: {}, called: {} }
  try {
    const kept = JSON.parse(saved(WAITING_KEY) ?? "null") as {
      notes?: unknown
      drafts?: unknown
      called?: unknown
    } | null
    if (!kept || typeof kept !== "object") return nothing
    const notes = Object.fromEntries(
      Object.entries((kept.notes ?? {}) as Record<string, unknown>).map(
        ([project, said]) => [
          project,
          (Array.isArray(said) ? said : []).filter(
            (note: Partial<Note> | null): note is Note =>
              typeof note?.id === "string" &&
              typeof note.text === "string" &&
              typeof note.part?.id === "string" &&
              typeof note.part.label === "string" &&
              (note.part.piece === undefined ||
                (typeof note.part.piece?.label === "string" &&
                  Array.isArray(note.part.piece.parts)))
          ),
        ]
      )
    )
    const drafts = Object.fromEntries(
      Object.entries((kept.drafts ?? {}) as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    )
    const called = Object.fromEntries(
      Object.entries((kept.called ?? {}) as Record<string, unknown>).map(
        ([project, parts]) => [
          project,
          (Array.isArray(parts) ? parts : []).filter(
            (part: Partial<Called> | null): part is Called =>
              typeof part?.id === "string" &&
              typeof part.label === "string" &&
              (part.parts === undefined || Array.isArray(part.parts)) &&
              (part.scene === undefined || typeof part.scene === "string")
          ),
        ]
      )
    )
    return { notes, drafts, called }
  } catch {
    return nothing
  }
}
const savedFinished = (): string[] => {
  try {
    const kept: unknown = JSON.parse(saved(FINISHED_KEY) ?? "[]")
    return Array.isArray(kept)
      ? kept.filter((id): id is string => typeof id === "string")
      : []
  } catch {
    return []
  }
}
/**
 * How a model is looked at when it opens: whole, assembled, in the mode last used, and
 * on the grid if that was last left on. (So with its blueprint, when that is brought up:
 * saying how big the model is, if it last did.)
 */
const homeView = (): View => ({
  mode: savedMode(),
  exploded: false,
  spread: SPREAD.min,
  section: null,
  only: null,
  hidden: NONE,
  grid: saved(GRID_KEY) === "on",
  blueprint: false,
  dimensions: saved(DIMENSIONS_KEY) === "on",
  reference: null,
})

/** What the view can be put into, and got back out of with Esc. */
export type Entered =
  "section" | "explode" | "only" | "hidden" | "blueprint" | "reference"

/** Those of them that are on, in the order they were gone into: the last is the latest. */
function enteredNow(view: View, before: Entered[]): Entered[] {
  const on: Record<Entered, boolean> = {
    section: view.section !== null,
    explode: view.exploded,
    only: view.only !== null,
    hidden: view.hidden.length > 0,
    blueprint: view.blueprint,
    reference: view.reference !== null,
  }
  const still = before.filter((name) => on[name])
  const fresh = (Object.keys(on) as Entered[]).filter(
    (name) => on[name] && !still.includes(name)
  )
  return [...still, ...fresh]
}

type State = {
  ready: boolean
  projects: Project[]
  activeId: string | null
  /** what has been said in the conversations that have been looked at, by conversation */
  items: Record<string, ThreadItem[]>
  /**
   * The conversation turned to in each project, by project: one of its conversations, or
   * a new one (null). A project not in here shows the one on its card.
   */
  picked: Record<string, string | null>
  /**
   * The conversations Claude has got to the end of a turn in without anyone seeing it:
   * what a card says "Done" of, until it is looked at.
   */
  finished: string[]
  threadOpen: boolean
  /** how wide the conversation was dragged to, px; a narrow window may show it narrower */
  threadWidth: number
  /** whether the list of parts is up */
  partsOpen: boolean
  /** whether the list of reference scenes is up, in the place the list of parts has */
  referenceOpen: boolean
  /**
   * The reference scene the user has picked for each project from that list, by what
   * the scene is known by: the one the project's model is set in from then on.
   */
  sceneOf: Record<string, string>
  /**
   * Whether the figure of a person is shown in a reference scene that has one to show:
   * not until it is asked for, and from then on in whatever project is open.
   */
  figure: boolean
  /** whether the settings are over the window */
  settingsOpen: boolean
  access: Access
  /** the agents there are, once the app has said: Claude Code, Codex, Grok */
  providers: Provider[]
  /** whose agent a conversation is begun with: one carried on keeps the one it has */
  provider: ProviderId
  /** the model picked of each agent's, as it knows it; null leaves it to the agent */
  model: Record<ProviderId, string | null>
  /** how hard each is to think; null leaves that to the agent too */
  effort: Record<ProviderId, Effort | null>
  /** what Claude Code can be called on for in each project's folder, once it has said */
  commands: Record<string, Commands>
  view: View
  /** the cut each project was last left with: where cutting it open again starts from */
  cuts: Record<string, Section>
  /** what the view has been put into, latest last: Esc leaves that one */
  entered: Entered[]
  selection: Selection | null
  /**
   * The parts picked out together, by id: with a box drawn across the view, or one after
   * another with Shift held. While there are any, no one part is picked out with a click
   * (`selection`), and a hint of them shows through whatever of the model is in front.
   */
  several: string[]
  /**
   * The parts a box being drawn across the view takes in so far, by id; null while no
   * box is being drawn. While one is, they are solid and all the rest see-through.
   */
  sweep: string[] | null
  /** the part under the pointer, in the view or in the parts list */
  hoveredId: string | null
  /**
   * A part is being looked for by name, in a message. The view shows where it is: all
   * of the model goes see-through but the part the list is on, which is `hoveredId`.
   */
  seeking: boolean
  /**
   * Parts and groups are being looked for by name, in the view: this is the name, as far
   * as it has been typed. The view shows what goes by it, lit up, through all the rest,
   * which goes see-through. Null while nothing is looked for. Nothing is picked out
   * meanwhile: looking begins by letting go of what was, and picking something ends it.
   */
  finding: string | null
  /**
   * The part picked out is shown in its own colour and not the selection's: a colour is
   * being chosen for it, or has just been, and is to be seen.
   */
  plain: boolean
  /**
   * What is being written of the part picked out, in the view beside it: a new note
   * ("new"), or one already made that is being changed (its id). Null when nothing is.
   */
  writing: string | null
  /**
   * What has been said of parts of each project's model and not yet sent: it goes with
   * the next message, and until then shows on the message box and on the parts.
   */
  notes: Record<string, Note[]>
  /** what is written in each project's message box so far */
  drafts: Record<string, string>
  /**
   * The parts called on from the view for each project's next message, and the whole
   * objects. A part goes with the message by name, as if written in it with @, and an
   * object goes as one thing, with which parts it is. Until then each shows as a chip on
   * the message box.
   */
  called: Record<string, Called[]>
  /**
   * The colour the user has given a part, by project and part: one of the app's own, by
   * name. It is how the app draws the part, whatever the model says of its colour.
   */
  colours: Record<string, Record<string, PaletteName>>
  /**
   * How the user has put each project's parts into groups by hand, over what its model
   * says: groups made, parts taken out of theirs, groups called something else.
   */
  arranged: Record<string, Arrangement>
  /** The names Claude has given groups that were made by hand, by project and group. */
  named: Record<string, Named>
  /** The groups made by hand that Claude is thinking of a name for, by id. */
  naming: string[]
  /**
   * What has been done by hand to each project's model, and can be taken back with
   * Cmd+Z: the colours given to its parts, and how they are put into groups. Kept for
   * as long as the window is up.
   */
  history: Record<string, History>
  /**
   * What the app has to say of something just done that would otherwise go unsaid: what
   * Cmd+Z took back, or why it could not. It is shown at the foot of the view for a
   * moment. `key` tells one such thing from the next.
   */
  saying: { text: string; key: number } | null
  /** bumps to ask the viewport to return to its home view */
  homeRequests: number
  /** bumps to ask the message box to take the typing, after what is written in it */
  writeRequests: number

  activate(id: string): void
  /**
   * Turn to one of a project's conversations, or to a new one (null): the project is
   * opened, and the conversation panel with it.
   */
  openConversation(projectId: string, conversationId: string | null): void
  /** Fetch what has been said in a conversation, the first time it is looked at. */
  load(projectId: string, conversationId: string): void
  /**
   * Pick CAD files or a folder to open (or the one kind, where the picker cannot offer
   * both); true if a project came of it.
   */
  addProject(kind?: "file" | "folder"): Promise<boolean>
  /** Open what was dropped on the window, and turn to the project that came of it. */
  openPaths(paths: string[]): Promise<void>
  /** Make a new project's folder where new projects go, and open it. */
  createProject(): Promise<void>
  removeProject(id: string): Promise<void>
  setView(patch: Partial<View>): void
  /**
   * Cut the model open: the way it was last left cut, or, if it never was, the way
   * `fresh` gives.
   */
  cutOpen(fresh: () => Section): void
  goHome(): void
  select(selection: Selection | null): void
  /** Pick parts out together, in place of whatever was picked out; or none, with none. */
  selectSeveral(partIds: string[]): void
  sweepOver(partIds: string[] | null): void
  hover(partId: string | null): void
  seek(seeking: boolean): void
  /** Look for parts and groups by this name, as far as it is typed; or (null) stop looking. */
  find(name: string | null): void
  showPlain(plain: boolean): void
  /**
   * Start writing of the part picked out ("new"), go back to a note already made (its
   * id), or stop writing (null).
   */
  write(note: string | null): void
  /**
   * Keep what was written: as a new note of the part picked out, or as what the note
   * being changed now says. Gives back the note's id, or null if there was nothing to keep.
   */
  keepNote(text: string): string | null
  dropNote(id: string): void
  setDraft(text: string): void
  /**
   * Call on parts and whole objects for the open project's next message, those of them
   * it does not name already, and bring the message up to be written in.
   */
  callOn(parts: Called[]): void
  dropCalled(id: string): void
  /** Give parts of the open project a colour of the app's, or (null) the model's own back. */
  setColour(partIds: string[], colour: PaletteName | null): void
  /**
   * Put the open project's parts into groups another way, as worked out from how they
   * are arranged now (see lib/arrange). `said` is what was done, as Cmd+Z will say it:
   * "a grouping".
   */
  rearrange(next: Arrangement, said: string): void
  /** Have a group made by hand shown as being named, or no longer. */
  setNaming(groupId: string, on: boolean): void
  /** The name Claude has come up with for a group that was made by hand. */
  nameGroup(projectId: string, groupId: string, name: string): void
  /**
   * Take back the last thing done to the open project's model: a colour given by hand
   * or the parts put into groups another way, or what Claude did to its files in a
   * turn, whichever was later.
   */
  undo(): Promise<void>
  /** Put back what was last taken back. */
  redo(): Promise<void>
  say(text: string): void
  setThreadOpen(open: boolean): void
  setThreadWidth(width: number): void
  setPartsOpen(open: boolean): void
  setReferenceOpen(open: boolean): void
  /**
   * Set the open project's model in a reference scene picked by hand, which is kept as
   * the one for that project.
   */
  pickScene(sceneId: string): void
  setFigure(shown: boolean): void
  setSettingsOpen(open: boolean): void
  /**
   * What Esc does: stop looking for parts by name, if they are being looked for; put the
   * parts list away, if it is up, or the list of reference scenes; and otherwise get out
   * of the last thing gone into, the blueprint and a reference scene among them.
   * False if there was nothing to do.
   */
  leave(): boolean
  setAccess(access: Access): void
  setProvider(provider: ProviderId): void
  setModel(provider: ProviderId, model: string | null): void
  setEffort(provider: ProviderId, effort: Effort | null): void
  /** Send what is in the open project's message box, with what has been said of its parts. */
  send(): void
  /**
   * Have Claude look over a project's model, of files just opened, from what the view
   * shows of it: answered the way a message would be, as far as that is chosen.
   */
  lookOver(projectId: string, seen: Seen): Promise<void>
}

/** How many things the app has had to say: what tells one from the next. */
let said = 0
/** What Claude did is being taken back, or put back: one at a time. */
let turning = false
/** When a part picked out, shown in its own colour for a change to be seen, is to stop being. */
let seen: ReturnType<typeof setTimeout> | undefined
/** How long that is, ms: as long as a colour just given is seen for. */
const SEEN_FOR_MS = 1400

/**
 * Put some of a project's parts to the colours a change has for them, and keep what has
 * been done to it as it now stands. `shown`: let the change be seen on a part that is
 * picked out, which is drawn in the selection's colour and would not show it.
 */
function repaint(
  projectId: string,
  had: Record<string, PaletteName | null>,
  history: History,
  shown = false
) {
  const state = useStore.getState()
  const colours = {
    ...state.colours,
    [projectId]: coloured(state.colours[projectId] ?? {}, had),
  }
  localStorage.setItem(COLOURS_KEY, JSON.stringify(colours))
  useStore.setState({
    colours,
    history: { ...state.history, [projectId]: history },
  })
  const { selection } = state
  if (!shown || !selection) return
  if (!allOf(selection.part).some((id) => id in had)) return
  state.showPlain(true)
  clearTimeout(seen)
  seen = setTimeout(() => useStore.getState().showPlain(false), SEEN_FOR_MS)
}

/**
 * Have a project's parts in groups as an arrangement says, and keep what has been done
 * to the project as it now stands.
 */
function regroup(projectId: string, next: Arrangement, history: History) {
  const state = useStore.getState()
  const arranged = { ...state.arranged, [projectId]: next }
  keepArranged(arranged, state.named)
  useStore.setState({
    arranged,
    history: { ...state.history, [projectId]: history },
  })
}

/** Have what Claude last did to a project's files taken back, or put back, and say what came of it. */
async function turnBack(projectId: string, way: "undo" | "redo") {
  turning = true
  try {
    const saying = saidOf(way, await window.cad.changes[way](projectId))
    if (saying) useStore.getState().say(saying)
  } finally {
    turning = false
  }
}

/** Something said of a part, waiting to be sent: the part and point, and the words. */
export type Note = PartNote & { id: string }

/**
 * Something called on from the view for the next message: what it goes by, and is shown
 * as. A part, by its id; or a whole object, which has `parts`, the ids of all it is made
 * of, and an id made up for it; or the reference scene the model is set in, which has
 * `scene`, what that scene is known by, and makes the message one about the scene.
 */
export type Called = {
  id: string
  label: string
  parts?: string[]
  scene?: string
}

/** A part called on by name, and not a whole object or the reference scene. */
const byName = (called: Called) =>
  called.parts === undefined && called.scene === undefined

/** The reference scene the model is set in, as something to call on. */
export const calledScene = (sceneId: string): Called => ({
  id: "reference-scene",
  label: "Reference scene",
  scene: sceneId,
})

/** A whole object as something to call on. Its parts are no other object's: one of them tells it apart. */
export const calledAs = (object: ObjectRef): Called => ({
  id: `object:${object.parts[0]}`,
  label: object.label,
  parts: object.parts,
})

/** The conversations whose items have been asked for, so that none is asked for twice. */
const fetched = new Set<string>()

export const useStore = create<State>()((set, get) => ({
  ready: false,
  projects: [],
  activeId: null,
  items: {},
  picked: {},
  finished: savedFinished(),
  threadOpen: false,
  threadWidth: savedThreadWidth(),
  partsOpen: false,
  referenceOpen: false,
  sceneOf: savedScenes(),
  figure: saved(FIGURE_KEY) === "shown",
  settingsOpen: false,
  access: savedAccess(saved(ACCESS_KEY)),
  providers: [],
  provider: PROVIDERS.find((one) => one === saved(PROVIDER_KEY)) ?? "claude",
  model: each((id) => saved(keyOf(MODEL_KEY, id)) || null),
  effort: each(
    (id) =>
      EFFORTS.find((effort) => effort === saved(keyOf(EFFORT_KEY, id))) ?? null
  ),
  commands: {},
  view: homeView(),
  cuts: readCuts(saved(CUTS_KEY)),
  entered: [],
  selection: null,
  several: NONE,
  sweep: null,
  hoveredId: null,
  seeking: false,
  finding: null,
  plain: false,
  writing: null,
  ...savedWaiting(),
  colours: savedColours(),
  ...savedArranged(),
  naming: NONE,
  history: {},
  saying: null,
  homeRequests: 0,
  writeRequests: 0,

  activate(id) {
    if (get().activeId === id) return
    localStorage.setItem(ACTIVE_KEY, id)
    set((state) => ({
      activeId: id,
      selection: null,
      several: NONE,
      sweep: null,
      hoveredId: null,
      finding: null,
      writing: null,
      view: homeView(),
      entered: enteredNow(homeView(), state.entered),
    }))
  },

  openConversation(projectId, conversationId) {
    get().activate(projectId)
    set((state) => ({
      picked: { ...state.picked, [projectId]: conversationId },
      threadOpen: true,
    }))
  },

  load(projectId, conversationId) {
    if (fetched.has(conversationId)) return
    fetched.add(conversationId)
    void window.cad.thread.items(projectId, conversationId).then((items) => {
      set((state) => ({ items: { ...state.items, [conversationId]: items } }))
    })
  },

  async addProject(kind) {
    const project = await window.cad.projects.add(kind)
    if (project) get().activate(project.id)
    return project !== null
  },

  async openPaths(paths) {
    if (paths.length === 0) return
    const project = await window.cad.projects.open(paths)
    if (project) get().activate(project.id)
  },

  async createProject() {
    const project = await window.cad.projects.create()
    get().activate(project.id)
  },

  async removeProject(id) {
    await window.cad.projects.remove(id)
  },

  setView(patch) {
    if (patch.mode) localStorage.setItem(MODE_KEY, patch.mode)
    if (patch.grid !== undefined)
      localStorage.setItem(GRID_KEY, patch.grid ? "on" : "off")
    if (patch.dimensions !== undefined)
      localStorage.setItem(DIMENSIONS_KEY, patch.dimensions ? "on" : "off")
    // a cut is kept as it is left, for the next time its project is cut open
    const { activeId, cuts } = get()
    const kept =
      patch.section && activeId ? { ...cuts, [activeId]: patch.section } : cuts
    if (kept !== cuts) localStorage.setItem(CUTS_KEY, JSON.stringify(kept))
    set((state) => {
      const view = { ...state.view, ...patch }
      return {
        view,
        cuts: kept,
        entered: enteredNow(view, state.entered),
        // nothing is picked out of a blueprint: what was, in the view, is let go of,
        // and the list of scenes to set the model in is put away
        ...(patch.blueprint &&
          !state.view.blueprint && {
            referenceOpen: false,
            selection: null,
            several: NONE,
            sweep: null,
            hoveredId: null,
            writing: null,
          }),
      }
    })
  },

  cutOpen(fresh) {
    const { activeId, cuts, setView } = get()
    setView({ section: (activeId && cuts[activeId]) || fresh() })
  },

  goHome() {
    set((state) => ({ homeRequests: state.homeRequests + 1 }))
  },

  select(selection) {
    // picking another part, or none, is done with what was being written of the last:
    // and picking one is done with looking for it
    set({
      selection,
      several: NONE,
      writing: null,
      ...(selection && { finding: null }),
    })
  },

  selectSeveral(partIds) {
    set({
      selection: null,
      several: partIds.length > 0 ? partIds : NONE,
      writing: null,
      ...(partIds.length > 0 && { finding: null }),
    })
  },

  sweepOver(sweep) {
    set({ sweep })
  },

  hover(hoveredId) {
    if (get().hoveredId !== hoveredId) set({ hoveredId })
  },

  seek(seeking) {
    if (get().seeking !== seeking) set({ seeking })
  },

  find(finding) {
    const was = get().finding
    if (was === finding) return
    // looking begins with nothing picked out: what is lit up is what is found
    if (was === null)
      set({ finding, selection: null, several: NONE, writing: null })
    else set({ finding })
  },

  showPlain(plain) {
    if (get().plain !== plain) set({ plain })
  },

  write(note) {
    const { activeId, notes, selection } = get()
    if (note === null || note === "new") {
      set({ writing: selection ? note : null })
      return
    }
    // back to one already made: its part is picked out again, where it was clicked
    const made = (activeId ? notes[activeId] : undefined)?.find(
      (one) => one.id === note
    )
    if (made)
      set({
        selection: { part: made.part, at: null },
        several: NONE,
        writing: note,
        finding: null,
      })
  },

  keepNote(text) {
    const { activeId, notes, selection, writing } = get()
    const said = text.trim()
    if (!activeId || !selection || writing === null) return null
    const before = notes[activeId] ?? []
    const id =
      writing === "new" ? `note-${Date.now()}-${before.length}` : writing
    const next =
      writing === "new"
        ? said
          ? [...before, { id, part: selection.part, text: said }]
          : before
        : // one left with nothing in it is taken back
          before.flatMap((note) =>
            note.id !== id ? [note] : said ? [{ ...note, text: said }] : []
          )
    set({ notes: { ...notes, [activeId]: next }, writing: null })
    return said ? id : null
  },

  dropNote(id) {
    const { activeId, notes, writing } = get()
    if (!activeId) return
    set({
      notes: {
        ...notes,
        [activeId]: (notes[activeId] ?? []).filter((note) => note.id !== id),
      },
      writing: writing === id ? null : writing,
    })
  },

  setDraft(text) {
    const { activeId, drafts } = get()
    if (activeId) set({ drafts: { ...drafts, [activeId]: text } })
  },

  callOn(parts) {
    const { activeId, called, drafts } = get()
    if (!activeId) return
    const before = called[activeId] ?? []
    // not those the message names as it is, in its own words or by a chip: an object
    // is named only by its chip, and so is the reference scene
    const unnamed = notCalledOn(
      drafts[activeId] ?? "",
      parts.filter(byName).map((part) => part.id)
    )
    const fresh = parts.filter(
      (part) =>
        (!byName(part) || unnamed.includes(part.id)) &&
        // (the scene called on is whichever was last: one that was is called on afresh)
        !before.some(
          (other) => other.id === part.id && other.scene === part.scene
        )
    )
    const kept = before.filter(
      (other) => !fresh.some((part) => part.id === other.id)
    )
    set((state) => ({
      called:
        fresh.length > 0
          ? { ...called, [activeId]: [...kept, ...fresh] }
          : called,
      threadOpen: true,
      writeRequests: state.writeRequests + 1,
    }))
  },

  dropCalled(id) {
    const { activeId, called } = get()
    if (!activeId) return
    set({
      called: {
        ...called,
        [activeId]: (called[activeId] ?? []).filter((part) => part.id !== id),
      },
    })
  },

  setColour(partIds, colour) {
    const { activeId, colours, history } = get()
    if (!activeId) return
    const change = recolour(
      colours[activeId] ?? {},
      partIds,
      colour,
      Date.now()
    )
    if (!change) return
    repaint(
      activeId,
      change.after,
      record(history[activeId] ?? NO_HISTORY, change)
    )
  },

  rearrange(next, said) {
    const { activeId, arranged, history } = get()
    if (!activeId) return
    const before = arranged[activeId] ?? NOT_ARRANGED
    regroup(
      activeId,
      next,
      record(
        history[activeId] ?? NO_HISTORY,
        rearranged(before, next, said, Date.now())
      )
    )
  },

  setNaming(groupId, on) {
    const { naming } = get()
    const rest = naming.filter((id) => id !== groupId)
    set({ naming: on ? [...rest, groupId] : rest.length > 0 ? rest : NONE })
  },

  nameGroup(projectId, groupId, name) {
    const { arranged, named } = get()
    const next = {
      ...named,
      [projectId]: { ...named[projectId], [groupId]: name },
    }
    keepArranged(arranged, next)
    set({ named: next })
  },

  async undo() {
    const { activeId, projects, history } = get()
    const project = projects.find((p) => p.id === activeId)
    if (!project || turning) return
    const kept = history[project.id] ?? NO_HISTORY
    const which = later(kept.done.at(-1)?.at ?? null, project.undo?.at ?? null)
    if (which === "mine") {
      const taken = back(kept, Date.now())
      if (!taken) return
      const { change } = taken
      if (change.kind === "colour") {
        repaint(project.id, change.before, taken.history, true)
        get().say("Undid a colour")
      } else {
        regroup(project.id, change.before, taken.history)
        get().say(`Undid ${change.said}`)
      }
    } else if (which === "claudes") await turnBack(project.id, "undo")
  },

  async redo() {
    const { activeId, projects, history } = get()
    const project = projects.find((p) => p.id === activeId)
    if (!project || turning) return
    const kept = history[project.id] ?? NO_HISTORY
    const which = later(
      kept.undone.at(-1)?.undoneAt ?? null,
      project.redo?.at ?? null
    )
    if (which === "mine") {
      const put = forth(kept)
      if (!put) return
      const { change } = put
      if (change.kind === "colour") {
        repaint(project.id, change.after, put.history, true)
        get().say("Redid a colour")
      } else {
        regroup(project.id, change.after, put.history)
        get().say(`Redid ${change.said}`)
      }
    } else if (which === "claudes") await turnBack(project.id, "redo")
  },

  say(text) {
    set({ saying: { text, key: ++said } })
  },

  setThreadOpen(threadOpen) {
    set({ threadOpen })
  },

  setThreadWidth(threadWidth) {
    localStorage.setItem(THREAD_WIDTH_KEY, String(threadWidth))
    set({ threadWidth })
  },

  setPartsOpen(partsOpen) {
    // (the list of reference scenes has the same place: one of them at a time)
    set(partsOpen ? { partsOpen, referenceOpen: false } : { partsOpen })
  },

  setReferenceOpen(referenceOpen) {
    set(referenceOpen ? { referenceOpen, partsOpen: false } : { referenceOpen })
  },

  pickScene(sceneId) {
    const { activeId, sceneOf, setView } = get()
    if (!activeId) return
    const kept = { ...sceneOf, [activeId]: sceneId }
    localStorage.setItem(REFERENCE_KEY, JSON.stringify(kept))
    set({ sceneOf: kept })
    setView({ reference: sceneId })
  },

  setFigure(figure) {
    localStorage.setItem(FIGURE_KEY, figure ? "shown" : "hidden")
    set({ figure })
  },

  setSettingsOpen(settingsOpen) {
    set({ settingsOpen })
  },

  leave() {
    const { finding, partsOpen, referenceOpen, entered, setView } = get()
    // what is being typed goes first, and then the list: both are things on top of the
    // view. What was picked in the list stays
    if (finding !== null) {
      set({ finding: null })
      return true
    }
    if (partsOpen || referenceOpen) {
      set({ partsOpen: false, referenceOpen: false })
      return true
    }
    const last = entered.at(-1)
    if (!last) return false
    if (last === "section") setView({ section: null })
    else if (last === "explode") setView({ exploded: false })
    else if (last === "hidden") setView({ hidden: NONE })
    else if (last === "blueprint") setView({ blueprint: false })
    else if (last === "reference") setView({ reference: null })
    else setView({ only: null })
    return true
  },

  setAccess(access) {
    localStorage.setItem(ACCESS_KEY, access)
    set({ access })
  },

  setProvider(provider) {
    localStorage.setItem(PROVIDER_KEY, provider)
    set({ provider })
  },

  setModel(provider, model) {
    localStorage.setItem(keyOf(MODEL_KEY, provider), model ?? "")
    set((state) => ({ model: { ...state.model, [provider]: model } }))
  },

  setEffort(provider, effort) {
    localStorage.setItem(keyOf(EFFORT_KEY, provider), effort ?? "")
    set((state) => ({ effort: { ...state.effort, [provider]: effort } }))
  },

  send() {
    const { activeId, projects, picked } = get()
    const project = projects.find((p) => p.id === activeId)
    if (!project) return
    // the parts called on from the view go ahead of what is written, by name: and the
    // whole objects go beside it, each as one thing
    const called = get().called[project.id] ?? []
    const message = callingOn(
      (get().drafts[project.id] ?? "").trim(),
      called.filter(byName).map((part) => part.id)
    )
    const objects = called.flatMap(({ label, parts }): ObjectRef[] =>
      parts ? [{ label, parts }] : []
    )
    // and with the reference scene called on, it is the scene the message is about
    const reference = called.find((one) => one.scene)?.scene ?? null
    const notes = get().notes[project.id] ?? []
    if (!message && notes.length === 0 && objects.length === 0 && !reference)
      return
    // into the conversation the panel is showing; if that is a new one, this begins it
    const { open } = stackOf(
      project.conversations,
      picked[project.id],
      usePreferences.getState().settleDays,
      Date.now()
    )
    set((state) => ({
      threadOpen: true,
      writing: null,
      drafts: { ...state.drafts, [project.id]: "" },
      notes: { ...state.notes, [project.id]: [] },
      called: { ...state.called, [project.id]: [] },
    }))
    void window.cad.thread
      .send(
        project.id,
        open?.id ?? null,
        message,
        notes.map(({ part, text }) => ({ part, text })),
        objects,
        mannerIn(get(), open),
        reference
      )
      .then((id) => {
        // stay with it: a conversation that has just begun is not yet the one on the
        // card, and one that had settled is turned back to by being carried on
        if (id)
          set((state) => ({ picked: { ...state.picked, [project.id]: id } }))
      })
  },

  async lookOver(projectId, seen) {
    const id = await window.cad.thread.lookOver(
      projectId,
      seen,
      mannerIn(get(), null)
    )
    // what comes of it is what the conversation panel shows, when it is brought up
    if (id) set((state) => ({ picked: { ...state.picked, [projectId]: id } }))
  },
}))

/**
 * How a message said in a conversation will be answered, from what is picked: by the
 * agent the conversation is had with, or the one picked for a new one (null).
 */
function mannerIn(
  state: Pick<State, "providers" | "provider" | "model" | "effort" | "access">,
  conversation: Pick<ConversationSummary, "provider"> | null
) {
  const provider = answering(state.providers, state.provider, conversation)
  return mannerOf(
    provider,
    offeredModels(state.providers.find((one) => one.id === provider)),
    state.model[provider],
    state.effort[provider],
    state.access
  )
}

/** Change what is chosen about one of the agents. */
export async function changeProvider(
  id: ProviderId,
  patch: Partial<ProviderSettings>
) {
  useStore.setState({ providers: await window.cad.providers.change(id, patch) })
}

/** Have the agents looked at again: what is installed, who is signed in, what models. */
export async function checkProviders() {
  useStore.setState({ providers: await window.cad.providers.check() })
}

/** The agents are being looked at again, for one that had not said what models it has. */
let asking: Promise<unknown> | null = null

/**
 * Have the agents looked at again if the one that is to answer has not said what models
 * it has: it may not have been ready when the app started.
 */
export async function askModels(provider: ProviderId) {
  const one = useStore.getState().providers.find((p) => p.id === provider)
  if (!one || !usable(one) || one.models.length > 0 || one.checking) return
  asking ??= checkProviders().finally(() => (asking = null))
  await asking
}

/** How long what Claude Code said it has in a folder is taken as still so, in ms. */
const COMMANDS_FRESH_MS = 60_000
/** When each project's commands were last asked for. */
const commandsAsked = new Map<string, number>()

/**
 * Ask Claude Code what commands and skills it has in a project's folder, unless it was
 * asked a moment ago. What it said before stays until it has said again.
 */
export async function askCommands(projectId: string) {
  const now = Date.now()
  if (now - (commandsAsked.get(projectId) ?? -Infinity) < COMMANDS_FRESH_MS)
    return
  commandsAsked.set(projectId, now)
  const found = await window.cad.claude.commands(projectId)
  if (found.commands.length + found.skills.length > 0)
    useStore.setState((state) => ({
      commands: { ...state.commands, [projectId]: found },
    }))
  // it would not say: it is asked again the next time
  else commandsAsked.delete(projectId)
}

/** Put an item into a thread, replacing the one with the same id if it is already there. */
function withItem(items: ThreadItem[], item: ThreadItem): ThreadItem[] {
  const index = items.findIndex((i) => i.id === item.id)
  if (index < 0) return [...items, item]
  const next = items.slice()
  next[index] = item
  return next
}

function reconcile(projects: Project[]) {
  const { activeId, activate, cuts, projects: before } = useStore.getState()
  const kept = cutsOf(cuts, projects)
  if (kept !== cuts) localStorage.setItem(CUTS_KEY, JSON.stringify(kept))
  useStore.setState({ projects, cuts: kept })
  tally(before)
  if (activeId && projects.some((p) => p.id === activeId)) return
  // the open project is gone, or nothing was open yet: fall back to one that exists
  const wanted = /^#project=(.+)$/.exec(location.hash)?.[1] ?? saved(ACTIVE_KEY)
  const next = projects.find((p) => p.id === wanted) ?? projects[0]
  if (next) activate(next.id)
  else
    useStore.setState({
      activeId: null,
      selection: null,
      several: NONE,
      finding: null,
      writing: null,
    })
}

/** The conversation in front of the user: the one the panel shows, while it is up. */
function inView(): string | null {
  const { threadOpen, activeId, projects, picked } = useStore.getState()
  const project = projects.find((p) => p.id === activeId)
  if (!threadOpen || !project) return null
  return (
    stackOf(
      project.conversations,
      picked[project.id],
      usePreferences.getState().settleDays,
      Date.now()
    ).open?.id ?? null
  )
}

/**
 * Bring the list of conversations finished and not yet seen up to date: with what has
 * just come to an end, given the projects as they were a moment ago, and without what
 * is now being looked at.
 */
function tally(before?: Project[]) {
  const { finished, projects } = useStore.getState()
  const now = projects.flatMap((p) => p.conversations)
  const next = finishedNow(
    finished,
    before ? before.flatMap((p) => p.conversations) : now,
    now,
    inView()
  )
  if (next === finished) return
  localStorage.setItem(FINISHED_KEY, JSON.stringify(next))
  useStore.setState({ finished: next })
}

/** Connect the store to the app's own process. Call once, before the first render. */
export function connect() {
  const { cad } = window
  cad.projects.onChange(reconcile)
  // what is waiting to be sent is kept as it changes, so that the window can be loaded
  // again without losing it
  useStore.subscribe((state, was) => {
    if (
      state.notes !== was.notes ||
      state.drafts !== was.drafts ||
      state.called !== was.called
    )
      localStorage.setItem(
        WAITING_KEY,
        JSON.stringify({
          notes: state.notes,
          drafts: state.drafts,
          called: state.called,
        })
      )
  })
  // turning to a conversation, or bringing the panel up, is looking at what is in it
  useStore.subscribe((state, was) => {
    if (
      state.activeId !== was.activeId ||
      state.picked !== was.picked ||
      state.threadOpen !== was.threadOpen
    )
      tally()
  })
  cad.thread.onItem((_projectId, conversationId, item) => {
    useStore.setState((state) => ({
      items: {
        ...state.items,
        [conversationId]: withItem(state.items[conversationId] ?? [], item),
      },
    }))
  })
  void cad.projects.list().then((projects) => {
    reconcile(projects)
    useStore.setState({ ready: true })
  })
  cad.providers.onChange((providers) => useStore.setState({ providers }))
  void cad.providers
    .list()
    .then((providers) => useStore.setState({ providers }))
}

// lets a script drive the app when it is being checked without a person at it
if (import.meta.env.DEV) Object.assign(window, { __store: useStore })

export const useActiveProject = () =>
  useStore(
    (state) => state.projects.find((p) => p.id === state.activeId) ?? null
  )

/**
 * How a project's conversations are laid out at a given moment: which is on its card,
 * which are under it, and which the conversation panel shows.
 */
export function useStack(project: Project | null, now: number): Stack {
  const picked = useStore((state) =>
    project ? state.picked[project.id] : undefined
  )
  const settleDays = usePreferences((state) => state.settleDays)
  return stackOf(project?.conversations ?? [], picked, settleDays, now)
}
