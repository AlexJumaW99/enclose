// The app's own process: the window, the list of projects, and the line to Claude.
import fs from "node:fs"
import path from "node:path"

import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from "electron"

import {
  ACCESSES,
  CHANNEL,
  EFFORTS,
  MODEL_SCHEME,
  type ClaudeStatus,
  type Manner,
  type Commands,
  type ModelChoice,
  type ModelSource,
  type PartNote,
  type PermissionAnswer,
  type Project,
  type Settings,
  type ViewportRequest,
  type ViewportResponse,
} from "../shared/api"
import { findClaude, followRename, listCommands, listModels } from "./claude"
import { standInName } from "./names"
import { folderName, Projects, resolveInside } from "./projects"
import { SettingsStore } from "./settings"
import { Threads } from "./threads"

const HERE = import.meta.dirname
const DEV_URL = process.env.VITE_DEV_SERVER_URL
// the app's icon, in the sizes each system asks for (scripts/icons.mjs makes them)
const ICONS = path.join(HERE, "../icons")

// For checking the app without clicking through it:
//   ENCLOSE_USER_DATA=<dir>  keep state, and new projects, somewhere other than the real ones
//   --capture=<file.png>     load (window hidden), save a picture of it, quit
//   --script=<file.js>       run this in the window first; it may return a promise
//   --wait=<ms>              how long to let the window settle before each step
//   <folder>                 add this folder as a project and open it
const flag = (name: string) =>
  process.argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? null
const CAPTURE = flag("capture")

// (the second is what the variable was called before the app had its name)
const ELSEWHERE =
  process.env.ENCLOSE_USER_DATA ?? process.env.CAD_AI_USER_DATA ?? null
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
}

let win: BrowserWindow | null = null
let projects: Projects
let threads: Threads
let settings: SettingsStore
let claude: ClaudeStatus = { path: null, version: null }

const list = (): Project[] => projects.list((id) => threads.summaries(id))
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
  const { projectsFolder } = settings.get()
  for (let n = 1; ; n++) {
    const dir = path.join(projectsFolder, n === 1 ? base : `${base}-${n}`)
    if (fs.existsSync(dir)) continue
    fs.mkdirSync(dir, { recursive: true })
    return { dir, name }
  }
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
  ipcMain.handle(CHANNEL.projectsAdd, async () => {
    if (!win) return null
    const picked = await dialog.showOpenDialog(win, {
      title: "Add a project folder",
      buttonLabel: "Add",
      properties: ["openDirectory", "createDirectory"],
    })
    if (picked.canceled || !picked.filePaths[0]) return null
    const id = projects.add(picked.filePaths[0])
    return list().find((p) => p.id === id) ?? null
  })
  ipcMain.handle(CHANNEL.projectsAddFolder, (_, dir: string) => {
    try {
      if (!fs.statSync(String(dir)).isDirectory()) return null
    } catch {
      return null
    }
    const id = projects.add(String(dir))
    return list().find((p) => p.id === id) ?? null
  })
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
      manner: Partial<Manner> | null
    ) =>
      // answers at once, with the conversation it went into: the turn runs for as long
      // as it runs, and reports through thread items
      threads.send(
        String(id),
        conversationId === null ? null : String(conversationId),
        String(text),
        Array.isArray(notes) ? notes.filter((note) => note?.part?.id) : [],
        {
          model: typeof manner?.model === "string" ? manner.model : null,
          effort: EFFORTS.find((effort) => effort === manner?.effort) ?? null,
          // what cannot be made out is not taken for leave to do anything
          access:
            ACCESSES.find((access) => access === manner?.access) ?? "edits",
        }
      )
  )
  ipcMain.handle(CHANNEL.threadStop, (_, id: string) => threads.stop(id))
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

  const claudeFound = findClaude().then((status) => (claude = status))
  // with Claude Code found, what the cards say can be summed up: have them asked for
  void claudeFound.then(broadcast)
  ipcMain.handle(CHANNEL.claudeStatus, () => claudeFound)
  // asked of Claude Code once; if it would not say, it is asked again the next time
  let models: Promise<ModelChoice[]> | null = null
  ipcMain.handle(CHANNEL.claudeModels, () => {
    models ??= claudeFound.then(listModels).then((found) => {
      if (found.length === 0) models = null
      return found
    })
    return models
  })
  // What it can be called on for is asked afresh each time: it changes with the folder,
  // and with what the user installs. One asking at a time for a project.
  const commands = new Map<string, Promise<Commands>>()
  ipcMain.handle(CHANNEL.claudeCommands, (_, id: string): Promise<Commands> => {
    const project = projects.get(String(id))
    if (!project) return Promise.resolve({ commands: [], skills: [] })
    let asking = commands.get(project.id)
    if (!asking) {
      asking = claudeFound
        .then((found) => listCommands(found, project.path))
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

    const data = app.getPath("userData")
    settings = new SettingsStore(path.join(data, "settings.json"), {
      // Documents is where a Mac keeps what its user makes; a run that keeps its state
      // elsewhere keeps its projects there too
      projectsFolder: ELSEWHERE
        ? path.join(ELSEWHERE, "Projects")
        : path.join(app.getPath("documents"), "Enclose"),
    })
    projects = new Projects(path.join(data, "projects.json"), broadcast)
    threads = new Threads({
      dir: path.join(data, "threads"),
      projects,
      claude: () => claude,
      kit: path.join(app.getAppPath(), "kit", "enclose.py"),
      onRenamed: followRename,
      viewport: askViewport,
      onItem: (projectId, conversationId, item) =>
        send(CHANNEL.threadItem, projectId, conversationId, item),
      onSummary: broadcast,
    })
    wire()

    // a folder on the command line is added and opened, like `code <folder>`
    let open: string | null = null
    for (const arg of process.argv.slice(app.isPackaged ? 1 : 2)) {
      if (arg.startsWith("-")) continue
      try {
        if (fs.statSync(arg).isDirectory())
          open = projects.add(path.resolve(arg))
      } catch {
        // not a folder: ignore
      }
    }
    createWindow(open)

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(null)
    })
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
  app.on("before-quit", () => {
    threads?.close()
    projects?.close()
  })
}
