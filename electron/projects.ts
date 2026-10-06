// The folders the user has added, where each one's model is, and what branch it is on.
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import type { Project, ThreadSummary } from "../shared/api"
import { CONFIG_NAMES, MANIFEST_NAMES } from "../shared/manifest-format"

type Saved = {
  id: string
  path: string
  /** what the user called it, for a project made here; otherwise the folder's name serves */
  name?: string
  sessionId: string | null
  addedAt: number
  /** taken off the list, but remembered: adding the folder again brings back its conversation */
  closed?: boolean
}

type Found = {
  /** absolute path of the manifest */
  manifest: string | null
  /** how the project says it is built, from its enclose.json */
  build: string | null
}

const SKIP = new Set(["node_modules", "venv", "__pycache__", "dist", "target"])

/**
 * What a new project's folder is called: when it was made, to the minute, then its name
 * in lower case with dashes, as in 2026-10-05-2336-pill-box. The date comes first so
 * that the folders sort in the order they were made.
 */
export function folderName(name: string, made: Date): string {
  const two = (n: number) => String(n).padStart(2, "0")
  const when = [
    made.getFullYear(),
    two(made.getMonth() + 1),
    two(made.getDate()),
    two(made.getHours()) + two(made.getMinutes()),
  ].join("-")
  const slug = name
    // accents come off their letters, so that "café" is "cafe"
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // anything that is not a letter or a digit, in any script, is a dash
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  return `${when}-${slug || "untitled"}`
}
const MAX_DEPTH = 6
const MAX_FOLDERS = 4000
const MAX_MANIFEST_BYTES = 5_000_000

function isManifest(file: string): boolean {
  try {
    if (fs.statSync(file).size > MAX_MANIFEST_BYTES) return false
    const json: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
    const parts = (json as { parts?: unknown }).parts
    return (
      Array.isArray(parts) &&
      parts.length > 0 &&
      typeof (parts[0] as { file?: unknown }).file === "string"
    )
  } catch {
    return false
  }
}

/**
 * Where a folder keeps its model. An enclose.json at the top can say so outright
 * ({ "model": "path/to/manifest.json", "build": "python3 make.py" }); otherwise the
 * nearest manifest wins, searching level by level.
 */
export function findModel(root: string): Found {
  let build: string | null = null
  for (const name of CONFIG_NAMES) {
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(root, name), "utf8")
      ) as {
        model?: unknown
        build?: unknown
      }
      if (typeof config.build === "string") build = config.build
      if (typeof config.model === "string") {
        const file = path.resolve(root, config.model)
        if (isManifest(file)) return { manifest: file, build }
      }
      break
    } catch {
      // no config by this name, or not valid JSON: try the next, then the search
    }
  }

  let level = [root]
  let seen = 0
  for (let depth = 0; depth <= MAX_DEPTH && level.length > 0; depth++) {
    const next: string[] = []
    for (const dir of level) {
      if (++seen > MAX_FOLDERS) return { manifest: null, build }
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const name of MANIFEST_NAMES) {
        const file = path.join(dir, name)
        if (
          entries.some((e) => e.isFile() && e.name === name) &&
          isManifest(file)
        ) {
          return { manifest: file, build }
        }
      }
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          !SKIP.has(entry.name)
        ) {
          next.push(path.join(dir, entry.name))
        }
      }
    }
    level = next
  }
  return { manifest: null, build }
}

/** The branch checked out in the repository this folder is part of, if it is in one. */
export function readBranch(dir: string): string | null {
  let at = dir
  for (;;) {
    const dot = path.join(at, ".git")
    try {
      // a worktree or submodule has a .git file pointing at the real directory
      const gitDir = fs.statSync(dot).isDirectory()
        ? dot
        : path.resolve(
            at,
            /^gitdir: (.+)$/m.exec(fs.readFileSync(dot, "utf8"))?.[1] ?? ""
          )
      const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim()
      return /^ref: refs\/heads\/(.+)$/.exec(head)?.[1] ?? head.slice(0, 7)
    } catch {
      // no repository at this level
    }
    const up = path.dirname(at)
    if (up === at) return null
    at = up
  }
}

/** `file` as a path inside `root`, or null if it would land outside. */
export function resolveInside(root: string, file: string): string | null {
  const full = path.resolve(root, `.${path.sep}${file}`)
  const inside =
    full === root ||
    full.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
  return inside ? full : null
}

export class Projects {
  private readonly file: string
  private readonly onChange: () => void
  private saved: Saved[] = []
  private found = new Map<string, Found>()
  private revisions = new Map<string, number>()
  private watchers = new Map<string, fs.FSWatcher>()
  private timers = new Map<string, NodeJS.Timeout>()

  constructor(file: string, onChange: () => void) {
    this.file = file
    this.onChange = onChange
    try {
      const state = JSON.parse(fs.readFileSync(file, "utf8")) as {
        projects?: Saved[]
      }
      this.saved = (state.projects ?? []).filter((p) => fs.existsSync(p.path))
    } catch {
      // first run
    }
    for (const project of this.open()) this.locate(project)
  }

  /** The projects on the list. */
  private open(): Saved[] {
    return this.saved.filter((p) => !p.closed)
  }

  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(
      this.file,
      JSON.stringify({ projects: this.saved }, null, 2)
    )
  }

  /** Find the project's model and watch its manifest, so a rebuild shows up by itself. */
  private locate(project: Saved) {
    const found = findModel(project.path)
    const before = this.found.get(project.id)?.manifest ?? null
    this.found.set(project.id, found)
    if (found.manifest === before) return

    this.watchers.get(project.id)?.close()
    this.watchers.delete(project.id)
    this.bump(project.id)
    if (!found.manifest) return
    const name = path.basename(found.manifest)
    try {
      const watcher = fs.watch(
        path.dirname(found.manifest),
        { persistent: false },
        (_, changed) => {
          if (changed !== name) return
          // a build writes the manifest in more than one go; wait for it to settle
          clearTimeout(this.timers.get(project.id))
          this.timers.set(
            project.id,
            setTimeout(() => {
              this.bump(project.id)
              this.onChange()
            }, 400)
          )
        }
      )
      this.watchers.set(project.id, watcher)
    } catch {
      // unwatchable (a network drive, say): the model still loads, it just won't auto-reload
    }
  }

  private bump(id: string) {
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1)
  }

  list(summary: (id: string) => ThreadSummary): Project[] {
    return this.open().map((p) => {
      const manifest = this.found.get(p.id)?.manifest ?? null
      return {
        id: p.id,
        path: p.path,
        name: p.name ?? path.basename(p.path),
        branch: readBranch(p.path),
        manifest: manifest && path.relative(p.path, manifest),
        revision: this.revisions.get(p.id) ?? 0,
        thread: summary(p.id),
      }
    })
  }

  get(id: string): (Saved & Found) | null {
    const project = this.open().find((p) => p.id === id)
    if (!project) return null
    return {
      ...project,
      ...(this.found.get(id) ?? { manifest: null, build: null }),
    }
  }

  /**
   * Add a folder, or return the project it already is - or was, before it was closed.
   * `name` is what to call it, when that is not the folder's own name.
   */
  add(dir: string, name?: string): string {
    const real = fs.realpathSync(dir)
    const existing = this.saved.find((p) => p.path === real)
    if (existing) {
      if (existing.closed) {
        existing.closed = false
        this.locate(existing)
        this.save()
        this.onChange()
      }
      return existing.id
    }
    // lower-case hex: the id is used as a host name in model URLs
    const project: Saved = {
      id: randomBytes(6).toString("hex"),
      path: real,
      ...(name ? { name } : {}),
      sessionId: null,
      addedAt: Date.now(),
    }
    this.saved.push(project)
    this.locate(project)
    this.save()
    this.onChange()
    return project.id
  }

  /** Take a project off the list. Nothing of it is deleted. */
  remove(id: string) {
    const project = this.saved.find((p) => p.id === id)
    if (!project) return
    project.closed = true
    this.watchers.get(id)?.close()
    this.watchers.delete(id)
    this.found.delete(id)
    this.save()
    this.onChange()
  }

  setSession(id: string, sessionId: string | null) {
    const project = this.saved.find((p) => p.id === id)
    if (!project || project.sessionId === sessionId) return
    project.sessionId = sessionId
    this.save()
  }

  /** Look again for the model: Claude may just have created or moved it. */
  refresh(id: string) {
    const project = this.saved.find((p) => p.id === id)
    if (project) this.locate(project)
  }

  refreshAll() {
    for (const project of this.open()) this.locate(project)
  }

  close() {
    for (const watcher of this.watchers.values()) watcher.close()
    for (const timer of this.timers.values()) clearTimeout(timer)
  }
}
