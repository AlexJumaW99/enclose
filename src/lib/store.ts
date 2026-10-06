// Everything the window knows: the projects, their conversations, and how the model is
// being looked at.
import { create } from "zustand"

import type {
  Access,
  ClaudeStatus,
  PartRef,
  Project,
  ThreadItem,
  Vec3,
} from "@shared/api"
import type { Turn } from "@/lib/orient"

/** solid: as built. glass: the outside goes see-through. wireframe: edges only. */
export type DisplayMode = "solid" | "glass" | "wireframe"

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
 * What is picked out in the parts list, to be shown on its own: one part, a group of
 * them, or the keep-outs, which are not parts but are listed with them.
 */
export type Only = { kind: "part" | "group" | "keepouts"; id: string }

/** Exploding starts at the model's own distances and can be pushed this much further. */
export const SPREAD = { min: 1, max: 4 }

/**
 * A part that is picked out. `at` is where on screen it was clicked, and is what the
 * prompt opens beside.
 */
export type Selection = { part: PartRef; at: { x: number; y: number } | null }

const ACTIVE_KEY = "enclose:project"
const ACCESS_KEY = "enclose:access"
const MODE_KEY = "enclose:mode"

/** What was saved under a key, or under the name the app had before it was Enclose. */
const saved = (key: string) =>
  localStorage.getItem(key) ??
  localStorage.getItem(key.replace("enclose:", "cad-ai:"))

const savedMode = (): DisplayMode => {
  const mode = saved(MODE_KEY)
  return mode === "glass" || mode === "wireframe" ? mode : "solid"
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
  items: Record<string, ThreadItem[]>
  threadOpen: boolean
  /** whether the list of parts is up */
  partsOpen: boolean
  /** whether the settings are over the window */
  settingsOpen: boolean
  access: Access
  claude: ClaudeStatus | null
  view: View
  /** what the view has been put into, latest last: Esc leaves that one */
  entered: Entered[]
  selection: Selection | null
  /** the part under the pointer, in the view or in the parts list */
  hoveredId: string | null
  /** whether the prompt beside the selection is showing */
  prompting: boolean
  /** bumps to ask the viewport to return to its home view */
  homeRequests: number

  activate(id: string): void
  /** Pick a folder to add; true if one was added. */
  addProject(): Promise<boolean>
  /** Add folders dropped on the window, and open the last of them. */
  addFolders(dirs: string[]): Promise<void>
  /** Make a new project's folder where new projects go, and open it. */
  createProject(name: string): Promise<void>
  removeProject(id: string): Promise<void>
  setView(patch: Partial<View>): void
  goHome(): void
  select(selection: Selection | null): void
  hover(partId: string | null): void
  closePrompt(): void
  setThreadOpen(open: boolean): void
  setPartsOpen(open: boolean): void
  setSettingsOpen(open: boolean): void
  /**
   * What Esc does: put the parts list away if it is up, and otherwise get out of the
   * last thing gone into. False if there was nothing to do.
   */
  leave(): boolean
  setAccess(access: Access): void
  send(text: string, part: PartRef | null): void
}

export const useStore = create<State>()((set, get) => ({
  ready: false,
  projects: [],
  activeId: null,
  items: {},
  threadOpen: false,
  partsOpen: false,
  settingsOpen: false,
  access: saved(ACCESS_KEY) === "full" ? "full" : "ask",
  claude: null,
  view: homeView(),
  entered: [],
  selection: null,
  hoveredId: null,
  prompting: false,
  homeRequests: 0,

  activate(id) {
    if (get().activeId === id) return
    localStorage.setItem(ACTIVE_KEY, id)
    set((state) => ({
      activeId: id,
      selection: null,
      hoveredId: null,
      prompting: false,
      view: homeView(),
      entered: enteredNow(homeView(), state.entered),
    }))
    if (!get().items[id]) {
      void window.cad.thread.items(id).then((items) => {
        set((state) => ({ items: { ...state.items, [id]: items } }))
      })
    }
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

  async createProject(name) {
    const project = await window.cad.projects.create(name)
    get().activate(project.id)
  },

  async removeProject(id) {
    await window.cad.projects.remove(id)
  },

  setView(patch) {
    if (patch.mode) localStorage.setItem(MODE_KEY, patch.mode)
    set((state) => {
      const view = { ...state.view, ...patch }
      return { view, entered: enteredNow(view, state.entered) }
    })
  },

  goHome() {
    set((state) => ({ homeRequests: state.homeRequests + 1 }))
  },

  select(selection) {
    set({ selection, prompting: Boolean(selection?.at) })
  },

  hover(hoveredId) {
    if (get().hoveredId !== hoveredId) set({ hoveredId })
  },

  closePrompt() {
    set({ prompting: false })
  },

  setThreadOpen(threadOpen) {
    set({ threadOpen })
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

  send(text, part) {
    const { activeId, access } = get()
    const message = text.trim()
    if (!activeId || !message) return
    set({ threadOpen: true, prompting: false })
    void window.cad.thread.send(activeId, message, part, access)
  },
}))

/** Put an item into a thread, replacing the one with the same id if it is already there. */
function withItem(items: ThreadItem[], item: ThreadItem): ThreadItem[] {
  const index = items.findIndex((i) => i.id === item.id)
  if (index < 0) return [...items, item]
  const next = items.slice()
  next[index] = item
  return next
}

function reconcile(projects: Project[]) {
  const { activeId, activate } = useStore.getState()
  useStore.setState({ projects })
  if (activeId && projects.some((p) => p.id === activeId)) return
  // the open project is gone, or nothing was open yet: fall back to one that exists
  const wanted = /^#project=(.+)$/.exec(location.hash)?.[1] ?? saved(ACTIVE_KEY)
  const next = projects.find((p) => p.id === wanted) ?? projects[0]
  if (next) activate(next.id)
  else useStore.setState({ activeId: null, selection: null, prompting: false })
}

/** Connect the store to the app's own process. Call once, before the first render. */
export function connect() {
  const { cad } = window
  cad.projects.onChange(reconcile)
  cad.thread.onItem((projectId, item) => {
    useStore.setState((state) => ({
      items: {
        ...state.items,
        [projectId]: withItem(state.items[projectId] ?? [], item),
      },
    }))
  })
  cad.thread.onReset((projectId) => {
    useStore.setState((state) => ({
      items: { ...state.items, [projectId]: [] },
    }))
  })
  void cad.projects.list().then((projects) => {
    reconcile(projects)
    useStore.setState({ ready: true })
  })
  void cad.claude.status().then((claude) => useStore.setState({ claude }))
}

// lets a script drive the app when it is being checked without a person at it
if (import.meta.env.DEV) Object.assign(window, { __store: useStore })

export const useActiveProject = () =>
  useStore(
    (state) => state.projects.find((p) => p.id === state.activeId) ?? null
  )
