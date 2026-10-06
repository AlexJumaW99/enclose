// What the Electron side and the window say to each other. Both import this file, so a
// change here is checked on both ends.

export type Vec3 = [number, number, number]

/** idle: nothing running. working: Claude is on a turn. asking: waiting on a yes/no from you. */
export type ThreadStatus = "idle" | "working" | "asking"

/** One conversation about a project, in as much as a card in the sidebar has room for. */
export type ConversationSummary = {
  id: string
  /** what it set out to do: the first thing said in it */
  title: string
  status: ThreadStatus
  /** when the current turn started (ms), while one is running */
  since: number | null
  lastMessage: string | null
  /** when something was last said or done in it (ms) */
  updatedAt: number
}

/** A folder on disk, and the conversations about it. */
export type Project = {
  id: string
  path: string
  name: string
  branch: string | null
  /** the model manifest found in the folder, relative to it; null if there is none yet */
  manifest: string | null
  /** goes up each time the manifest is rewritten, so the window knows to reload */
  revision: number
  /**
   * The conversations had about it, the latest first. One that is over is kept: only
   * taking the project off the list forgets them. At most one is running at a time.
   */
  conversations: ConversationSummary[]
}

/** The part someone clicked, and where on it. Coordinates are the model's own, in mm. */
export type PartRef = {
  id: string
  label: string
  point: Vec3 | null
  normal: Vec3 | null
  /** which face of the part, counted in the order the model file lists them */
  face: number | null
}

export type ThreadItem =
  | { kind: "user"; id: string; at: number; text: string; part: PartRef | null }
  | {
      kind: "assistant"
      id: string
      at: number
      text: string
      streaming: boolean
    }
  | {
      kind: "tool"
      id: string
      at: number
      name: string
      detail: string
      state: "running" | "done" | "failed"
    }
  | {
      kind: "permission"
      id: string
      at: number
      title: string
      detail: string
      canAlways: boolean
      state: "pending" | "allowed" | "denied"
    }
  | {
      kind: "notice"
      id: string
      at: number
      tone: "error" | "info"
      text: string
    }

/**
 * What Claude may do without asking. supervised: nothing that changes a file or runs a
 * command. edits: change the project's files, and ask before anything else. auto: Claude
 * Code judges what is routine and asks about the rest. full: anything.
 */
export type Access = "supervised" | "edits" | "auto" | "full"
export const ACCESSES: readonly Access[] = [
  "supervised",
  "edits",
  "auto",
  "full",
]

/** How hard a model is told to think before it answers. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max"
export const EFFORTS: readonly Effort[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]

/** A model the installed Claude Code offers. */
export type ModelChoice = {
  /** what Claude Code knows it by, or null for whichever model it is set to run */
  id: string | null
  /** as Claude Code lists it: "Opus 5.5", "Default (recommended)" */
  name: string
  /** the model it is, said shortly: the same, but for the default, the model that is */
  short: string
  detail: string
  /** how hard it can be told to think; none if that is not to be chosen */
  efforts: Effort[]
}

/** How a message is to be answered: by which model, thinking how hard, asking how much. */
export type Manner = {
  /** null: the model Claude Code is set to run */
  model: string | null
  /** null: as hard as Claude Code is set to have that model think */
  effort: Effort | null
  access: Access
}

export type PermissionAnswer = "allow" | "always" | "deny"

export type ClaudeStatus = {
  /** the Claude Code this app will run: the one installed on this machine, if any */
  path: string | null
  version: string | null
}

export type ModelSource = {
  /** the manifest, parsed but not yet checked */
  manifest: unknown
  /** prefix for every file the manifest names */
  baseUrl: string
}

export type ViewportRequest = {
  id: number
  projectId: string
  kind: "screenshot" | "selection" | "parts"
}

export type ViewportResponse =
  | { id: number; ok: true; data: unknown }
  | { id: number; ok: false; error: string }

/** What the user has chosen for the app as a whole. */
export type Settings = {
  /** where a new project's folder is made when the user does not give one */
  projectsFolder: string
}

export type CadApi = {
  platform: string
  projects: {
    list(): Promise<Project[]>
    /** opens the folder picker; resolves to the project, or null if cancelled */
    add(): Promise<Project | null>
    /** add a folder the user dropped on the window; null if it is not a folder */
    addFolder(dir: string): Promise<Project | null>
    /** make a folder where new projects go, under a stand-in name, and add it */
    create(): Promise<Project>
    /** where on disk something dropped on the window is */
    pathOf(file: File): string
    /**
     * Take the project off the list and forget its conversations, asking first if it has
     * any. Its folder is kept, with everything in it.
     */
    remove(id: string): Promise<void>
    reveal(id: string): Promise<void>
    onChange(listener: (projects: Project[]) => void): () => void
  }
  model: {
    read(projectId: string): Promise<ModelSource | null>
    /** save one of the model's files somewhere the user picks */
    saveCopy(projectId: string, file: string, name: string): Promise<boolean>
  }
  thread: {
    items(projectId: string, conversationId: string): Promise<ThreadItem[]>
    /**
     * Say something in a conversation, or begin a new one with it (null). Resolves to
     * the conversation it went into, or to null if it could not be said.
     */
    send(
      projectId: string,
      conversationId: string | null,
      text: string,
      part: PartRef | null,
      manner: Manner
    ): Promise<string | null>
    /** stop whatever Claude is doing in the project */
    stop(projectId: string): Promise<void>
    answer(
      projectId: string,
      permissionId: string,
      answer: PermissionAnswer
    ): Promise<void>
    onItem(
      listener: (
        projectId: string,
        conversationId: string,
        item: ThreadItem
      ) => void
    ): () => void
  }
  claude: {
    status(): Promise<ClaudeStatus>
    /** the models to choose from; none if Claude Code is missing or would not say */
    models(): Promise<ModelChoice[]>
  }
  settings: {
    get(): Promise<Settings>
    /** opens the folder picker; resolves to the settings as they then are */
    chooseProjectsFolder(): Promise<Settings>
    /** show the folder new projects go in, making it if it is not there yet */
    revealProjectsFolder(): Promise<void>
  }
  viewport: {
    onRequest(listener: (request: ViewportRequest) => void): () => void
    respond(response: ViewportResponse): void
  }
}

export const CHANNEL = {
  projectsList: "projects:list",
  projectsAdd: "projects:add",
  projectsAddFolder: "projects:add-folder",
  projectsCreate: "projects:create",
  projectsRemove: "projects:remove",
  projectsReveal: "projects:reveal",
  projectsChanged: "projects:changed",
  modelRead: "model:read",
  modelSaveCopy: "model:save-copy",
  threadItems: "thread:items",
  threadSend: "thread:send",
  threadStop: "thread:stop",
  threadAnswer: "thread:answer",
  threadItem: "thread:item",
  claudeStatus: "claude:status",
  claudeModels: "claude:models",
  settingsGet: "settings:get",
  settingsChooseProjectsFolder: "settings:choose-projects-folder",
  settingsRevealProjectsFolder: "settings:reveal-projects-folder",
  viewportRequest: "viewport:request",
  viewportResponse: "viewport:response",
} as const

/** The scheme the window loads model files through: cad-model://<project id>/<file>. */
export const MODEL_SCHEME = "cad-model"
