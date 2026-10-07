// Everything the window knows: the projects, their conversations, and how the model is
// being looked at.
import { create } from "zustand"

import { finishedNow, stackOf, type Stack } from "@/lib/conversations"
import { cutsOf, readCuts } from "@/lib/cuts"
import { mannerOf, savedAccess } from "@/lib/manner"
import { usePreferences } from "@/lib/preferences"
import { PALETTE, type PaletteName } from "@shared/palette"

import {
  EFFORTS,
  type Access,
  type ClaudeStatus,
  type Commands,
  type Effort,
  type ModelChoice,
  type PartNote,
  type PartRef,
  type Project,
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
}

/**
 * What is picked out of the model, to be shown on its own: one part, a group of them, or
 * the keep-outs, which are not parts but are listed with them. A part picked out in the
 * view, with I, is gone up to as well: the camera is brought to it, and taken back when
 * the rest is shown again.
 */
export type Only = {
  kind: "part" | "group" | "keepouts"
  id: string
  near?: boolean
}

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
 * A part that is picked out. `at` is where on screen it was clicked, and is what the
 * prompt opens beside.
 */
export type Selection = { part: PartRef; at: { x: number; y: number } | null }

const ACTIVE_KEY = "enclose:project"
const ACCESS_KEY = "enclose:access"
const MODEL_KEY = "enclose:model"
const EFFORT_KEY = "enclose:effort"
const MODE_KEY = "enclose:mode"
const THREAD_WIDTH_KEY = "enclose:thread-width"
const CUTS_KEY = "enclose:cuts"
const FINISHED_KEY = "enclose:finished"
const COLOURS_KEY = "enclose:colours"
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
 * What was waiting to be sent when the window was last up: what was said of parts, and
 * what was written in the message boxes. Whatever of it does not read as that is dropped.
 */
function savedWaiting(): Pick<State, "notes" | "drafts"> {
  const nothing = { notes: {}, drafts: {} }
  try {
    const kept = JSON.parse(saved(WAITING_KEY) ?? "null") as {
      notes?: unknown
      drafts?: unknown
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
              typeof note.part.label === "string"
          ),
        ]
      )
    )
    const drafts = Object.fromEntries(
      Object.entries((kept.drafts ?? {}) as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    )
    return { notes, drafts }
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
/** How a model is looked at when it opens: whole, assembled, in the mode last used. */
const homeView = (): View => ({
  mode: savedMode(),
  exploded: false,
  spread: SPREAD.min,
  section: null,
  only: null,
})

/** What the view can be put into, and got back out of with Esc. */
export type Entered = "section" | "explode" | "only"

/** Those of them that are on, in the order they were gone into: the last is the latest. */
function enteredNow(view: View, before: Entered[]): Entered[] {
  const on: Record<Entered, boolean> = {
    section: view.section !== null,
    explode: view.exploded,
    only: view.only !== null,
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
  /** whether the settings are over the window */
  settingsOpen: boolean
  access: Access
  /** the model picked to answer, as Claude Code knows it; null leaves it to Claude Code */
  model: string | null
  /** how hard it is to think; null leaves that to Claude Code too */
  effort: Effort | null
  /** the models Claude Code offers, once it has said */
  models: ModelChoice[]
  /** what Claude Code can be called on for in each project's folder, once it has said */
  commands: Record<string, Commands>
  claude: ClaudeStatus | null
  view: View
  /** the cut each project was last left with: where cutting it open again starts from */
  cuts: Record<string, Section>
  /** what the view has been put into, latest last: Esc leaves that one */
  entered: Entered[]
  selection: Selection | null
  /** the part under the pointer, in the view or in the parts list */
  hoveredId: string | null
  /**
   * A part is being looked for by name, in a message. The view shows where it is: all
   * of the model goes see-through but the part the list is on, which is `hoveredId`.
   */
  seeking: boolean
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
   * The colour the user has given a part, by project and part: one of the app's own, by
   * name. It is how the app draws the part, whatever the model says of its colour.
   */
  colours: Record<string, Record<string, PaletteName>>
  /** bumps to ask the viewport to return to its home view */
  homeRequests: number

  activate(id: string): void
  /**
   * Turn to one of a project's conversations, or to a new one (null): the project is
   * opened, and the conversation panel with it.
   */
  openConversation(projectId: string, conversationId: string | null): void
  /** Fetch what has been said in a conversation, the first time it is looked at. */
  load(projectId: string, conversationId: string): void
  /** Pick a folder to add; true if one was added. */
  addProject(): Promise<boolean>
  /** Add folders dropped on the window, and open the last of them. */
  addFolders(dirs: string[]): Promise<void>
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
  hover(partId: string | null): void
  seek(seeking: boolean): void
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
  /** Give a part of the open project a colour of the app's, or (null) the model's own back. */
  setColour(partId: string, colour: PaletteName | null): void
  setThreadOpen(open: boolean): void
  setThreadWidth(width: number): void
  setPartsOpen(open: boolean): void
  setSettingsOpen(open: boolean): void
  /**
   * What Esc does: put the parts list away if it is up, and otherwise get out of the
   * last thing gone into. False if there was nothing to do.
   */
  leave(): boolean
  setAccess(access: Access): void
  setModel(model: string | null): void
  setEffort(effort: Effort | null): void
  /** Send what is in the open project's message box, with what has been said of its parts. */
  send(): void
}

/** Something said of a part, waiting to be sent: the part and point, and the words. */
export type Note = PartNote & { id: string }

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
  settingsOpen: false,
  access: savedAccess(saved(ACCESS_KEY)),
  model: saved(MODEL_KEY) || null,
  effort: EFFORTS.find((effort) => effort === saved(EFFORT_KEY)) ?? null,
  models: [],
  commands: {},
  claude: null,
  view: homeView(),
  cuts: readCuts(saved(CUTS_KEY)),
  entered: [],
  selection: null,
  hoveredId: null,
  seeking: false,
  plain: false,
  writing: null,
  ...savedWaiting(),
  colours: savedColours(),
  homeRequests: 0,

  activate(id) {
    if (get().activeId === id) return
    localStorage.setItem(ACTIVE_KEY, id)
    set((state) => ({
      activeId: id,
      selection: null,
      hoveredId: null,
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

  async addProject() {
    const project = await window.cad.projects.add()
    if (project) get().activate(project.id)
    return project !== null
  },

  async addFolders(dirs) {
    let last: string | null = null
    for (const dir of dirs) {
      const project = await window.cad.projects.addFolder(dir)
      if (project) last = project.id
    }
    if (last) get().activate(last)
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
    // a cut is kept as it is left, for the next time its project is cut open
    const { activeId, cuts } = get()
    const kept =
      patch.section && activeId ? { ...cuts, [activeId]: patch.section } : cuts
    if (kept !== cuts) localStorage.setItem(CUTS_KEY, JSON.stringify(kept))
    set((state) => {
      const view = { ...state.view, ...patch }
      return { view, cuts: kept, entered: enteredNow(view, state.entered) }
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
    // picking another part, or none, is done with what was being written of the last
    set({ selection, writing: null })
  },

  hover(hoveredId) {
    if (get().hoveredId !== hoveredId) set({ hoveredId })
  },

  seek(seeking) {
    if (get().seeking !== seeking) set({ seeking })
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
    if (made) set({ selection: { part: made.part, at: null }, writing: note })
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

  setColour(partId, colour) {
    const { activeId, colours } = get()
    if (!activeId) return
    const others = Object.fromEntries(
      Object.entries(colours[activeId] ?? {}).filter(([id]) => id !== partId)
    )
    const next = {
      ...colours,
      [activeId]: colour ? { ...others, [partId]: colour } : others,
    }
    localStorage.setItem(COLOURS_KEY, JSON.stringify(next))
    set({ colours: next })
  },

  setThreadOpen(threadOpen) {
    set({ threadOpen })
  },

  setThreadWidth(threadWidth) {
    localStorage.setItem(THREAD_WIDTH_KEY, String(threadWidth))
    set({ threadWidth })
  },

  setPartsOpen(partsOpen) {
    set({ partsOpen })
  },

  setSettingsOpen(settingsOpen) {
    set({ settingsOpen })
  },

  leave() {
    const { partsOpen, entered, setView } = get()
    // the list is a thing on top of the view and goes first: what was picked in it stays
    if (partsOpen) {
      set({ partsOpen: false })
      return true
    }
    const last = entered.at(-1)
    if (!last) return false
    if (last === "section") setView({ section: null })
    else if (last === "explode") setView({ exploded: false })
    else setView({ only: null })
    return true
  },

  setAccess(access) {
    localStorage.setItem(ACCESS_KEY, access)
    set({ access })
  },

  setModel(model) {
    localStorage.setItem(MODEL_KEY, model ?? "")
    set({ model })
  },

  setEffort(effort) {
    localStorage.setItem(EFFORT_KEY, effort ?? "")
    set({ effort })
  },

  send() {
    const { activeId, access, model, effort, models, projects, picked } = get()
    const project = projects.find((p) => p.id === activeId)
    if (!project) return
    const message = (get().drafts[project.id] ?? "").trim()
    const notes = get().notes[project.id] ?? []
    if (!message && notes.length === 0) return
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
    }))
    void window.cad.thread
      .send(
        project.id,
        open?.id ?? null,
        message,
        notes.map(({ part, text }) => ({ part, text })),
        mannerOf(models, model, effort, access)
      )
      .then((id) => {
        // stay with it: a conversation that has just begun is not yet the one on the
        // card, and one that had settled is turned back to by being carried on
        if (id)
          set((state) => ({ picked: { ...state.picked, [project.id]: id } }))
      })
  },
}))

/** Ask Claude Code what models it has, if it has not yet said. */
export async function askModels() {
  if (useStore.getState().models.length > 0) return
  const models = await window.cad.claude.models()
  if (models.length > 0) useStore.setState({ models })
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
  else useStore.setState({ activeId: null, selection: null, writing: null })
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
    if (state.notes !== was.notes || state.drafts !== was.drafts)
      localStorage.setItem(
        WAITING_KEY,
        JSON.stringify({ notes: state.notes, drafts: state.drafts })
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
  void cad.claude.status().then((claude) => useStore.setState({ claude }))
  void askModels()
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
