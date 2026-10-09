// The folders the user has added, where each one's model is, and what branch it is on.
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import type { BringingIn, ConversationSummary, Project } from "../shared/api"
import { CONFIG_NAMES, MANIFEST_NAMES } from "../shared/manifest-format"
import { findReference } from "./reference"

type Saved = {
  id: string
  path: string
  /** what the user called it, for a project made here; otherwise the folder's name serves */
  name?: string
  /** the app made this folder itself, rather than being pointed at one that was there */
  made?: boolean
  /** `name` is a stand-in, until what is being made gives the project a name of its own */
  standIn?: boolean
  /**
   * Made of CAD files that Claude has yet to look over, to name and group what is in
   * them: what the app wrote its model.py from, which is what it is written from again
   * with those names in it.
   */
  lookOver?: Written
  addedAt: number
  /**
   * From when a project had one conversation: the Claude Code session that carried it on.
   * That conversation takes it with it when it is moved in with the others.
   */
  sessionId?: string | null
  /** from when a project taken off the list was remembered: such a one is now forgotten */
  closed?: boolean
}

/** What a project's model.py was written from: the model's title, and the files it reads. */
export type Written = { title: string; files: string[] }

type Found = {
  /** absolute path of the manifest */
  manifest: string | null
  /** how the project says it is built, from its enclose.json */
  build: string | null
}

/** Folders never looked into: what is installed or built there is none of the project's. */
export const SKIP = new Set([
  "node_modules",
  "venv",
  "__pycache__",
  "dist",
  "target",
])

/**
 * Delete a folder if there is nothing in it, which is the only way this app deletes one.
 * (The Finder leaves a note of its own in any folder it has shown: that does not count.)
 */
function removeIfEmpty(dir: string): boolean {
  try {
    const inside = fs.readdirSync(dir)
    if (inside.some((name) => name !== ".DS_Store")) return false
    for (const name of inside) fs.unlinkSync(path.join(dir, name))
    fs.rmdirSync(dir)
    return true
  } catch {
    return false
  }
}

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

/**
 * Make a folder by this name in another, and return where it is. Where the name is
 * taken it is numbered, as happens when the same one comes up twice in a minute.
 */
export function makeFolder(parent: string, base: string): string {
  for (let n = 1; ; n++) {
    const dir = path.join(parent, n === 1 ? base : `${base}-${n}`)
    if (fs.existsSync(dir)) continue
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }
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
  /**
   * Where each project keeps a reference scene of its own, if it has one; how often it
   * has been found rewritten; and what watches it. All by project.
   */
  private scenes = new Map<string, string>()
  private sceneRevisions = new Map<string, number>()
  private sceneWatchers = new Map<string, fs.FSWatcher>()
  private sceneTimers = new Map<string, NodeJS.Timeout>()
  private watchers = new Map<string, fs.FSWatcher>()
  private timers = new Map<string, NodeJS.Timeout>()
  /** how far the making of a model from files opened into a project has got */
  private bringing = new Map<string, BringingIn>()

  constructor(file: string, onChange: () => void) {
    this.file = file
    this.onChange = onChange
    try {
      const state = JSON.parse(fs.readFileSync(file, "utf8")) as {
        projects?: Saved[]
      }
      this.saved = (state.projects ?? []).filter(
        (p) => !p.closed && fs.existsSync(p.path)
      )
    } catch {
      // first run
    }
    for (const project of this.saved) this.locate(project)
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
    this.locateScene(project)
    const found = findModel(project.path)
    const before = this.found.get(project.id)?.manifest ?? null
    this.found.set(project.id, found)
    if (found.manifest === before) return

    this.bump(project.id)
    this.watch(project)
  }

  /** Watch a project's manifest where it now is. */
  private watch(project: Saved) {
    this.watchers.get(project.id)?.close()
    this.watchers.delete(project.id)
    const manifest = this.found.get(project.id)?.manifest
    if (!manifest) return
    const name = path.basename(manifest)
    try {
      const watcher = fs.watch(
        path.dirname(manifest),
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

  /**
   * Find the reference scene a project has of its own, if it has one, and watch its
   * manifest as the model's is watched: a scene built again shows up by itself.
   */
  private locateScene(project: Saved) {
    const { id } = project
    const found = findReference(project.path)
    if (found === (this.scenes.get(id) ?? null)) return
    this.sceneWatchers.get(id)?.close()
    this.sceneWatchers.delete(id)
    if (!found) {
      this.scenes.delete(id)
      return
    }
    this.scenes.set(id, found)
    const bump = () =>
      this.sceneRevisions.set(id, (this.sceneRevisions.get(id) ?? 0) + 1)
    bump()
    const name = path.basename(found)
    try {
      this.sceneWatchers.set(
        id,
        fs.watch(path.dirname(found), { persistent: false }, (_, changed) => {
          if (changed !== name) return
          clearTimeout(this.sceneTimers.get(id))
          this.sceneTimers.set(
            id,
            setTimeout(() => {
              // taken away, it is no scene any more: that is found by looking again
              if (fs.existsSync(found)) bump()
              else this.locateScene(project)
              this.onChange()
            }, 400)
          )
        })
      )
    } catch {
      // unwatchable: the scene still loads, it just won't load again by itself
    }
  }

  list(conversations: (id: string) => ConversationSummary[]): Project[] {
    return this.saved.map((p) => {
      const manifest = this.found.get(p.id)?.manifest ?? null
      return {
        id: p.id,
        path: p.path,
        name: p.name ?? path.basename(p.path),
        branch: readBranch(p.path),
        manifest: manifest && path.relative(p.path, manifest),
        bringingIn: this.bringing.get(p.id) ?? null,
        // there is nothing to look over until there is a model
        lookOver: p.lookOver && manifest ? "wanted" : null,
        revision: this.revisions.get(p.id) ?? 0,
        reference: this.scenes.has(p.id)
          ? (this.sceneRevisions.get(p.id) ?? 0)
          : null,
        // what can be taken back is kept elsewhere (changes.ts), and said by whoever
        // has both
        undo: null,
        redo: null,
        conversations: conversations(p.id),
      }
    })
  }

  /** Whether a folder is one of the projects already. */
  knows(dir: string): boolean {
    try {
      const real = fs.realpathSync(dir)
      return this.saved.some((p) => p.path === real)
    } catch {
      return false
    }
  }

  get(id: string): (Saved & Found & { reference: string | null }) | null {
    const project = this.saved.find((p) => p.id === id)
    if (!project) return null
    return {
      ...project,
      ...(this.found.get(id) ?? { manifest: null, build: null }),
      // absolute path of the manifest of its own reference scene, if it has one
      reference: this.scenes.get(id) ?? null,
    }
  }

  /**
   * Add a folder, or return the project it already is. `made` says the app has just made
   * the folder itself, under what name the project goes, whether that name is only a
   * stand-in, and whether there are files in it a model is about to be made of: the
   * project is then in the list as that from the first, never as one with nothing in it.
   * `lookOver` says Claude is to look that model over, and what it was written from.
   */
  add(
    dir: string,
    made?: {
      name: string
      standIn?: boolean
      reading?: boolean
      lookOver?: Written
    }
  ): string {
    const real = fs.realpathSync(dir)
    const existing = this.saved.find((p) => p.path === real)
    if (existing) return existing.id
    // lower-case hex: the id is used as a host name in model URLs
    const project: Saved = {
      id: randomBytes(6).toString("hex"),
      path: real,
      ...(made
        ? {
            name: made.name,
            made: true,
            ...(made.standIn ? { standIn: true } : {}),
            ...(made.lookOver ? { lookOver: made.lookOver } : {}),
          }
        : {}),
      addedAt: Date.now(),
    }
    this.saved.push(project)
    if (made?.reading)
      this.bringing.set(project.id, { state: "working", done: 0, total: null })
    this.locate(project)
    this.save()
    this.onChange()
    return project.id
  }

  /**
   * Take a project off the list, and forget it: added again, its folder is a new project.
   * Nothing in the folder is touched. The one exception is a folder that came to nothing
   * - one the app made, with nothing put in it - which is cleared away rather than left
   * lying about for good.
   */
  remove(id: string) {
    const project = this.saved.find((p) => p.id === id)
    if (!project) return
    this.watchers.get(id)?.close()
    this.watchers.delete(id)
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    this.found.delete(id)
    this.revisions.delete(id)
    this.sceneWatchers.get(id)?.close()
    this.sceneWatchers.delete(id)
    clearTimeout(this.sceneTimers.get(id))
    this.sceneTimers.delete(id)
    this.scenes.delete(id)
    this.sceneRevisions.delete(id)
    this.bringing.delete(id)
    this.saved = this.saved.filter((p) => p !== project)
    // projects made before `made` was kept are known by having a name of their own
    if (project.made ?? project.name !== undefined) removeIfEmpty(project.path)
    this.save()
    this.onChange()
  }

  /**
   * Give a project that still goes by a stand-in the name of what has been made in it:
   * the title of its model. Its folder is renamed to match, keeping the date it was made
   * on. To be called when nothing is at work in the folder. `moved` hears of the rename.
   */
  christen(id: string, moved: (from: string, to: string) => void) {
    const project = this.saved.find((p) => p.id === id)
    const manifest = this.found.get(id)?.manifest
    if (!project?.standIn || !manifest) return
    let title: unknown
    try {
      title = (
        JSON.parse(fs.readFileSync(manifest, "utf8")) as { title?: unknown }
      ).title
    } catch {
      return
    }
    if (typeof title !== "string" || !title.trim()) return
    const name = title.replace(/\s+/g, " ").trim()

    const from = project.path
    const base = folderName(name, new Date(project.addedAt))
    let to = from
    if (path.basename(from) !== base) {
      for (let n = 1; ; n++) {
        to = path.join(path.dirname(from), n === 1 ? base : `${base}-${n}`)
        if (!fs.existsSync(to)) break
      }
      try {
        fs.renameSync(from, to)
      } catch {
        // the folder stays as it is called; the project still gets its name
        to = from
      }
    }
    project.name = name
    delete project.standIn
    if (to !== from) {
      project.path = to
      // the model is the same model, somewhere else: watched there, without being
      // taken for a new one
      this.found.set(id, {
        manifest: path.join(to, path.relative(from, manifest)),
        build: this.found.get(id)?.build ?? null,
      })
      this.watch(project)
      // and so is its reference scene, if it has one of its own
      this.locateScene(project)
      moved(from, to)
    }
    this.save()
    this.onChange()
  }

  /**
   * The Claude Code session of the one conversation a project used to have, handed over
   * for good to whoever asks: the conversation keeps it from here on.
   */
  takeSession(id: string): string | null {
    const project = this.saved.find((p) => p.id === id)
    const sessionId = project?.sessionId ?? null
    if (project && "sessionId" in project) {
      delete project.sessionId
      this.save()
    }
    return sessionId
  }

  /**
   * A project's model is no longer waiting to be looked over: Claude is at it, or the
   * user has started on the project themselves. Returns what its model.py was written
   * from, if it was waiting.
   */
  lookedOver(id: string): Written | null {
    const project = this.saved.find((p) => p.id === id)
    const written = project?.lookOver ?? null
    if (project && written) {
      delete project.lookOver
      this.save()
      this.onChange()
    }
    return written
  }

  /**
   * Say how far the making of a model from a project's files has got, or (null) that
   * it is over with: there is a model now, and it is looked for.
   */
  report(id: string, state: BringingIn | null) {
    const project = this.saved.find((p) => p.id === id)
    if (!project) return
    if (state) this.bringing.set(id, state)
    else {
      this.bringing.delete(id)
      this.locate(project)
    }
    this.onChange()
  }

  /**
   * The files of a project's model were put as they were at some other time, without
   * its manifest being written to: the window is to load them again all the same.
   */
  changed(id: string) {
    this.bump(id)
    this.onChange()
  }

  /** Look again for the model: Claude may just have created or moved it. */
  refresh(id: string) {
    const project = this.saved.find((p) => p.id === id)
    if (project) this.locate(project)
  }

  refreshAll() {
    for (const project of this.saved) this.locate(project)
  }

  close() {
    for (const watcher of this.watchers.values()) watcher.close()
    for (const timer of this.timers.values()) clearTimeout(timer)
    for (const watcher of this.sceneWatchers.values()) watcher.close()
    for (const timer of this.sceneTimers.values()) clearTimeout(timer)
  }
}
