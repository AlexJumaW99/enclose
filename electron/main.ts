// The app's own process: the window, the list of projects, and the line to the agents.
import fs from "node:fs"
import path from "node:path"

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  safeStorage,
  shell,
} from "electron"

import {
  ACCESSES,
  CHANNEL,
  EFFORTS,
  MODEL_SCHEME,
  PROVIDERS,
  type GroupAsked,
  type Manner,
  type Commands,
  type ModelSource,
  type ObjectRef,
  type PartNote,
  type PermissionAnswer,
  type Project,
  type Seen,
  type Settings,
  type Undone,
  type Vec3,
  type ViewportRequest,
  type ViewportResponse,
} from "../shared/api"
import { Changes } from "./changes"
import { followRename, listCommands, lookAtClaude } from "./claude"
import { lookAtCodex } from "./codex"
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
import { standInName } from "./names"
import { groupNameOf } from "./naming"
import { folderName, makeFolder, Projects, resolveInside } from "./projects"
import { cleanEnv, expandHome, Providers } from "./providers"
import { SettingsStore, type Vault } from "./settings"
import { Threads, type Arranging } from "./threads"
import { ToolServer } from "./tools"

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
const flag = (name: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? null
const CAPTURE = flag("capture")

// (the second is what the variable was called before the app had its name)
const ELSEWHERE =
  process.env.ENCLOSE_USER_DATA ?? process.env.CAD_AI_USER_DATA ?? null
if (ELSEWHERE) app.setPath("userData", ELSEWHERE)
else bringProfile()

/**
 * The app kept its state in a folder named cad-ai before it had its name. What is there
 * is moved to where the app looks now, once, before anything is read from either. (To ask
 * Electron where the state is kept is to have the folder made, so it is not asked yet.)
 */
function bringProfile() {
  const before = path.join(app.getPath("appData"), "cad-ai")
  const now = path.join(app.getPath("appData"), app.name)
  if (fs.existsSync(now) || !fs.existsSync(before)) return
  try {
    fs.renameSync(before, now)
  } catch (error) {
    // better the old folder than an app with nothing in it
    console.error("[profile]", error)
    app.setPath("userData", before)
  }
}

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
}

let win: BrowserWindow | null = null
let projects: Projects
let threads: Threads
let changes: Changes
let settings: SettingsStore
/** the agents on this machine: Claude Code, Codex, Grok */
let providers: Providers
/** where the app's own tools answer, for an agent that cannot be handed them */
const toolServer = new ToolServer()
/** where the app keeps the exporter a project copies to write its model */
const KIT = path.join(app.getAppPath(), "kit", "enclose.py")

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
      const { undo, redo } = changes.last(project.id)
      return {
        ...project,
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
  if (threads.working(id) || builds.has(id))
    return { ok: false, why: "busy", files: [] }
  // the manifest goes last: its being written is what the view loads the rest again for
  const manifest =
    project.manifest && path.relative(project.path, project.manifest)
  const outcome = await changes[way](id, project.path, manifest)
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
  return { ok: true, what: change.what }
}
const send = (channel: string, ...args: unknown[]) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}
const broadcast = () => send(CHANNEL.projectsChanged, list())

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
  kind: ViewportRequest["kind"]
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!win || win.isDestroyed())
      return reject(new Error("The app window is closed."))
    const id = ++requests
    const timer = setTimeout(() => {
      waiting.delete(id)
      reject(new Error("The viewport did not answer."))
    }, 15_000)
    waiting.set(id, { resolve, reject, timer })
    const request: ViewportRequest = { id, projectId, kind }
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
  for (const dir of opened.folders) id = projects.add(dir)
  for (const bundle of opened.bundles) {
    const { projectsFolder, lookOver } = settings.get()
    const { dir, written } = bringIn(bundle, projectsFolder, KIT)
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
      const arranged = arrange(read, given)
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
    return threads.lookOver(id, seen, written.files, manner, arranging)
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

/** How a message is to be answered, from what the window said of it. */
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
    const manifest = projects.get(url.hostname)?.manifest
    const file =
      manifest &&
      resolveInside(path.dirname(manifest), decodeURIComponent(url.pathname))
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
    // a model still being made of its files is given up on
    builds.get(project.id)?.()
    builds.delete(project.id)
    projects.remove(project.id)
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
      return true
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
      manner: Partial<Manner> | null
    ) => {
      // answers at once, with the conversation it went into: the turn runs for as long
      // as it runs, and reports through thread items
      const into = threads.send(
        String(id),
        conversationId === null ? null : String(conversationId),
        String(text),
        Array.isArray(notes) ? notes.filter((note) => note?.part?.id) : [],
        objectsFrom(objects),
        mannerFrom(manner)
      )
      // the user has started on the project themselves: its model is theirs to have
      // put in order, by asking
      if (into) projects.lookedOver(String(id))
      return into
    }
  )
  ipcMain.handle(
    CHANNEL.threadLookOver,
    (_, id: string, seen: unknown, manner: Partial<Manner> | null) =>
      lookOver(String(id), seenFrom(seen), mannerFrom(manner))
  )
  ipcMain.handle(CHANNEL.threadStop, (_, id: string) => threads.stop(id))
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
  ipcMain.handle(CHANNEL.settingsSetLookOver, (_, on: unknown): Settings =>
    settings.set({ lookOver: on === true })
  )

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
    // Run from a checkout, the app in the Dock is Electron's own, and so is its icon.
    // An app made into a package has the icon in it, and macOS draws that one.
    if (!app.isPackaged) app.dock?.setIcon(path.join(ICONS, "icon.png"))
    // What a Mac's About says is Electron's own too, down to the version, twice over.
    // (A version given here is shown just as it is given, so the word goes with it.)
    if (!app.isPackaged && process.platform === "darwin")
      app.setAboutPanelOptions({
        applicationName: app.name,
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
      },
      vault
    )
    projects = new Projects(path.join(data, "projects.json"), broadcast)
    changes = new Changes(path.join(data, "changes"))
    threads = new Threads({
      dir: path.join(data, "threads"),
      projects,
      changes,
      launch: (id) => providers.launch(id),
      tools: toolServer,
      kit: KIT,
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
      onSummary: broadcast,
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
    projects?.close()
  })
}
