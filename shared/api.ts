// What the Electron side and the window say to each other. Both import this file, so a
// change here is checked on both ends.

export type Vec3 = [number, number, number]

/** idle: nothing running. working: Claude is on a turn. asking: waiting on a yes/no from you. */
export type ThreadStatus = "idle" | "working" | "asking"

export type ThreadSummary = {
  status: ThreadStatus
  /** when the current turn started (ms), while one is running */
  since: number | null
  lastMessage: string | null
  updatedAt: number | null
}

/** A folder on disk, and the conversation about it. */
export type Project = {
  id: string
  path: string
  name: string
  branch: string | null
  /** the model manifest found in the folder, relative to it; null if there is none yet */
  manifest: string | null
  /** goes up each time the manifest is rewritten, so the window knows to reload */
  revision: number
  thread: ThreadSummary
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

/** ask: Claude edits files freely but asks before anything else. full: never asks. */
export type Access = "ask" | "full"

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

export type CadApi = {
  platform: string
  projects: {
    list(): Promise<Project[]>
    /** opens the folder picker; resolves to the project, or null if cancelled */
    add(): Promise<Project | null>
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
    items(projectId: string): Promise<ThreadItem[]>
    send(
      projectId: string,
      text: string,
      part: PartRef | null,
      access: Access
    ): Promise<void>
    stop(projectId: string): Promise<void>
    answer(
      projectId: string,
      permissionId: string,
      answer: PermissionAnswer
    ): Promise<void>
    /** forget the conversation and start a new one */
    reset(projectId: string): Promise<void>
    onItem(listener: (projectId: string, item: ThreadItem) => void): () => void
    onReset(listener: (projectId: string) => void): () => void
  }
  claude: {
    status(): Promise<ClaudeStatus>
  }
  viewport: {
    onRequest(listener: (request: ViewportRequest) => void): () => void
    respond(response: ViewportResponse): void
  }
}

export const CHANNEL = {
  projectsList: "projects:list",
  projectsAdd: "projects:add",
  projectsRemove: "projects:remove",
  projectsReveal: "projects:reveal",
  projectsChanged: "projects:changed",
  modelRead: "model:read",
  modelSaveCopy: "model:save-copy",
  threadItems: "thread:items",
  threadSend: "thread:send",
  threadStop: "thread:stop",
  threadAnswer: "thread:answer",
  threadReset: "thread:reset",
  threadItem: "thread:item",
  threadWasReset: "thread:was-reset",
  claudeStatus: "claude:status",
  viewportRequest: "viewport:request",
  viewportResponse: "viewport:response",
} as const

/** The scheme the window loads model files through: cad-model://<project id>/<file>. */
export const MODEL_SCHEME = "cad-model"
