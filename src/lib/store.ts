// Everything the window knows: the projects, their conversations, and how the model is
// being looked at.
import { create } from "zustand"

import type {
  Access,
  ClaudeStatus,
  PartRef,
  Project,
  ThreadItem,
} from "@shared/api"

export type ShellMode = "solid" | "glass" | "hidden"
export type Axis = "x" | "y" | "z"
export type Clip = { axis: Axis; at: number; side: 1 | -1 }

export type View = {
  shell: ShellMode
  explode: number
  clip: Clip | null
  keepouts: boolean
  /** toggle layers that are switched off */
  off: Record<string, boolean>
}

/** A part someone clicked, and where on screen, for the prompt that opens next to it. */
export type Selection = { part: PartRef; x: number; y: number }

const HOME_VIEW: View = {
  shell: "glass",
  explode: 0,
  clip: null,
  keepouts: true,
  off: {},
}
const ACTIVE_KEY = "cad-ai:project"
const ACCESS_KEY = "cad-ai:access"

type State = {
  ready: boolean
  projects: Project[]
  activeId: string | null
  items: Record<string, ThreadItem[]>
  threadOpen: boolean
  access: Access
  claude: ClaudeStatus | null
  view: View
  selection: Selection | null
  /** whether the prompt beside the selection is showing */
  prompting: boolean
  /** bumps to ask the viewport to return to its home view */
  homeRequests: number

  activate(id: string): void
  addProject(): Promise<void>
  removeProject(id: string): Promise<void>
  setView(patch: Partial<View>): void
  goHome(): void
  select(selection: Selection | null): void
  closePrompt(): void
  setThreadOpen(open: boolean): void
  setAccess(access: Access): void
  send(text: string, part: PartRef | null): void
}

export const useStore = create<State>()((set, get) => ({
  ready: false,
  projects: [],
  activeId: null,
  items: {},
  threadOpen: false,
  access: localStorage.getItem(ACCESS_KEY) === "full" ? "full" : "ask",
  claude: null,
  view: HOME_VIEW,
  selection: null,
  prompting: false,
  homeRequests: 0,

  activate(id) {
    if (get().activeId === id) return
    localStorage.setItem(ACTIVE_KEY, id)
    set({ activeId: id, selection: null, prompting: false, view: HOME_VIEW })
    if (!get().items[id]) {
      void window.cad.thread.items(id).then((items) => {
        set((state) => ({ items: { ...state.items, [id]: items } }))
      })
    }
  },

  async addProject() {
    const project = await window.cad.projects.add()
    if (project) get().activate(project.id)
  },

  async removeProject(id) {
    await window.cad.projects.remove(id)
  },

  setView(patch) {
    set((state) => ({ view: { ...state.view, ...patch } }))
  },

  goHome() {
    set((state) => ({
      view: { ...state.view, explode: 0, clip: null },
      homeRequests: state.homeRequests + 1,
    }))
  },

  select(selection) {
    set({ selection, prompting: selection !== null })
  },

  closePrompt() {
    set({ prompting: false })
  },

  setThreadOpen(threadOpen) {
    set({ threadOpen })
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
  const wanted =
    /^#project=(.+)$/.exec(location.hash)?.[1] ??
    localStorage.getItem(ACTIVE_KEY)
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
