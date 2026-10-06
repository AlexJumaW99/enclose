// The app's own process: the window, the list of projects, and the line to Claude.
import fs from "node:fs"
import path from "node:path"

import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from "electron"

import {
  CHANNEL,
  MODEL_SCHEME,
  type Access,
  type ClaudeStatus,
  type ModelSource,
  type PartRef,
  type PermissionAnswer,
  type Project,
  type Settings,
  type ViewportRequest,
  type ViewportResponse,
} from "../shared/api"
import { findClaude } from "./claude"
import { Projects, resolveInside } from "./projects"
import { SettingsStore } from "./settings"
import { Threads } from "./threads"

const HERE = import.meta.dirname
const DEV_URL = process.env.VITE_DEV_SERVER_URL

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

const list = (): Project[] => projects.list((id) => threads.summary(id))
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
 * Make the folder for a new project, where new projects go: named as the user named it,
 * as far as a folder can be, and numbered if that name is already taken.
 */
function newFolder(name: string): string {
  const base =
    name
      .replace(/[/\\:]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "") || "Untitled"
  const { projectsFolder } = settings.get()
  for (let n = 1; ; n++) {
    const dir = path.join(projectsFolder, n === 1 ? base : `${base} ${n}`)
    if (fs.existsSync(dir)) continue
    fs.mkdirSync(dir, { recursive: true })
    return dir
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
  ipcMain.handle(CHANNEL.projectsCreate, (_, name: string) => {
    const id = projects.add(newFolder(String(name)))
    return list().find((p) => p.id === id) ?? null
  })
  ipcMain.handle(CHANNEL.projectsRemove, (_, id: string) => {
    threads.stop(id)
    projects.remove(id)
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

  ipcMain.handle(CHANNEL.threadItems, (_, id: string) => threads.items(id))
  ipcMain.handle(
    CHANNEL.threadSend,
    (_, id: string, text: string, part: PartRef | null, access: Access) => {
      // not awaited: the turn runs for as long as it runs, and reports through thread items
      void threads.send(
        id,
        String(text),
        part,
        access === "full" ? "full" : "ask"
      )
    }
  )
  ipcMain.handle(CHANNEL.threadStop, (_, id: string) => threads.stop(id))
  ipcMain.handle(
    CHANNEL.threadAnswer,
    (_, id: string, permissionId: string, answer: PermissionAnswer) =>
      threads.answer(id, permissionId, answer)
  )
  ipcMain.handle(CHANNEL.threadReset, (_, id: string) => threads.reset(id))

  const claudeFound = findClaude().then((status) => (claude = status))
  ipcMain.handle(CHANNEL.claudeStatus, () => claudeFound)

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
      viewport: askViewport,
      onItem: (projectId, item) => send(CHANNEL.threadItem, projectId, item),
      onReset: (projectId) => send(CHANNEL.threadWasReset, projectId),
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
