// The app's own process: the window, the list of projects, and the line to the agents.
import fs from "node:fs"
import path from "node:path"

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  safeStorage,
  shell,
} from "electron"
import electronUpdater from "electron-updater"

import {
  ACCESSES,
  CHANNEL,
  EFFORTS,
  FEATURES,
  MODEL_SCHEME,
  PICTURE_HOST,
  OWN_SCENE,
  PROVIDERS,
  SCENE_HOST,
  type GroupAsked,
  type GuideSummary,
  type Looks,
  type Manner,
  type Commands,
  type ModelSource,
  type ObjectRef,
  type PartNote,
  type PermissionAnswer,
  type Project,
  type ReferenceSource,
  type Seen,
  type Settings,
  type ToolSource,
  type Undone,
  type Update,
  type Vec3,
  type ViewportAsked,
  type ViewportRequest,
  type ViewportResponse,
} from "../shared/api"
import { archiveOf, EXAMPLES, EXAMPLES_URL } from "../shared/examples"
import { PICTURE_TYPES } from "../shared/pictures"
import { Analytics, POSTHOG } from "./analytics"
import { unpack, type Filed } from "./archive"
import { fileGuide, guideOf, guidesIn } from "./assembly"
import { Changes } from "./changes"
import { Versions } from "./versions"
import { zipOf } from "./zip"
import { followRename, listCommands, lookAtClaude } from "./claude"
import { lookAtCodex } from "./codex"
import { readTools } from "./custom-tools"
import { lookAtGrok } from "./grok"
import {
  arrange,
  bringIn,
  broughtIn,
  CAD_ENDINGS,
  modelScript,
  runBuild,
  SCRIPT,
  sortOpened,
} from "./imports"
import { fetched, startFrom } from "./examples"
import { archived, archiveName, GuideServer } from "./guide-page"
import { standInName } from "./names"
import { groupNameOf } from "./naming"
import { Pictures } from "./pictures"
import {
  folderName,
  folderSize,
  makeFolder,
  Projects,
  resolveInside,
} from "./projects"
import { appScenes, readScene } from "./reference"
import { cleanEnv, expandHome, Providers } from "./providers"
import { SettingsStore, type Vault } from "./settings"
import { Threads, type Arranging, type Referenced } from "./threads"
import { ToolServer } from "./tools"
import { Updates } from "./update"

const HERE = import.meta.dirname
const DEV_URL = process.env.VITE_DEV_SERVER_URL
// the app's icon, in the sizes each system asks for (scripts/icons.mjs makes them)
const ICONS = path.join(HERE, "../icons")

// For checking the app without clicking through it:
//   ENCLOSE_USER_DATA=<dir>  keep state, and new projects, somewhere other than the real ones
//   --capture=<file.png>     load (window hidden), save a picture of it, quit
//   --script=<file.js>       run this in the window first; it may return a promise
//   --wait=<ms>              how long to let the window settle before each step
//   <folder or CAD file>     open it as a project, as if it were dropped on the window
//   ENCLOSE_EXAMPLES_URL=<url>  fetch the examples from there (it ends in a slash), even
//                            when the app has them beside it
//   ENCLOSE_UPDATES_URL=<url>  look there for the app's newer versions, where what `npm
//                            run dist` wrote to release/ is served, and not among its
//                            releases (the packaged app only: no other looks for any)
//   ENCLOSE_ANALYTICS_KEY=<key>  send the count of how the app is used to that PostHog
//                            project: run from a checkout it is sent nowhere otherwise
const flag = (name: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? null
const CAPTURE = flag("capture")
const EXAMPLES_FROM = process.env.ENCLOSE_EXAMPLES_URL || null
const UPDATES_FROM = process.env.ENCLOSE_UPDATES_URL || null
const ANALYTICS_KEY = process.env.ENCLOSE_ANALYTICS_KEY || null
/** what the systems the app runs on are called, where the count of its use says which */
const SYSTEMS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux",
}

// The package's name for the app says how far along it is ("Enclose (Alpha)"), and that
// is what a Mac shows the app as. What the app keeps is filed under its name alone, as it
// was before the app said so: its state, in Application Support, and the key a Mac's
// keychain holds for what the settings seal. So the app goes by that name here, from
// before either is looked for, and neither is lost when what it is shown as changes.
// Run from a checkout it is shown as the one being worked on, "Enclose (Dev)", which is
// what the copy of Electron it is run as is called too (scripts/electron-name.mjs).
const SHOWN = app.isPackaged
  ? app.name
  : `${app.name.replace(/\s*\(.*\)$/, "")} (Dev)`
app.setName("Enclose")

const ELSEWHERE = process.env.ENCLOSE_USER_DATA ?? null
if (ELSEWHERE) app.setPath("userData", ELSEWHERE)

protocol.registerSchemesAsPrivileged([
  {
    scheme: MODEL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const MIME: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".step": "model/step",
  ".stp": "model/step",
  // (the pictures put with messages: see shared/pictures.ts)
  ...Object.fromEntries(
    Object.entries(PICTURE_TYPES).map(([type, ending]) => [ending, type])
  ),
}

let win: BrowserWindow | null = null
let projects: Projects
let pictures: Pictures
let threads: Threads
let changes: Changes
let versions: Versions
/** the conversation the window shows of each project, by project */
const showing = new Map<string, string>()
let settings: SettingsStore
/** the agents on this machine: Claude Code, Codex, Grok */
let providers: Providers
/** where the app's own tools answer, for an agent that cannot be handed them */
const toolServer = new ToolServer()
/**
 * Where a project's assembly guides are served as pages, for a browser to open: each
 * from the project's folder and its model as they then are.
 */
const guideServer = new GuideServer(path.join(HERE, "guide"), (id) => {
  const project = projects.get(id)
  return project?.manifest
    ? { root: project.path, manifest: project.manifest }
    : null
})
/** the app's newer versions: none are looked for when it is run from a checkout */
let updates: Updates | null = null
/** the count of how the app is used: none is kept when it is run from a checkout */
let analytics: Analytics | null = null
/**
 * Where the app's kit is, and its examples if it has them. Run from a checkout, that is
 * the top of the repository, two folders up from the app (apps/desktop). Made into a
 * package, the app carries the kit among its resources, as files of their own for Python
 * and an agent to read (scripts/dist.mjs puts it there), and has no examples beside it.
 */
const TOP = app.isPackaged
  ? process.resourcesPath
  : path.join(app.getAppPath(), "../..")
/** where the app keeps the exporter a project copies to write its model */
const KIT = path.join(TOP, "kit", "enclose.py")
/** where the examples are when the app is run from its source: at the top, in examples/ */
const EXAMPLES_HERE = path.join(TOP, "examples")
/** the reference scenes the app has of its own, for a model to be seen in */
const SCENES = appScenes(path.join(TOP, "kit", "scenes"))

/**
 * The folder a file asked for is in, by the host it is asked of: a project's model, the
 * reference scene the project has of its own, one of the app's, or the pictures put
 * with the project's messages.
 */
function servedFrom(host: string): string | null {
  const [name, kind] = host.split(".")
  if (kind === SCENE_HOST.app)
    return SCENES.find((scene) => scene.id === name)?.dir ?? null
  const project = projects.get(name)
  if (kind === PICTURE_HOST) return project ? pictures.folder(project.id) : null
  const manifest =
    kind === SCENE_HOST.own ? project?.reference : project?.manifest
  return manifest ? path.dirname(manifest) : null
}

/** The reference scene a message is about, from what the window knows it by. */
function referencedBy(projectId: string, scene: unknown): Referenced | null {
  if (typeof scene !== "string") return null
  if (scene === OWN_SCENE) {
    const own = projects.get(projectId)?.reference
    const name = own && readScene(own)?.name
    return own
      ? { name: typeof name === "string" ? name : "Reference scene", app: null }
      : null
  }
  const found = SCENES.find((one) => one.id === scene)
  return found ? { name: found.name, app: found.id } : null
}

const list = (): Project[] =>
  projects
    .list((id) => threads.summaries(id))
    .map((project): Project =>
      threads.lookingOver(project.id)
        ? { ...project, lookOver: "underway" }
        : // with no agent to ask, a model waits to be looked over unseen
          project.lookOver && !providers.any()
          ? { ...project, lookOver: null }
          : project
    )
    .map((project): Project => {
      // what Claude last did to its files, and what of that was last taken back
      const { undo, redo } = changes.last(project.id, whose(project.id))
      return {
        ...project,
        assembling: threads.assembling(project.id),
        undo: undo && { what: undo.what, at: undo.at },
        redo: redo && { what: redo.what, at: redo.undoneAt ?? redo.at },
      }
    })

/**
 * Take back what the latest turn did to a project's files, or put back what was last
 * taken back. Not while Claude is at work there, or files are being made a model of.
 * The conversation the turn was in says that it was done, and the view shows the model
 * as it then is.
 */
async function turnBack(id: string, way: "undo" | "redo"): Promise<Undone> {
  const project = projects.get(id)
  if (!project) return { ok: false, why: "nothing", files: [] }
  if (threads.working(id) || builds.has(id) || versions.busy(id))
    return { ok: false, why: "busy", files: [] }
  // the manifest goes last: its being written is what the view loads the rest again for
  const manifest =
    project.manifest && path.relative(project.path, project.manifest)
  const outcome = await changes[way](id, project.path, manifest, whose(id))
  if (!outcome.ok) return outcome
  const { change } = outcome
  threads.noted(
    id,
    change.conversationId,
    way === "undo"
      ? `Undid “${change.what}”: the project’s files are as they were before it.`
      : `Redid “${change.what}”: the project’s files are as it left them.`
  )
  // the model may be somewhere else now, or nowhere; and if its manifest was not one of
  // the files, nothing has said that the rest of them changed
  projects.refresh(id)
  if (!change.files.some((file) => file.path === manifest)) projects.changed(id)
  broadcast()
  analytics?.record("change turned back", { way })
  return { ok: true, what: change.what }
}
const send = (channel: string, ...args: unknown[]) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}
const broadcast = () => send(CHANNEL.projectsChanged, list())

// --- a project as each of its conversations has it ------------------------------------

/**
 * The conversation a project's folder is as only it has it, where each has the project
 * its own way: what can be taken back there is what that conversation's turns did.
 */
const whose = (id: string): string | undefined =>
  settings.get().versions ? (versions.on(id) ?? undefined) : undefined

/**
 * Have a project's folder be one of its conversations': put as that one left it, where
 * each has the project its own way, and the view told to show the model as it then is.
 * Resolves to whether the folder is that conversation's alone.
 */
async function turnTo(id: string, conversationId: string): Promise<boolean> {
  const project = projects.get(id)
  if (!project) return false
  const kept = settings.get().versions
  const turned = await versions.turnTo(id, conversationId, project.path, {
    kept,
    // the manifest goes last: its being written is what the view loads the rest again for
    last: project.manifest && path.relative(project.path, project.manifest),
  })
  if (!turned || !kept || !projects.get(id)) return kept
  // what was done to the model by hand goes the way its files went
  send(CHANNEL.versionsTurned, id, turned)
  if (turned.restored) {
    // the model may be somewhere else now, or nowhere; and nothing has said that its
    // files changed, if its manifest is the same in both
    projects.refresh(id)
    projects.changed(id)
  } else broadcast()
  return kept
}

/**
 * Have each project's folder be the conversation's that the window shows of it, where
 * it is not already: but not while Claude is at work there, or files are being made a
 * model of. It is seen to when that is over.
 */
function follow() {
  for (const [id, conversationId] of showing) {
    if (versions.on(id) === conversationId) continue
    if (threads.working(id) || builds.has(id)) continue
    if (!threads.summaries(id).some((one) => one.id === conversationId)) {
      showing.delete(id)
      continue
    }
    void turnTo(id, conversationId).catch(() => {})
  }
}

// --- questions to the window about its viewport ---------------------------------------

let requests = 0
const waiting = new Map<
  number,
  {
    resolve: (data: unknown) => void
    reject: (error: Error) => void
    timer: NodeJS.Timeout
  }
>()

function askViewport(
  projectId: string,
  asked: ViewportAsked
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!win || win.isDestroyed())
      return reject(new Error("The app window is closed."))
    // A tool just written may not have been noticed yet: the window is told of the
    // project's tools as they now are before it is asked about them.
    if (asked.kind === "tools" || asked.kind === "tool") {
      projects.refresh(projectId)
      broadcast()
    }
    const id = ++requests
    const timer = setTimeout(() => {
      waiting.delete(id)
      reject(new Error("The viewport did not answer."))
    }, 15_000)
    waiting.set(id, { resolve, reject, timer })
    const request: ViewportRequest = { id, projectId, ...asked }
    win.webContents.send(CHANNEL.viewportRequest, request)
  })
}

// --- the window -----------------------------------------------------------------------

function createWindow(openProject: string | null) {
  win = new BrowserWindow({
    width: 1512,
    height: 982,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: "#171717",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    // what a taskbar shows for the window; a Mac shows the app's own icon, in its Dock
    icon: path.join(
      ICONS,
      process.platform === "win32" ? "icon.ico" : "icon-512.png"
    ),
    webPreferences: {
      preload: path.join(HERE, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // a hidden window still has to draw for --capture
      backgroundThrottling: !CAPTURE,
    },
  })
  const window = win
  if (!CAPTURE) window.once("ready-to-show", () => window.show())
  window.on("closed", () => {
    if (win === window) win = null
  })
  window.on("focus", () => {
    // branches get switched and models rebuilt while the app is in the background
    projects.refreshAll()
    broadcast()
  })

  // links in Claude's answers open in the browser; the window itself never navigates away
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: "deny" }
  })
  window.webContents.on("will-navigate", (event, url) => {
    if (url === window.webContents.getURL()) return
    event.preventDefault()
    if (/^https?:/.test(url)) void shell.openExternal(url)
  })

  const hash = openProject ? `#project=${openProject}` : ""
  if (DEV_URL) void window.loadURL(DEV_URL + hash)
  else
    void window.loadFile(path.join(HERE, "../dist/index.html"), {
      hash: hash.slice(1),
    })

  if (CAPTURE) void capture(window, CAPTURE)
}

async function capture(window: BrowserWindow, file: string) {
  const wait = Number(flag("wait") ?? 2000)
  const settle = () => new Promise((resolve) => setTimeout(resolve, wait))
  try {
    await new Promise<void>((resolve) =>
      window.webContents.once("did-finish-load", () => resolve())
    )
    await settle()
    const script = flag("script")
    if (script) {
      const result: unknown = await window.webContents.executeJavaScript(
        fs.readFileSync(script, "utf8"),
        true
      )
      console.log(`[script] ${JSON.stringify(result)}`)
      await settle()
    }
    fs.writeFileSync(file, (await window.webContents.capturePage()).toPNG())
  } catch (error) {
    console.error("[capture]", error)
    process.exitCode = 1
  }
  app.quit()
}

/**
 * Make the folder for a new project, where new projects go, and say what the project is
 * called for now: a stand-in, until what is made in it gives it a name. The folder is
 * named to match (see `folderName`), numbered if the same name comes up twice in a
 * minute.
 */
function newFolder(): { dir: string; name: string } {
  const name = standInName()
  const base = folderName(name, new Date())
  return { dir: makeFolder(settings.get().projectsFolder, base), name }
}

// --- opening what was made elsewhere --------------------------------------------------

/** what stops the build of each project whose files are being made a model of */
const builds = new Map<string, () => void>()

/** Make a model of the files brought into a project, and say in the list how it goes. */
function makeModel(id: string) {
  const project = projects.get(id)
  const command = project?.build
  if (!project || !command) return
  projects.report(id, { state: "working", done: 0, total: null })
  // Python is found on the PATH a terminal would have, which a Mac gives an app no part
  // of: looking for the agents is what takes that PATH up
  void providers.found.then(() => {
    // taken off the list while that was waited for
    if (!projects.get(id)) return
    const build = runBuild(project.path, command, cleanEnv(), (done, total) =>
      projects.report(id, { state: "working", done, total })
    )
    builds.set(id, build.stop)
    void build.finished.then((failed) => {
      // stopped, with the project taken off the list: there is nobody to tell
      if (builds.get(id) !== build.stop) return
      builds.delete(id)
      projects.report(id, failed)
      follow()
    })
  })
}

/**
 * Open folders and CAD files, however they were given: picked, dropped on the window, or
 * named on the command line. Returns the project to turn to (the last that came of it),
 * and what was given that could not be opened.
 */
function open(paths: string[]): { id: string | null; refused: string[] } {
  const opened = sortOpened(
    paths.map((given) => path.resolve(given)),
    (dir) => projects.knows(dir)
  )
  let id: string | null = null
  for (const dir of opened.folders) {
    if (!projects.knows(dir))
      analytics?.record("project added", { from: "folder" })
    id = projects.add(dir)
  }
  for (const bundle of opened.bundles) {
    const { projectsFolder, lookOver } = settings.get()
    const { dir, written } = bringIn(bundle, projectsFolder, KIT)
    analytics?.record("project added", {
      from: "files",
      files: bundle.files.length,
    })
    id = projects.add(dir, {
      name: bundle.name,
      reading: true,
      // what is in the files is Claude's to name and group, once there is a model of it
      ...(lookOver ? { lookOver: written } : {}),
    })
    makeModel(id)
  }
  return { id, refused: opened.refused }
}

/** A model's parts as its manifest has them, each with what its group is called. */
function partsOf(manifest: string) {
  const { parts, groups } = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
    parts: { id: string; label?: string; group?: string }[]
    groups?: { id: string; label?: string }[]
  }
  return parts.map((part) => ({
    id: part.id,
    label: part.label ?? part.id,
    group:
      groups?.find((group) => group.id === part.group)?.label ??
      part.group ??
      "Parts",
  }))
}

/** A group to be named, as the window gave it: null if it is nothing that can be. */
function groupFrom(given: unknown): GroupAsked | null {
  const { title, parts, others } = (given ?? {}) as Partial<
    Record<keyof GroupAsked, unknown>
  >
  if (!Array.isArray(parts)) return null
  const named = parts.flatMap(
    (part: Partial<GroupAsked["parts"][number]> | null) =>
      typeof part?.label === "string"
        ? [
            {
              label: part.label,
              from: typeof part.from === "string" ? part.from : null,
            },
          ]
        : []
  )
  if (named.length === 0) return null
  return {
    title: typeof title === "string" ? title : null,
    parts: named,
    others: (Array.isArray(others) ? others : []).filter(
      (other): other is string => typeof other === "string"
    ),
  }
}

/** What the window gave of a model to be looked over, as far as it is what it should be. */
function seenFrom(given: unknown): Seen {
  const { pictures, parts } = (given ?? {}) as Partial<
    Record<keyof Seen, unknown>
  >
  const three = (v: unknown): Vec3 =>
    Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n))
      ? (v as Vec3)
      : [0, 0, 0]
  return {
    pictures: (Array.isArray(pictures) ? pictures : []).flatMap(
      (picture: Partial<Seen["pictures"][number]> | null) =>
        typeof picture?.data === "string" &&
        typeof picture.mimeType === "string"
          ? [
              {
                caption: String(picture.caption ?? ""),
                data: picture.data,
                mimeType: picture.mimeType,
              },
            ]
          : []
    ),
    parts: (Array.isArray(parts) ? parts : []).flatMap(
      (part: Partial<Seen["parts"][number]> | null) =>
        typeof part?.id === "string"
          ? [
              {
                id: part.id,
                label: String(part.label ?? part.id),
                group: String(part.group ?? ""),
                size: three(part.size),
                middle: three(part.middle),
                color: typeof part.color === "string" ? part.color : null,
              },
            ]
          : []
    ),
  }
}

/**
 * Have Claude look over the model of files just opened, from what the window shows of
 * it. What it makes of the parts is written into the project's model.py, which until
 * then is as the app wrote it, and the model is built again. Returns the conversation
 * that is had in, or null if the project is not waiting for this.
 */
function lookOver(id: string, seen: Seen, manner: Manner): string | null {
  const project = projects.get(id)
  const written = project?.lookOver
  // (with nothing to ask of the agent it is to be asked of, it waits until there is)
  if (!project || !written || !providers.launch(manner.provider)) return null
  try {
    const { build, manifest } = project
    if (!manifest || !build) return null
    const script = path.join(project.path, SCRIPT)
    // the parts as the files gave them: what Claude names them by, however often
    const read = partsOf(manifest)
    // the script as the app last wrote it: nothing but that is written over
    let ours = modelScript(written.title, written.files)
    const arranging: Arranging = async (given, signal) => {
      const arranged = arrange(
        read,
        given,
        SCENES.map((scene) => scene.id)
      )
      if (fs.readFileSync(script, "utf8") !== ours)
        throw new Error(
          `The project's ${SCRIPT} has been changed since the files were opened, so it is not written over. Tell the user the names and groups you would give the parts, and that they can ask you to put them in.`
        )
      const next = modelScript(written.title, written.files, arranged)
      fs.writeFileSync(script, next)
      const building = runBuild(project.path, build, cleanEnv(), () => {})
      signal.addEventListener("abort", building.stop, { once: true })
      const failed = await building.finished
      signal.removeEventListener("abort", building.stop)
      if (failed || signal.aborted) {
        // back as it was: the model on screen is still the one that script builds
        fs.writeFileSync(script, ours)
        throw new Error(
          failed?.state === "failed" && !signal.aborted
            ? `The model would not build with these names: ${failed.detail}`
            : "Stopped."
        )
      }
      ours = next
      projects.refresh(id)
      broadcast()
      return `Done: ${arranged.parts.length} parts in ${arranged.groups.length} groups (${arranged.groups.map((group) => group.label).join(", ")}). The view shows the model so.`
    }
    const into = threads.lookOver(id, seen, written.files, manner, arranging)
    if (into) analytics?.record("model looked over", mannerSaid(manner))
    return into
  } catch (error) {
    // a manifest that cannot be read: there is nothing to go by
    console.error("[look over]", error)
    return null
  } finally {
    // asked once, whatever came of it: from here on the model is put in order by
    // asking. (Said last, so that the project goes from waiting to being looked over
    // with nothing in between.)
    projects.lookedOver(id)
  }
}

/**
 * How the view draws a project's parts, as the window gave it: what of that reads as a
 * colour by name.
 */
function looksFrom(given: unknown): Looks {
  const colours = (given as Partial<Looks> | null)?.colours
  return {
    colours: Object.fromEntries(
      Object.entries(
        colours && typeof colours === "object"
          ? (colours as Record<string, unknown>)
          : {}
      ).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && /^[a-z]{1,20}$/.test(entry[1])
      )
    ),
  }
}

/** A project's guide, by what it is known by, with its model's manifest: null if there is neither. */
function guideFor(id: unknown, guideId: unknown) {
  const project = projects.get(String(id))
  if (!project?.manifest) return null
  const guide = guideOf(project.path, String(guideId))
  if (!guide) return null
  return { project, guide, manifest: project.manifest }
}

/** The whole objects a message calls on, as the window gave them: those that read as one. */
const objectsFrom = (given: unknown): ObjectRef[] =>
  (Array.isArray(given) ? given : []).flatMap(
    (one: Partial<ObjectRef> | null) =>
      typeof one?.label === "string" && Array.isArray(one.parts)
        ? [
            {
              label: one.label,
              parts: one.parts.filter((id) => typeof id === "string"),
            },
          ]
        : []
  )

const mannerFrom = (manner: Partial<Manner> | null): Manner => ({
  provider: PROVIDERS.find((one) => one === manner?.provider) ?? "claude",
  model: typeof manner?.model === "string" ? manner.model : null,
  effort: EFFORTS.find((effort) => effort === manner?.effort) ?? null,
  // what cannot be made out is not taken for leave to do anything
  access: ACCESSES.find((access) => access === manner?.access) ?? "edits",
})

/**
 * How a message is to be answered, as the app's count of its use has it. A model the
 * user wrote in themselves is called whatever they called it, which is theirs: it is
 * counted as one of those, and not by name.
 */
const mannerSaid = ({ provider, model, effort, access }: Manner) => ({
  provider,
  model:
    model === null
      ? "default"
      : settings.provider(provider).custom.includes(model)
        ? "custom"
        : model,
  effort: effort ?? "default",
  access,
})

/** The same, for the window: it is told when nothing came of what it gave. */
async function openFor(paths: string[]): Promise<Project | null> {
  let id: string | null = null
  let trouble: string | null = null
  try {
    const { id: last, refused } = open(paths)
    id = last
    if (!id && refused.length > 0)
      trouble = `Enclose opens folders, and CAD files in STEP format (${CAD_ENDINGS.join(", ")}). ${
        refused.length === 1
          ? `“${path.basename(refused[0])}” is neither.`
          : "What was given is neither."
      }`
  } catch (error) {
    trouble = `The files could not be copied into a new project: ${
      error instanceof Error ? error.message : String(error)
    }`
  }
  if (trouble && win && !CAPTURE)
    await dialog.showMessageBox(win, {
      type: "info",
      message: "Nothing was opened",
      detail: trouble,
    })
  return list().find((p) => p.id === id) ?? null
}

// --- wiring ---------------------------------------------------------------------------

function wire() {
  protocol.handle(MODEL_SCHEME, async (request) => {
    const url = new URL(request.url)
    const from = servedFrom(url.hostname)
    const file = from && resolveInside(from, decodeURIComponent(url.pathname))
    if (!file) return new Response(null, { status: 404 })
    try {
      const data = await fs.promises.readFile(file)
      return new Response(new Uint8Array(data), {
        headers: {
          "content-type":
            MIME[path.extname(file).toLowerCase()] ??
            "application/octet-stream",
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        },
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  ipcMain.handle(CHANNEL.projectsList, () => list())
  ipcMain.handle(CHANNEL.projectsAdd, async (_, kind: unknown) => {
    if (!win) return null
    // A Mac's picker takes files and folders alike. No other system's does: there it
    // is asked for the one kind or the other.
    const picked = await dialog.showOpenDialog(win, {
      title:
        kind === "file"
          ? "Open a file"
          : kind === "folder"
            ? "Open a folder"
            : "Open a file or folder",
      buttonLabel: "Open",
      filters:
        kind === "folder"
          ? []
          : [
              {
                name: "CAD files",
                extensions: CAD_ENDINGS.map((ending) => ending.slice(1)),
              },
            ],
      properties:
        kind === "file"
          ? ["openFile", "multiSelections"]
          : kind === "folder"
            ? ["openDirectory", "createDirectory"]
            : [
                "openFile",
                "openDirectory",
                "multiSelections",
                "createDirectory",
              ],
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    return openFor(picked.filePaths)
  })
  ipcMain.handle(CHANNEL.projectsOpen, (_, paths: unknown) =>
    openFor(Array.isArray(paths) ? paths.map(String) : [])
  )
  ipcMain.handle(CHANNEL.projectsCreate, () => {
    const made = newFolder()
    const id = projects.add(made.dir, { name: made.name, standIn: true })
    analytics?.record("project added", { from: "new" })
    return list().find((p) => p.id === id) ?? null
  })
  ipcMain.handle(CHANNEL.projectsExample, async (_, wanted: unknown) => {
    const example = EXAMPLES.find((one) => one.id === wanted)
    if (!example) return null
    let id: string | null = null
    let fetching = false
    try {
      // the app's own copy if it has one, unless it is told where to fetch them
      let from: string | Filed[] = path.join(EXAMPLES_HERE, example.id)
      if (EXAMPLES_FROM || !fs.existsSync(from)) {
        fetching = true
        from = await unpack(
          await fetched(
            (EXAMPLES_FROM ?? EXAMPLES_URL) + archiveOf(example),
            example,
            (received) =>
              send(CHANNEL.projectsExampleProgress, example.id, received),
            (url, init) => net.fetch(String(url), init)
          )
        )
        fetching = false
      }
      const { projectsFolder } = settings.get()
      const dir = startFrom(from, example.name, projectsFolder, KIT)
      id = projects.add(dir, { name: example.name })
      analytics?.record("project added", {
        from: "example",
        example: example.id,
      })
      // an example that comes without its model built has it made now
      if (!projects.get(id)?.manifest) makeModel(id)
    } catch (error) {
      console.error("[example]", error)
      if (win && !CAPTURE)
        await dialog.showMessageBox(win, {
          type: "info",
          message: fetching
            ? "The example could not be downloaded"
            : "The example could not be opened",
          detail: fetching
            ? "Check your connection and try again."
            : error instanceof Error
              ? error.message
              : String(error),
        })
    }
    return list().find((p) => p.id === id) ?? null
  })
  ipcMain.handle(CHANNEL.projectsRemove, async (_, id: string) => {
    const project = projects.get(String(id))
    if (!project) return
    // What has been said about it goes with it, and cannot be had back: that is asked
    // about first. (A run with nobody at it has nobody to ask.)
    const said = threads.count(project.id)
    if (said > 0 && win && !CAPTURE) {
      const name = project.name ?? path.basename(project.path)
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        message: `Remove “${name}” from Enclose?`,
        detail: `${
          said === 1 ? "Its conversation" : `Its ${said} conversations`
        } will be forgotten. The folder stays where it is, with everything in it.`,
        buttons: ["Remove", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      })
      if (response !== 0) return
    }
    threads.forget(project.id)
    changes.forget(project.id)
    showing.delete(project.id)
    versions.forget(project.id)
    pictures.forget(project.id)
    // a model still being made of its files is given up on
    builds.get(project.id)?.()
    builds.delete(project.id)
    projects.remove(project.id)
    analytics?.record("project removed")
  })
  ipcMain.handle(CHANNEL.projectsReveal, (_, id: string) => {
    const project = projects.get(id)
    if (project) void shell.openPath(project.path)
  })

  ipcMain.handle(CHANNEL.modelRead, (_, id: string): ModelSource | null => {
    const manifest = projects.get(id)?.manifest
    if (!manifest) return null
    return {
      manifest: JSON.parse(fs.readFileSync(manifest, "utf8")),
      baseUrl: `${MODEL_SCHEME}://${id}/`,
    }
  })
  ipcMain.handle(
    CHANNEL.modelSaveCopy,
    async (_, id: string, file: string, name: string) => {
      const manifest = projects.get(id)?.manifest
      const source =
        manifest && resolveInside(path.dirname(manifest), String(file))
      if (!win || !source || !fs.existsSync(source)) return false
      const picked = await dialog.showSaveDialog(win, {
        defaultPath: path.join(
          app.getPath("downloads"),
          path.basename(String(name))
        ),
      })
      if (picked.canceled || !picked.filePath) return false
      await fs.promises.copyFile(source, picked.filePath)
      analytics?.record("model saved", { as: "files", files: 1 })
      return true
    }
  )
  ipcMain.handle(
    CHANNEL.modelNameGroup,
    async (_, id: string, asked: unknown): Promise<string | null> => {
      if (!projects.get(String(id))) return null
      const group = groupFrom(asked)
      if (!group) return null
      // it is the quickest of Claude Code's models that is asked
      await providers.found
      return groupNameOf(providers.launch("claude"), group)
    }
  )
  ipcMain.handle(
    CHANNEL.referenceScenes,
    (_, id: string): ReferenceSource[] => {
      const project = projects.get(String(id))
      const own = project?.reference ? readScene(project.reference) : null
      return [
        ...(project && own
          ? [
              {
                id: OWN_SCENE,
                own: true,
                manifest: own,
                baseUrl: `${MODEL_SCHEME}://${project.id}.${SCENE_HOST.own}/`,
              },
            ]
          : []),
        ...SCENES.map((scene) => ({
          id: scene.id,
          own: false,
          manifest: scene.manifest,
          baseUrl: `${MODEL_SCHEME}://${scene.id}.${SCENE_HOST.app}/`,
        })),
      ]
    }
  )
  ipcMain.handle(CHANNEL.toolsRead, (_, id: string): ToolSource[] => {
    const project = projects.get(String(id))
    return project ? readTools(project.path) : []
  })
  ipcMain.handle(CHANNEL.assemblyRead, (_, id: string): GuideSummary[] => {
    const project = projects.get(String(id))
    return project ? guidesIn(project.path) : []
  })
  ipcMain.handle(
    CHANNEL.assemblyMake,
    (
      _,
      id: string,
      conversationId: string | null,
      of: unknown,
      given: Partial<Manner> | null
    ) => {
      const project = projects.get(String(id))
      // (there is nothing to write a guide to until there is a model)
      if (!project?.manifest) return null
      const manner = mannerFrom(given)
      const [thing] = objectsFrom(of ? [of] : [])
      const into = threads.assemble(
        project.id,
        conversationId === null ? null : String(conversationId),
        thing && thing.parts.length > 0 ? thing : null,
        manner
      )
      // the user has started on the project themselves, as by sending a message
      if (into) projects.lookedOver(project.id)
      if (into)
        analytics?.record("assembly guide asked for", {
          ...mannerSaid(manner),
          whole: thing === undefined,
        })
      return into
    }
  )
  ipcMain.handle(
    CHANNEL.assemblyOpen,
    async (_, id: string, guideId: string, looks: unknown) => {
      if (!guideFor(id, guideId)) return false
      const address = await guideServer.address(
        String(id),
        String(guideId),
        looksFrom(looks)
      )
      // (a run with nobody at it has no browser to open one in: it says where it is)
      if (CAPTURE) console.log(`[guide] ${address}`)
      else await shell.openExternal(address)
      analytics?.record("assembly guide opened")
      return true
    }
  )
  ipcMain.handle(
    CHANNEL.assemblySave,
    async (_, id: string, guideId: string, looks: unknown) => {
      const found = guideFor(id, guideId)
      if (!win || !found) return false
      const { guide, manifest } = found
      const picked = await dialog.showSaveDialog(win, {
        defaultPath: path.join(
          app.getPath("downloads"),
          `${archiveName(guide)}.zip`
        ),
        filters: [{ name: "Zip archive", extensions: ["zip"] }],
      })
      if (picked.canceled || !picked.filePath) return false
      // The parts are read from where the model's build left them, and go nowhere but
      // into the archive: nothing of a guide is copied until it is taken away.
      const files = await archived(
        guide,
        JSON.parse(await fs.promises.readFile(manifest, "utf8")),
        path.dirname(manifest),
        looksFrom(looks),
        path.join(HERE, "guide")
      )
      await fs.promises.writeFile(picked.filePath, zipOf(files))
      // shown where it is: it is something to send on, or to open
      shell.showItemInFolder(picked.filePath)
      analytics?.record("assembly guide saved", { steps: guide.steps.length })
      return true
    }
  )
  ipcMain.handle(
    CHANNEL.modelSaveCopies,
    async (_, id: string, files: unknown, folder: string) => {
      const manifest = projects.get(id)?.manifest
      if (!win || !manifest || !Array.isArray(files)) return false
      const from = path.dirname(manifest)
      const wanted = (files as { file?: unknown; name?: unknown }[]).flatMap(
        (entry) => {
          const source = resolveInside(from, String(entry?.file))
          return source && fs.existsSync(source)
            ? [{ source, name: path.basename(String(entry?.name)) }]
            : []
        }
      )
      if (wanted.length === 0) return false
      // a name a folder can have, whatever the group is called
      const called =
        String(folder)
          .replace(/[\\/:]+/g, "-")
          .replace(/^\.+/, "")
          .trim() || "parts"
      const picked = await dialog.showOpenDialog(win, {
        message: `Choose where the folder "${called}" goes, with its ${wanted.length} STEP files`,
        buttonLabel: "Save here",
        defaultPath: app.getPath("downloads"),
        properties: ["openDirectory", "createDirectory"],
      })
      if (picked.canceled || !picked.filePaths[0]) return false
      // a folder of its own, numbered where the name is taken: nothing is written over
      const into = makeFolder(picked.filePaths[0], called)
      for (const { source, name } of wanted)
        await fs.promises.copyFile(source, path.join(into, name))
      analytics?.record("model saved", { as: "files", files: wanted.length })
      return true
    }
  )
  ipcMain.handle(
    CHANNEL.modelSaveArchive,
    async (_, id: string, files: unknown, name: unknown) => {
      const manifest = projects.get(id)?.manifest
      if (!win || !manifest || !Array.isArray(files)) return false
      const from = path.dirname(manifest)
      const wanted = (files as { file?: unknown; name?: unknown }[]).flatMap(
        (entry) => {
          const source = resolveInside(from, String(entry?.file))
          return source && fs.existsSync(source)
            ? [{ source, name: path.basename(String(entry?.name)) }]
            : []
        }
      )
      if (wanted.length === 0) return false
      const picked = await dialog.showSaveDialog(win, {
        defaultPath: path.join(
          app.getPath("downloads"),
          path.basename(String(name))
        ),
      })
      if (picked.canceled || !picked.filePath) return false
      const archive = zipOf(
        await Promise.all(
          wanted.map(async ({ source, name }) => ({
            name,
            data: await fs.promises.readFile(source),
          }))
        )
      )
      await fs.promises.writeFile(picked.filePath, archive)
      analytics?.record("model saved", { as: "files", files: wanted.length })
      return true
    }
  )
  ipcMain.handle(
    CHANNEL.modelSaveDrawing,
    async (_, name: unknown, svg: unknown) => {
      if (!win || typeof svg !== "string") return false
      const picked = await dialog.showSaveDialog(win, {
        defaultPath: path.join(
          app.getPath("downloads"),
          path.basename(String(name))
        ),
        filters: [{ name: "SVG", extensions: ["svg"] }],
      })
      if (picked.canceled || !picked.filePath) return false
      await fs.promises.writeFile(picked.filePath, svg, "utf8")
      analytics?.record("model saved", { as: "drawings", files: 1 })
      return true
    }
  )
  ipcMain.handle(
    CHANNEL.modelSaveDrawings,
    async (_, folder: unknown, drawings: unknown) => {
      if (!win || !Array.isArray(drawings)) return false
      const wanted = (drawings as { name?: unknown; svg?: unknown }[]).flatMap(
        (entry) =>
          typeof entry?.svg === "string"
            ? [{ name: path.basename(String(entry.name)), svg: entry.svg }]
            : []
      )
      if (wanted.length === 0) return false
      // a name a folder can have, whatever the model is called
      const called =
        String(folder)
          .replace(/[\\/:]+/g, "-")
          .replace(/^\.+/, "")
          .trim() || "blueprint"
      const picked = await dialog.showOpenDialog(win, {
        message: `Choose where the folder "${called}" goes, with its ${wanted.length} SVG files`,
        buttonLabel: "Save here",
        defaultPath: app.getPath("downloads"),
        properties: ["openDirectory", "createDirectory"],
      })
      if (picked.canceled || !picked.filePaths[0]) return false
      // a folder of its own, numbered where the name is taken: nothing is written over
      const into = makeFolder(picked.filePaths[0], called)
      for (const { name, svg } of wanted)
        await fs.promises.writeFile(path.join(into, name), svg, "utf8")
      // the folder is opened, to show what was saved and where: it was made inside the
      // one that was picked, which is not where anyone goes looking for it
      void shell.openPath(into)
      analytics?.record("model saved", {
        as: "drawings",
        files: wanted.length,
      })
      return true
    }
  )

  ipcMain.handle(CHANNEL.picturesAdd, (_, id: string, picture: unknown) =>
    projects.get(String(id))
      ? pictures.add(String(id), picture as Parameters<Pictures["add"]>[1])
      : null
  )
  ipcMain.handle(CHANNEL.picturesDrop, (_, id: string, picture: unknown) =>
    pictures.drop(String(id), picture)
  )

  ipcMain.on(
    CHANNEL.versionsShow,
    (_, id: unknown, conversationId: unknown) => {
      if (typeof id !== "string" || typeof conversationId !== "string") return
      if (!projects.get(id)) return
      showing.set(id, conversationId)
      follow()
    }
  )

  ipcMain.handle(CHANNEL.threadItems, (_, id: string, conversationId: string) =>
    threads.items(String(id), String(conversationId))
  )
  ipcMain.handle(
    CHANNEL.threadSend,
    (
      _,
      id: string,
      conversationId: string | null,
      text: string,
      notes: PartNote[] | null,
      objects: ObjectRef[] | null,
      given: Partial<Manner> | null,
      reference: unknown,
      attached: unknown
    ) => {
      const manner = mannerFrom(given)
      const noted = Array.isArray(notes)
        ? notes.filter((note) => note?.part?.id)
        : []
      const called = objectsFrom(objects)
      const about = referencedBy(String(id), reference)
      const shown = pictures.read(String(id), attached)
      // answers at once, with the conversation it went into: the turn runs for as long
      // as it runs, and reports through thread items
      const into = threads.send(
        String(id),
        conversationId === null ? null : String(conversationId),
        String(text),
        noted,
        called,
        manner,
        about,
        shown
      )
      // the user has started on the project themselves: its model is theirs to have
      // put in order, by asking
      if (into) projects.lookedOver(String(id))
      // (how it was put, and how much went with it: nothing of what it says)
      if (into)
        analytics?.record("message sent", {
          ...mannerSaid(manner),
          fresh: conversationId === null,
          notes: noted.length,
          objects: called.length,
          pictures: shown.length,
          reference: about !== null,
        })
      return into
    }
  )
  ipcMain.handle(
    CHANNEL.threadLookOver,
    (_, id: string, seen: unknown, manner: Partial<Manner> | null) =>
      lookOver(String(id), seenFrom(seen), mannerFrom(manner))
  )
  ipcMain.handle(CHANNEL.threadStop, (_, id: string) => threads.stop(id))
  ipcMain.handle(CHANNEL.threadSendNow, (_, id: string, queued: string) =>
    threads.sendNow(String(id), String(queued))
  )
  ipcMain.handle(CHANNEL.threadUnqueue, (_, id: string, queued: string) => {
    // the pictures that were to go with it are no conversation's: they are not kept
    for (const picture of threads.unqueue(String(id), String(queued)))
      pictures.drop(String(id), picture.id)
  })
  ipcMain.handle(CHANNEL.changesUndo, (_, id: string) =>
    turnBack(String(id), "undo")
  )
  ipcMain.handle(CHANNEL.changesRedo, (_, id: string) =>
    turnBack(String(id), "redo")
  )
  ipcMain.handle(
    CHANNEL.threadRename,
    (_, id: string, conversationId: string, name: string) =>
      threads.rename(String(id), String(conversationId), String(name))
  )
  ipcMain.handle(
    CHANNEL.threadAnswer,
    (_, id: string, permissionId: string, answer: PermissionAnswer) =>
      threads.answer(id, permissionId, answer)
  )
  ipcMain.handle(
    CHANNEL.threadTell,
    (_, id: string, questionId: string, answers: unknown) =>
      threads.tell(
        String(id),
        String(questionId),
        Array.isArray(answers)
          ? answers.map((answer) => (typeof answer === "string" ? answer : ""))
          : null
      )
  )

  ipcMain.handle(CHANNEL.providersList, () => providers.list())
  ipcMain.handle(CHANNEL.providersChange, (_, id: unknown, patch: unknown) => {
    const which = PROVIDERS.find((one) => one === id)
    // answers at once, with what was chosen: what comes of looking at the agent again,
    // where that is called for, the window hears of as it is found out
    if (which) void providers.change(which, patch)
    const on = (patch as { enabled?: unknown } | null)?.enabled
    if (which && typeof on === "boolean")
      analytics?.record("provider switched", { provider: which, on })
    return providers.list()
  })
  ipcMain.handle(CHANNEL.providersCheck, async () => {
    await providers.check()
    return providers.list()
  })
  // What Claude Code can be called on for is asked afresh each time: it changes with the
  // folder, and with what the user installs. One asking at a time for a project.
  const commands = new Map<string, Promise<Commands>>()
  ipcMain.handle(CHANNEL.claudeCommands, (_, id: string): Promise<Commands> => {
    const project = projects.get(String(id))
    if (!project) return Promise.resolve({ commands: [], skills: [] })
    let asking = commands.get(project.id)
    if (!asking) {
      asking = providers.found
        .then(() => listCommands(providers.launch("claude"), project.path))
        .finally(() => commands.delete(project.id))
      commands.set(project.id, asking)
    }
    return asking
  })

  ipcMain.handle(CHANNEL.settingsGet, (): Settings => settings.get())
  ipcMain.handle(
    CHANNEL.settingsChooseProjectsFolder,
    async (): Promise<Settings> => {
      if (!win) return settings.get()
      const picked = await dialog.showOpenDialog(win, {
        title: "Where new projects go",
        buttonLabel: "Use this folder",
        defaultPath: settings.get().projectsFolder,
        properties: ["openDirectory", "createDirectory"],
      })
      if (picked.canceled || !picked.filePaths[0]) return settings.get()
      return settings.set({ projectsFolder: picked.filePaths[0] })
    }
  )
  ipcMain.handle(CHANNEL.settingsRevealProjectsFolder, () => {
    const { projectsFolder } = settings.get()
    fs.mkdirSync(projectsFolder, { recursive: true })
    void shell.openPath(projectsFolder)
  })
  ipcMain.handle(CHANNEL.settingsProjectsFolderSize, () =>
    folderSize(settings.get().projectsFolder)
  )
  ipcMain.handle(CHANNEL.settingsSetLookOver, (_, on: unknown): Settings =>
    settings.set({ lookOver: on === true })
  )
  ipcMain.handle(CHANNEL.settingsSetVersions, (_, on: unknown): Settings => {
    const next = settings.set({ versions: on === true })
    // what can be taken back in a project is not the same either way
    broadcast()
    return next
  })
  ipcMain.handle(CHANNEL.settingsSetAnalytics, (_, on: unknown): Settings => {
    const next = settings.set({ analytics: on === true })
    // switched off, what was waiting to be sent is not
    if (!next.analytics) analytics?.forget()
    return next
  })
  // (only what is on the list is counted: the window cannot have anything else sent)
  ipcMain.on(CHANNEL.analyticsUsed, (_, feature: unknown) => {
    const which = FEATURES.find((one) => one === feature)
    if (which) analytics?.used(which)
  })

  ipcMain.handle(
    CHANNEL.updateGet,
    (): Update => updates?.get() ?? { state: "none" }
  )
  ipcMain.handle(CHANNEL.updateDownload, () => {
    const found = updates?.get()
    if (found?.state === "available")
      analytics?.record("update fetched", { to: found.version })
    updates?.download()
  })
  ipcMain.handle(CHANNEL.updateRestart, async () => {
    // Starting again stops whatever is under way, an agent in the middle of a turn
    // with it: that is asked about first.
    const busy = projects
      .list(() => [])
      .filter(({ id }) => threads.working(id) || builds.has(id)).length
    if (busy > 0 && win) {
      const { response } = await dialog.showMessageBox(win, {
        type: "warning",
        message: "Restart Enclose now?",
        detail: `${
          busy === 1 ? "A project is" : `${busy} projects are`
        } still being worked on, and that will be stopped.`,
        buttons: ["Restart", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      })
      if (response !== 0) return
    }
    updates?.restart()
  })

  ipcMain.on(CHANNEL.viewportResponse, (_, response: ViewportResponse) => {
    const request = waiting.get(response.id)
    if (!request) return
    waiting.delete(response.id)
    clearTimeout(request.timer)
    if (response.ok) request.resolve(response.data)
    else request.reject(new Error(response.error))
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(() => {
    // Run from a checkout, the app in the Dock is Electron's own, and so is its icon:
    // it is given the app's mark on another colour, which tells it from the app that is
    // installed. An app made into a package has the icon in it, and macOS draws that one.
    if (!app.isPackaged) app.dock?.setIcon(path.join(ICONS, "icon-dev.png"))
    // What a Mac's About says is Electron's own too, down to the version, twice over.
    // (A version given here is shown just as it is given, so the word goes with it.)
    if (!app.isPackaged && process.platform === "darwin")
      app.setAboutPanelOptions({
        applicationName: SHOWN,
        applicationVersion: `Version ${app.getVersion()}`,
        version: "",
      })

    const data = app.getPath("userData")
    // What is set in an agent's environment is often a key: the system keeps those, where
    // it has somewhere to keep them, and the settings file holds only what it gives back.
    const vault: Vault | null = safeStorage.isEncryptionAvailable()
      ? {
          seal: (text) => safeStorage.encryptString(text).toString("base64"),
          unseal: (sealed) =>
            safeStorage.decryptString(Buffer.from(sealed, "base64")),
        }
      : null
    settings = new SettingsStore(
      path.join(data, "settings.json"),
      {
        // Documents is where a Mac keeps what its user makes; a run that keeps its state
        // elsewhere keeps its projects there too
        projectsFolder: ELSEWHERE
          ? path.join(ELSEWHERE, "Projects")
          : path.join(app.getPath("documents"), "Enclose"),
        lookOver: true,
        analytics: true,
        versions: true,
      },
      vault
    )
    projects = new Projects(path.join(data, "projects.json"), broadcast)
    changes = new Changes(path.join(data, "changes"))
    versions = new Versions(path.join(data, "versions"))
    pictures = new Pictures(path.join(data, "pictures"))
    threads = new Threads({
      dir: path.join(data, "threads"),
      projects,
      changes,
      turnTo,
      launch: (id) => providers.launch(id),
      tools: toolServer,
      kit: KIT,
      scenes: SCENES,
      fileGuide: (id, given, replacing) => {
        const project = projects.get(id)
        if (!project?.manifest)
          throw new Error(
            "This project has no model built yet: there is nothing to write a guide to."
          )
        const filed = fileGuide(
          project.path,
          given,
          partsOf(project.manifest).map((part) => part.id),
          replacing,
          Date.now()
        )
        // its cover is in the view as soon as it is written, and not when the turn ends
        projects.refresh(id)
        broadcast()
        analytics?.record("assembly guide written", {
          steps: given.steps.length,
        })
        return filed
      },
      // (what Claude Code keeps of a folder is in its home, wherever the user has that)
      onRenamed: (from, to) =>
        followRename(
          from,
          to,
          expandHome(settings.provider("claude").home) || undefined
        ),
      viewport: askViewport,
      onItem: (projectId, conversationId, item) =>
        send(CHANNEL.threadItem, projectId, conversationId, item),
      onSummary: () => {
        broadcast()
        // a turn may be over: the folder it was had in is free to be another's
        follow()
      },
    })
    providers = new Providers({
      settings,
      look: { claude: lookAtClaude, codex: lookAtCodex, grok: lookAtGrok },
      onChange: () => {
        send(CHANNEL.providersChanged, providers.list())
        // with an agent found, a model can be looked over and what the cards say summed up
        broadcast()
      },
    })
    wire()

    // Run from a checkout, the app is being worked on and not used, and nothing of that
    // is counted: unless it is told where to send it, which is how this is tried out.
    const key = ANALYTICS_KEY ?? (app.isPackaged ? POSTHOG.key : "")
    if (key && !CAPTURE) {
      analytics = new Analytics({
        key,
        host: POSTHOG.host,
        file: path.join(data, "analytics-id"),
        allowed: () => settings.get().analytics,
        about: {
          app_version: app.getVersion(),
          os: SYSTEMS[process.platform] ?? process.platform,
          os_version: process.getSystemVersion(),
          arch: process.arch,
          packaged: app.isPackaged,
        },
        post: async (url, body, signal) =>
          net.fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            signal,
          }),
      })
      analytics.record("app opened")
    }

    // Run from a checkout, the app is whatever was last built there. It is the app made
    // into a package that has newer versions of itself to look for.
    if (app.isPackaged && !CAPTURE) {
      const { autoUpdater } = electronUpdater
      if (UPDATES_FROM)
        autoUpdater.setFeedURL({ provider: "generic", url: UPDATES_FROM })
      updates = new Updates({
        updater: autoUpdater,
        onChange: (update) => send(CHANNEL.updateChanged, update),
      })
      updates.start()
    }

    // Files that were still being made a model of when the app was last quit, or that
    // could not be: tried again, now that whatever was wanting may be there. Only in
    // folders of the app's own making: nobody else's build is run unasked.
    for (const { id } of projects.list(() => [])) {
      const project = projects.get(id)
      if (
        project?.made &&
        project.build &&
        !project.manifest &&
        broughtIn(project.path)
      )
        makeModel(id)
    }

    // a folder or a CAD file on the command line is opened, like `code <folder>`
    const given = process.argv
      .slice(app.isPackaged ? 1 : 2)
      .filter((arg) => !arg.startsWith("-"))
    let first: string | null = null
    try {
      first = open(given).id
    } catch (error) {
      console.error("[open]", error)
    }
    createWindow(first)

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(null)
    })
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
  app.on("before-quit", () => {
    for (const stop of builds.values()) stop()
    threads?.close()
    toolServer.close()
    guideServer.close()
    projects?.close()
    updates?.close()
    analytics?.close()
  })
}
