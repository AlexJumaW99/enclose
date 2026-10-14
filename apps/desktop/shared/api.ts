// What the Electron side and the window say to each other. Both import this file, so a
// change here is checked on both ends.

export type Vec3 = [number, number, number]

/**
 * idle: nothing running. working: Claude is on a turn. asking: waiting on you, for a yes
 * or a no, or for an answer to something it asked.
 */
export type ThreadStatus = "idle" | "working" | "asking"

/** One conversation about a project, in as much as a card in the sidebar has room for. */
export type ConversationSummary = {
  id: string
  /** what it goes by: the name it was given, or else the first thing said in it */
  title: string
  /** whose agent it is had with: the one it began with, and is carried on with */
  provider: ProviderId
  status: ThreadStatus
  /** when the current turn started (ms), while one is running */
  since: number | null
  /**
   * What the card says: what was asked, while Claude is at work on it, and otherwise the
   * last thing said by either. In one line, as it was said.
   */
  lastMessage: string | null
  /** the same in a few words, where it was too long for a card and has been summed up */
  gist: string | null
  /** the last thing in it is something having gone wrong: its last turn did not get through */
  failed: boolean
  /** when something was last said or done in it (ms) */
  updatedAt: number
  /**
   * What was said in it while it was being answered, in the order it was said: each
   * waits for the turn before it to be over. One left waiting by a turn that was stopped,
   * or did not get through, waits to be sent by hand.
   */
  queued: Said[]
  /**
   * The turn it is on ends in a new version of the project: the agent was asked for
   * one, and when the turn is over the app begins a conversation for it, which is then
   * the one carried on (see electron/versions.ts).
   */
  versioning: boolean
}

/**
 * How far the app has got with CAD files it was given to open, which it has to make a
 * model of before there is anything to show. python: nothing on this machine to read
 * them with. build: they were read, or tried, and no model came of it.
 */
export type BringingIn =
  | { state: "working"; done: number; total: number | null }
  | { state: "failed"; why: "python" | "build"; detail: string }

/**
 * Something Claude did to a project's files in one turn, which can be taken back, or
 * has been and can be put back: what was asked for in that turn, and when it was done
 * (or, of one taken back, when it was taken back).
 */
export type Undoable = { what: string; at: number }

/**
 * What came of taking such a change back, or putting it back. busy: Claude is at work in
 * the project. changed: the files named have been written to since, and are not written
 * over.
 */
export type Undone =
  | { ok: true; what: string }
  | { ok: false; why: "nothing" | "busy" | "changed"; files: string[] }

/**
 * A project's folder became another of its conversations': whose it was, whose it is,
 * and whether its files were put as that one had left them (see electron/versions.ts).
 */
export type Turned = { from: string | null; to: string; restored: boolean }

/** A folder on disk, and the conversations about it. */
export type Project = {
  id: string
  path: string
  name: string
  branch: string | null
  /** the model manifest found in the folder, relative to it; null if there is none yet */
  manifest: string | null
  /** set while files opened into it are being made a model of, or could not be */
  bringingIn: BringingIn | null
  /**
   * Files opened into a project come with whatever names and groups they had, which is
   * often none worth having. So once there is a model of them Claude looks it over: says
   * what the thing is, and names and groups its parts. wanted: it is yet to be asked to,
   * which is done the next time the model is on screen. underway: it is at it.
   */
  lookOver: "wanted" | "underway" | null
  /** goes up each time the manifest is rewritten, so the window knows to reload */
  revision: number
  /**
   * Whether it has a reference scene of its own, in its folder, for its model to be seen
   * in: null if not, and otherwise a number that goes up each time the scene is
   * rewritten, so the window knows to load it again.
   */
  reference: number | null
  /**
   * Whether it has tools of its own, in its folder, to work its model with (see
   * shared/tool-format.ts): null if not, and otherwise a number that goes up each time
   * one of them is written, so the window knows to load them again.
   */
  tools: number | null
  /**
   * Whether it has assembly guides, in its folder (see shared/assembly-format.ts): null
   * if not, and otherwise a number that goes up each time one of them is written, so the
   * window knows to read them again.
   */
  assembly: number | null
  /**
   * An assembly guide is being made for it, because the user asked for one from the
   * view: the turn Claude is on in it is that.
   */
  assembling: boolean
  /** the latest thing Claude did to its files that can be taken back, and put back */
  undo: Undoable | null
  redo: Undoable | null
  /**
   * The conversations had about it, the latest first. One that is over is kept: only
   * taking the project off the list forgets them. At most one is running at a time.
   */
  conversations: ConversationSummary[]
}

/**
 * A whole object of the model, as the view picks one out: the parts of a group that are
 * one thing, a circuit board with all that is on it. What it goes by, and its parts by id.
 */
export type ObjectRef = { label: string; parts: string[] }

/** The part someone clicked, and where on it. Coordinates are the model's own, in mm. */
export type PartRef = {
  id: string
  label: string
  point: Vec3 | null
  normal: Vec3 | null
  /** which face of the part, counted in the order the model file lists them */
  face: number | null
  /**
   * The piece of the model it was picked out as, when it was not picked out for itself:
   * the parts of its group that are one object with it, a circuit board with all that is
   * on it. What the piece goes by, and its parts by id, this one among them; the rest of
   * this is then where on the piece was clicked.
   */
  piece?: ObjectRef
}

/** Something said of a part: a change wanted at the point of it that was clicked. */
export type PartNote = { part: PartRef; text: string }

/**
 * Words picked out of what was said in a conversation, and what the user says of them:
 * an answer to something that was asked there, or what they want made clear. Nothing
 * said, where the words are only pointed to, for the message to be about.
 */
export type Quote = { quote: string; text: string }

/**
 * A picture put with a message: a photo, a sketch, a drawing. The app keeps a copy of
 * it, with the project's others, and shows it from there.
 */
export type Attached = {
  /** what the app keeps it as: its file's name, among the project's pictures */
  id: string
  /** what it was called where it came from: "image.png" */
  name: string
  mimeType: string
  /** how big its file is, in bytes */
  bytes: number
  /**
   * Which of the message's pictures it is, counted from 1: what "[Image 1]" stands for
   * in what was written, where it was put there.
   */
  number: number
}

/**
 * Something Claude asks before it goes on, where a guess of its own would not do: the
 * question, and the answers it offers. Something else can always be said to it instead.
 */
export type Question = {
  question: string
  options: { label: string; detail: string }[]
  /** more than one of them can be chosen */
  several: boolean
}

/** Something the user said in a conversation. */
export type Said = Extract<ThreadItem, { kind: "user" }>

export type ThreadItem =
  | {
      kind: "user"
      id: string
      at: number
      text: string
      /** the part a message was about, when a message could be about only one */
      part: PartRef | null
      /** what was said of parts of the model, sent along with the message */
      notes?: PartNote[]
      /** what was said of words picked out of the conversation, sent along with it too */
      quotes?: Quote[]
      /**
       * The whole objects called on from the view for the message, which is about them:
       * each as one thing, and not as the parts it is made of.
       */
      objects?: ObjectRef[]
      /**
       * The message is about the reference scene the model was shown in, and not about
       * the model: this is what the scene goes by.
       */
      reference?: string
      /** the pictures that went with the message */
      pictures?: Attached[]
      /**
       * Not said by the user: asked by the app itself of files just opened, that Claude
       * look their model over.
       */
      lookOver?: true
      /** Asked from the view, and not written: that an assembly guide be made. */
      assembly?: true
      /**
       * Not written by the user: what they asked for in another conversation, as the
       * agent summed it up there, for this one to begin with as a new version of the
       * project.
       */
      version?: true
    }
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
      kind: "question"
      id: string
      at: number
      questions: Question[]
      state: "pending" | "answered" | "skipped"
      /** what was said to each, in their order: nothing where it was left to Claude */
      answers: string[]
    }
  | {
      kind: "notice"
      id: string
      at: number
      tone: "error" | "info"
      text: string
    }

/**
 * Whose agent answers. Each is its maker's own command-line agent, installed on this
 * machine and signed in there: the app runs it, and has no login of its own for any.
 */
export type ProviderId = "claude" | "codex" | "grok"
export const PROVIDERS: readonly ProviderId[] = ["claude", "codex", "grok"]

/**
 * What an agent may do without asking. supervised: nothing that changes a file or runs a
 * command. edits: change the project's files, and ask before anything else. auto: the
 * agent judges what is routine and asks about the rest. full: anything.
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

/**
 * A group of parts made by hand, as Claude is asked what to call it: what the thing
 * modelled is called, if anything; what each part in the group goes by, and the group
 * it was in before (null if none); and what the model's other groups are called.
 */
export type GroupAsked = {
  title: string | null
  parts: { label: string; from: string | null }[]
  others: string[]
}

/** A model one of the agents offers. */
export type ModelChoice = {
  /** what the agent knows it by, or null for whichever model it is set to run */
  id: string | null
  /** as the agent lists it: "Opus 5.5", "Default (recommended)" */
  name: string
  /** the model it is, said shortly: the same, but for the default, the model that is */
  short: string
  detail: string
  /** how hard it can be told to think; none if that is not to be chosen */
  efforts: Effort[]
}

/** Something of Claude Code's that a message can call on by name: a command, or a skill. */
export type Command = {
  name: string
  detail: string
  /** what it takes after its name, as Claude Code words it: "<file>". Empty for nothing. */
  hint: string
}

/** What the Claude Code on this machine can be called on for, in a project's folder. */
export type Commands = {
  /** asked for with / at the start of a message: its own, the user's, a plugin's */
  commands: Command[]
  /** asked for with $ anywhere in one */
  skills: Command[]
}

/**
 * How a message is to be answered: by whose agent, with which model, thinking how hard,
 * asking how much.
 */
export type Manner = {
  provider: ProviderId
  /** null: the model the agent is set to run */
  model: string | null
  /** null: as hard as the agent is set to have that model think */
  effort: Effort | null
  access: Access
}

export type PermissionAnswer = "allow" | "always" | "deny"

/** A picture of the model, and what it is a picture of. */
export type Picture = { caption: string; data: string; mimeType: string }

/**
 * A model as it is put before Claude to be looked over: pictures of it, and its parts
 * as the view has them, with the size of each (mm, along x, y and z) and where its
 * middle is.
 */
export type Seen = {
  pictures: Picture[]
  parts: {
    id: string
    label: string
    group: string
    size: Vec3
    middle: Vec3
    color: string | null
  }[]
}

/** Something set in an agent's environment when it is started: a key, an address. */
export type EnvVar = { name: string; value: string }

/** What the user has chosen about one of the agents. */
export type ProviderSettings = {
  /** whether it is offered where a message is written */
  enabled: boolean
  /** what to run: a name looked for on the PATH, or a path. Empty for its usual name. */
  binary: string
  /** where it keeps its settings and its sign-in. Empty for where it keeps them itself. */
  home: string
  /** more to start it with, as it would be typed after its name */
  args: string
  env: EnvVar[]
  /** models of its own that are left out where one is chosen, as it knows them */
  hidden: string[]
  /** models that come first there */
  favorites: string[]
  /** models it did not list but can be told to run, as it knows them */
  custom: string[]
}

/** How one of the agents stands on this machine. */
export type ProviderStatus = {
  /** what would be run: where it was found, or null if it was not */
  path: string | null
  version: string | null
  /** whether an account is signed in to it; null where it has not said */
  signedIn: boolean | null
  /** the account, as far as it says: a plan, an address */
  account: string | null
  /** what went wrong in looking at it, in a line; null if nothing did */
  trouble: string | null
  /** when it was last looked at (ms) */
  checkedAt: number
}

/** One of the agents: what is chosen about it, how it stands, and what it offers. */
export type Provider = {
  id: ProviderId
  settings: ProviderSettings
  /** null until it has been looked for */
  status: ProviderStatus | null
  /** it is being looked at now: what is said of it here may be about to change */
  checking: boolean
  /**
   * Every model it offers, the hidden among them. None until it has said, and none of
   * one that is switched off, which is not asked.
   */
  models: ModelChoice[]
  /**
   * A newer version of it than the one installed, for one in use, and what the app runs
   * to put it in, as that would be typed. Null where there is none, or none it can.
   */
  update: { version: string; command: string } | null
  /** it is being updated now */
  updating: boolean
}

/**
 * What came of updating one. updated: it is the newer version now. same: it is the one
 * it was. failed: the update did not go through. broken: it went through, and what was
 * put in does not answer. `version` is the one installed after.
 */
export type ProviderUpdated = {
  outcome: "updated" | "same" | "failed" | "broken"
  version: string | null
}

export type ModelSource = {
  /** the manifest, parsed but not yet checked */
  manifest: unknown
  /** prefix for every file the manifest names */
  baseUrl: string
}

/**
 * A reference scene, as the window is handed it: things of a known real size for a
 * model to be seen beside, so that how big the model is can be told. It is one of the
 * app's own, known by its name ("table"), or the one the project has in its folder.
 */
export type ReferenceSource = {
  id: string
  /** the project's own, and not one of the app's */
  own: boolean
  /** the scene's manifest, parsed but not yet checked */
  manifest: unknown
  /** prefix for every file the manifest names */
  baseUrl: string
}

/**
 * One of a project's assembly guides, in as much as its cover says: how the thing is put
 * together, a step at a time (see shared/assembly-format.ts).
 */
export type GuideSummary = {
  /** what it is known by: what its file is called, without the ending */
  id: string
  /** what it is a guide to putting together: the thing, or the part of it */
  title: string
  /** which writing of the guide to that it is, counted from 1 */
  version: number
  /** when it was written (ms) */
  made: number
  /** how many steps it has */
  steps: number
  /** the parts it shows, by id: those there to begin with, and those its steps put on */
  parts: string[]
  /**
   * How the thing is drawn on its cover: where it is drawn from, as the way from the
   * model to the eye (null for its front right corner, from above), and the parts the
   * cover is filled with, by id (none for all of the thing).
   */
  cover: { view: Vec3 | null; parts: string[] }
  /** why it cannot be opened, in a line: its file does not read as a guide. Null of one that can */
  trouble: string | null
}

/**
 * How the view draws a model's parts, where that is more than its manifest says: what
 * the user has done to it by hand in the app. A guide's page is told, to draw them so.
 */
export type Looks = {
  /** the colour the user gave a part, by part: one of the app's, by name */
  colours: Record<string, string>
}

/** What a project's own reference scene is known by, among the app's. */
export const OWN_SCENE = "own"

/**
 * One of a project's own tools, as the window is handed it: what it is known by, which
 * is what its file is called without the ending ("clock"), the file, and what is
 * written in it.
 */
export type ToolSource = { id: string; file: string; source: string }

/**
 * Something an agent has a project's tool do, as a hand would: set one of its controls
 * to a value, or press one of a row of buttons.
 */
export type ToolUse = {
  tool: string
  control: string
  value?: number | boolean | string | [number, number]
  press?: string
}

/** What can be asked of the window about its viewport. */
export type ViewportAsked =
  | { kind: "screenshot" | "selection" | "parts" | "tools" }
  | { kind: "tool"; use: ToolUse }

export type ViewportRequest = { id: number; projectId: string } & ViewportAsked

export type ViewportResponse =
  | { id: number; ok: true; data: unknown }
  | { id: number; ok: false; error: string }

/** What the user has chosen for the app as a whole. */
export type Settings = {
  /** where a new project's folder is made when the user does not give one */
  projectsFolder: string
  /** whether Claude looks over the model of CAD files as they are opened */
  lookOver: boolean
  /**
   * whether the app sends a count of how it is used: which of its features, and nothing
   * of a project or a message (electron/analytics.ts)
   */
  analytics: boolean
  /**
   * whether each conversation has the project its own way: the folder put as a
   * conversation left it when that one is turned to (electron/versions.ts). Without,
   * a project is the one version of it, whichever conversation is had about it.
   */
  versions: boolean
}

/**
 * What the window tells the app was put to use, for that count: the things the view can
 * be put into. The rest of what is counted happens in the app's own process.
 */
export const FEATURES = [
  "section",
  "explode",
  "only",
  "hidden",
  "blueprint",
  "assembly",
  "reference",
  "tools",
] as const
export type Feature = (typeof FEATURES)[number]

/**
 * Where the app is with a newer version of itself. There is none that it knows of; or
 * there is one to be had, which is fetched when it is asked for; or it is on its way,
 * with this much of it here (0 to 1); or it is here, and is what the app is once it has
 * been started again, which it is about to be when that has been asked for.
 */
export type Update =
  | { state: "none" }
  | {
      state: "available"
      version: string
      /** it was asked for and did not come: it can be asked for again */
      failed: boolean
    }
  | { state: "downloading"; version: string; fraction: number }
  | { state: "ready" | "restarting"; version: string }

export type CadApi = {
  platform: string
  changes: {
    /** Take back what the latest turn did to a project's files. */
    undo(projectId: string): Promise<Undone>
    /** Put back what was last taken back. */
    redo(projectId: string): Promise<Undone>
  }
  versions: {
    /**
     * Say which of a project's conversations is shown: its folder is put as that one
     * has it, once nothing is at work there.
     */
    show(projectId: string, conversationId: string): void
    /** A project's folder became another conversation's. */
    onTurned(listener: (projectId: string, turned: Turned) => void): () => void
    /**
     * The agent began a new version of a project, as it was asked to in one of the
     * project's conversations (`from`): the conversation begun for it is `to`.
     */
    onBegun(
      listener: (projectId: string, from: string, to: string) => void
    ): () => void
  }
  projects: {
    list(): Promise<Project[]>
    /**
     * Opens the picker, for CAD files and folders alike, or for the one kind where a
     * system's picker cannot offer both. Resolves to the project that came of it (the
     * last, if several did), or to null if none did.
     */
    add(kind?: "file" | "folder"): Promise<Project | null>
    /** open what the user dropped on the window: folders, CAD files, or both */
    open(paths: string[]): Promise<Project | null>
    /** make a folder where new projects go, under a stand-in name, and add it */
    create(): Promise<Project>
    /**
     * Make a project of one of the app's examples (shared/examples.ts), where new
     * projects go, and add it: the example is fetched first, unless the app has it.
     */
    example(id: string): Promise<Project | null>
    /** how many bytes of an example being fetched have come, as they come */
    onExampleProgress(
      listener: (id: string, received: number) => void
    ): () => void
    /** where on disk something dropped on the window is */
    pathOf(file: File): string
    /**
     * Take the project off the list and forget its conversations, asking first if it has
     * any. Its folder is kept, with everything in it.
     */
    remove(id: string): Promise<void>
    /**
     * Call the project something else. It is the project that is renamed, in the app:
     * its folder is left as it is called.
     */
    rename(id: string, name: string): Promise<void>
    reveal(id: string): Promise<void>
    onChange(listener: (projects: Project[]) => void): () => void
  }
  model: {
    read(projectId: string): Promise<ModelSource | null>
    /** save one of the model's files somewhere the user picks */
    saveCopy(projectId: string, file: string, name: string): Promise<boolean>
    /**
     * what a group of parts the user has just made by hand might be called: Claude's
     * answer, or null if there is none to be had
     */
    nameGroup(projectId: string, group: GroupAsked): Promise<string | null>
    /**
     * save several of its files together: in a new folder, called `folder`, made in a
     * folder the user picks
     */
    saveCopies(
      projectId: string,
      files: { file: string; name: string }[],
      folder: string
    ): Promise<boolean>
    /**
     * save several of its files together as one zip archive, somewhere the user picks:
     * `name` is what the archive is called unless they call it something else
     */
    saveArchive(
      projectId: string,
      files: { file: string; name: string }[],
      name: string
    ): Promise<boolean>
    /**
     * save a drawing the app has made of a model, an SVG, somewhere the user picks:
     * `name` is what the file is called unless they call it something else
     */
    saveDrawing(name: string, svg: string): Promise<boolean>
    /**
     * save several such drawings together: in a new folder, called `folder`, made in a
     * folder the user picks
     */
    saveDrawings(
      folder: string,
      drawings: { name: string; svg: string }[]
    ): Promise<boolean>
  }
  reference: {
    /**
     * The reference scenes a project's model can be seen in: its own first, if it has
     * one, and then the app's, from those for the smallest things to those for the
     * biggest.
     */
    scenes(projectId: string): Promise<ReferenceSource[]>
  }
  tools: {
    /** A project's own tools, as they are written in its folder: none if it has none. */
    read(projectId: string): Promise<ToolSource[]>
  }
  assembly: {
    /** A project's assembly guides, the one written last first: none if it has none. */
    read(projectId: string): Promise<GuideSummary[]>
    /**
     * Have a guide made: of the whole model, or of the one thing picked out of it
     * (`of`). It is asked for in a conversation, as a message would be, or begins a new
     * one (null). Resolves to the conversation, or to null if it could not be asked.
     */
    make(
      projectId: string,
      conversationId: string | null,
      of: ObjectRef | null,
      manner: Manner
    ): Promise<string | null>
    /**
     * Open a guide in the browser, as a page of this machine's: the model's parts are
     * shown from where they are, and nothing is copied. `looks` is how the view draws
     * them, for the page to draw them the same.
     */
    open(projectId: string, guideId: string, looks: Looks): Promise<boolean>
    /**
     * Save a guide as one zip archive, somewhere the user picks, with the page and the
     * parts it shows in it: something to send to someone, or to put on a site.
     */
    save(projectId: string, guideId: string, looks: Looks): Promise<boolean>
    /**
     * Take a guide away: its file goes to the system's bin, where it can be had back
     * from. Not while an agent is at work in the project. Resolves to whether it went.
     */
    remove(projectId: string, guideId: string): Promise<boolean>
  }
  pictures: {
    /**
     * Keep a picture that is to go with a project's next message. Resolves to what it
     * is kept as, or to null if it is no picture an agent can be shown, or is too big.
     */
    add(
      projectId: string,
      picture: { name: string; mimeType: string; data: ArrayBuffer }
    ): Promise<Omit<Attached, "number"> | null>
    /** Forget one that was taken back off the message before it was sent. */
    drop(projectId: string, id: string): Promise<void>
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
      notes: PartNote[],
      objects: ObjectRef[],
      manner: Manner,
      /**
       * the reference scene on screen, by what it is known by, when that is what the
       * message is about
       */
      reference?: string | null,
      /** the pictures that go with it, as the app keeps them */
      pictures?: Attached[],
      /** the words picked out of the conversation that go with it, and what is said of each */
      quotes?: Quote[]
    ): Promise<string | null>
    /**
     * Have Claude look over the model of files just opened, from what the view shows of
     * it: say what it is, and name and group its parts. Begins a conversation, and
     * resolves to it; or to null if this is not a project that is waiting for that.
     */
    lookOver(
      projectId: string,
      seen: Seen,
      manner: Manner
    ): Promise<string | null>
    /** stop whatever Claude is doing in the project */
    stop(projectId: string): Promise<void>
    /**
     * Say at once something that is waiting its turn: what is being done in its
     * conversation is stopped for it.
     */
    sendNow(projectId: string, queuedId: string): Promise<void>
    /** take back something that is waiting its turn, before it is said */
    unqueue(projectId: string, queuedId: string): Promise<void>
    /** give a conversation a name to go by; given none, it goes by what was first said */
    rename(
      projectId: string,
      conversationId: string,
      name: string
    ): Promise<void>
    answer(
      projectId: string,
      permissionId: string,
      answer: PermissionAnswer
    ): Promise<void>
    /**
     * Answer what Claude asked: something said to each of its questions, in their
     * order, and nothing ("") to one that is left to it. Null leaves them all to it.
     */
    tell(
      projectId: string,
      questionId: string,
      answers: string[] | null
    ): Promise<void>
    onItem(
      listener: (
        projectId: string,
        conversationId: string,
        item: ThreadItem
      ) => void
    ): () => void
  }
  providers: {
    list(): Promise<Provider[]>
    /** change what is chosen about one; resolves to them all as they then are */
    change(
      id: ProviderId,
      patch: Partial<ProviderSettings>
    ): Promise<Provider[]>
    /** look at them again: what is installed, who is signed in, what models there are */
    check(): Promise<Provider[]>
    /** put in the newest version of one, the way it was installed */
    update(id: ProviderId): Promise<ProviderUpdated>
    onChange(listener: (providers: Provider[]) => void): () => void
  }
  claude: {
    /** the commands and skills Claude Code has in a project's folder; none if it would not say */
    commands(projectId: string): Promise<Commands>
  }
  settings: {
    get(): Promise<Settings>
    /** opens the folder picker; resolves to the settings as they then are */
    chooseProjectsFolder(): Promise<Settings>
    /** show the folder new projects go in, making it if it is not there yet */
    revealProjectsFolder(): Promise<void>
    /** how much room that folder takes, in bytes: nothing, if it is not there yet */
    projectsFolderSize(): Promise<number>
    /** whether Claude is to look over files as they are opened; resolves likewise */
    setLookOver(on: boolean): Promise<Settings>
    /** whether the app is to send a count of how it is used; resolves likewise */
    setAnalytics(on: boolean): Promise<Settings>
    /** whether each conversation is to have the project its own way; resolves likewise */
    setVersions(on: boolean): Promise<Settings>
  }
  analytics: {
    /** say that the view was put into one of these, for the app's count of its use */
    used(feature: Feature): void
  }
  update: {
    get(): Promise<Update>
    /** fetch the newer version there is: how far along it is, is heard of as it comes */
    download(): Promise<void>
    /**
     * Start the app again as the version that was fetched. Asks first, where an agent
     * is in the middle of something that this would stop.
     */
    restart(): Promise<void>
    onChange(listener: (update: Update) => void): () => void
  }
  viewport: {
    onRequest(listener: (request: ViewportRequest) => void): () => void
    respond(response: ViewportResponse): void
  }
}

export const CHANNEL = {
  projectsList: "projects:list",
  projectsAdd: "projects:add",
  projectsOpen: "projects:open",
  projectsCreate: "projects:create",
  projectsExample: "projects:example",
  projectsExampleProgress: "projects:example-progress",
  projectsRemove: "projects:remove",
  projectsRename: "projects:rename",
  projectsReveal: "projects:reveal",
  projectsChanged: "projects:changed",
  modelRead: "model:read",
  modelSaveCopy: "model:save-copy",
  modelSaveCopies: "model:save-copies",
  modelSaveArchive: "model:save-archive",
  modelSaveDrawing: "model:save-drawing",
  modelSaveDrawings: "model:save-drawings",
  modelNameGroup: "model:name-group",
  referenceScenes: "reference:scenes",
  toolsRead: "tools:read",
  assemblyRead: "assembly:read",
  assemblyMake: "assembly:make",
  assemblyOpen: "assembly:open",
  assemblySave: "assembly:save",
  assemblyRemove: "assembly:remove",
  picturesAdd: "pictures:add",
  picturesDrop: "pictures:drop",
  threadItems: "thread:items",
  threadSend: "thread:send",
  threadLookOver: "thread:look-over",
  threadStop: "thread:stop",
  threadSendNow: "thread:send-now",
  threadUnqueue: "thread:unqueue",
  threadRename: "thread:rename",
  threadAnswer: "thread:answer",
  threadTell: "thread:tell",
  threadItem: "thread:item",
  changesUndo: "changes:undo",
  changesRedo: "changes:redo",
  versionsShow: "versions:show",
  versionsTurned: "versions:turned",
  versionsBegun: "versions:begun",
  providersList: "providers:list",
  providersChange: "providers:change",
  providersCheck: "providers:check",
  providersUpdate: "providers:update",
  providersChanged: "providers:changed",
  claudeCommands: "claude:commands",
  settingsGet: "settings:get",
  settingsChooseProjectsFolder: "settings:choose-projects-folder",
  settingsRevealProjectsFolder: "settings:reveal-projects-folder",
  settingsProjectsFolderSize: "settings:projects-folder-size",
  settingsSetLookOver: "settings:set-look-over",
  settingsSetAnalytics: "settings:set-analytics",
  settingsSetVersions: "settings:set-versions",
  analyticsUsed: "analytics:used",
  updateGet: "update:get",
  updateDownload: "update:download",
  updateRestart: "update:restart",
  updateChanged: "update:changed",
  viewportRequest: "viewport:request",
  viewportResponse: "viewport:response",
} as const

/**
 * The scheme the window loads model files through: cad-model://<project id>/<file>.
 * The files of a reference scene come the same way, from a host that says whose it is:
 * <project id>.reference for a project's own, and <name>.scene for one of the app's.
 * And so do the pictures put with a project's messages: <project id>.picture.
 */
export const MODEL_SCHEME = "cad-model"
export const SCENE_HOST = { own: "reference", app: "scene" } as const
export const PICTURE_HOST = "picture"
