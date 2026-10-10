// A project as each of its conversations has it.
//
// A project has one folder, and every conversation about it is had there. So that each
// can go its own way with the model, the folder is kept as each conversation left it.
// When another is turned to, the folder is copied aside, whole, for the one that is
// left; and where the one turned to was left before, the folder is put as it was copied
// for that one then. (On a Mac's own disk a copy takes no room until one of the two is
// written to.) A conversation that has not been left yet has no copy: it begins from
// the folder as it stands, which is how a new one takes up where another had got to.
//
// So the folder is always one conversation's, the one that is `on`, and whatever is
// done in it, by a turn or by hand or by anything else, is done to that conversation's
// version of the project. What a folder holds that is not the project's own (see
// LEFT_OUT in changes.ts) is the same for them all, and is left alone.
//
// Where versions are not kept (it can be switched off in the settings), nothing is
// copied: the folder is the one version there is, and which conversation is on only
// follows the one that is shown. Copies made before that stay as they were made.
import fs from "node:fs"
import path from "node:path"

import { copy, filesOf, hashOf } from "./changes"

/** Which conversation a project's folder is, and which it was being put as, if it was. */
type Index = {
  on: string | null
  /**
   * The conversation the folder is being put as: set for as long as that takes, so that
   * an app quit in the middle of it can see it through the next time.
   */
  turning: string | null
}

/**
 * A folder that became another conversation's: whose it was, whose it is, and whether
 * its files were put as they had been copied for that one (it had been left before).
 */
export type Turned = { from: string | null; to: string; restored: boolean }

/** How each file of a folder stood when it was copied aside, by where it is in the folder. */
type Stood = Record<string, { size: number; mtimeMs: number }>

/** Where the files of a copy are in it, and where it says how each stood when it was made. */
const FILES = "files"
const STOOD = "stood.json"

/** What a conversation goes by, where it is to name a folder: nothing that leads out of one. */
const named = (id: unknown): id is string =>
  typeof id === "string" && /^[\w-]+$/.test(id)

export class Versions {
  private readonly dir: string
  private indexes = new Map<string, Index>()
  /** one thing at a time is done with a project's versions */
  private queues = new Map<string, Promise<unknown>>()
  /** how much is under way, or waiting to be, by project */
  private under = new Map<string, number>()

  constructor(dir: string) {
    this.dir = dir
  }

  private root(projectId: string, conversationId?: string) {
    return conversationId
      ? path.join(this.dir, projectId, conversationId)
      : path.join(this.dir, projectId)
  }

  private index(projectId: string): Index {
    let index = this.indexes.get(projectId)
    if (index) return index
    index = { on: null, turning: null }
    try {
      const kept = JSON.parse(
        fs.readFileSync(path.join(this.root(projectId), "index.json"), "utf8")
      ) as Partial<Index> | null
      index = {
        on: named(kept?.on) ? kept.on : null,
        turning: named(kept?.turning) ? kept.turning : null,
      }
    } catch {
      // nothing kept, or nothing that reads as it
    }
    this.indexes.set(projectId, index)
    return index
  }

  private save(projectId: string) {
    try {
      fs.mkdirSync(this.root(projectId), { recursive: true })
      fs.writeFileSync(
        path.join(this.root(projectId), "index.json"),
        JSON.stringify(this.index(projectId))
      )
    } catch {
      // kept for as long as the app is up, then
    }
  }

  /** One after another: a folder is not copied aside while it is being put another way. */
  private queued<T>(projectId: string, work: () => Promise<T>): Promise<T> {
    this.under.set(projectId, (this.under.get(projectId) ?? 0) + 1)
    const over = () => {
      const left = (this.under.get(projectId) ?? 1) - 1
      if (left > 0) this.under.set(projectId, left)
      else this.under.delete(projectId)
    }
    const next = (this.queues.get(projectId) ?? Promise.resolve())
      .then(work, work)
      .finally(over)
    this.queues.set(
      projectId,
      next.catch(() => {})
    )
    return next
  }

  /** The conversation a project's folder is as it has it. Null if it has been nobody's yet. */
  on(projectId: string): string | null {
    return this.index(projectId).on
  }

  /** Whether a project's folder is being copied aside or put another way just now. */
  busy(projectId: string): boolean {
    return this.under.has(projectId)
  }

  /** Whether a conversation has a copy of the folder: it was left, with versions kept. */
  private has(projectId: string, conversationId: string): boolean {
    return fs.existsSync(path.join(this.root(projectId, conversationId), FILES))
  }

  /**
   * Copy a folder aside as a conversation has it, in place of the copy it had. False if
   * there is too much in it to copy, or it could not be: the copy it had stands.
   */
  private async keep(
    projectId: string,
    conversationId: string,
    folder: string
  ): Promise<boolean> {
    const standing = await filesOf(folder)
    if (!standing) return false
    const kept = this.root(projectId, conversationId)
    // made beside the one it is to take the place of, which is there until it is whole
    const fresh = `${kept}.new`
    try {
      await fs.promises.rm(fresh, { recursive: true, force: true })
      await fs.promises.mkdir(path.join(fresh, FILES), { recursive: true })
      const stood: Stood = {}
      for (const file of standing) {
        await copy(
          path.join(folder, file.path),
          path.join(fresh, FILES, file.path)
        )
        stood[file.path] = { size: file.size, mtimeMs: file.mtimeMs }
      }
      await fs.promises.writeFile(
        path.join(fresh, STOOD),
        JSON.stringify(stood)
      )
      await fs.promises.rm(kept, { recursive: true, force: true })
      await fs.promises.rename(fresh, kept)
      return true
    } catch {
      await fs.promises
        .rm(fresh, { recursive: true, force: true })
        .catch(() => {})
      return false
    }
  }

  /**
   * Put a folder as it was copied for a conversation: what it has that the copy has not
   * goes, and each file of the copy that is not in it as it was copied is written.
   * `last` is a file to see to after all the others: the one whose being written is
   * taken for the rest being so.
   */
  private async put(
    projectId: string,
    conversationId: string,
    folder: string,
    last: string | null
  ) {
    const kept = path.join(this.root(projectId, conversationId), FILES)
    const copied = await filesOf(kept)
    const standing = await filesOf(folder)
    if (!copied || !standing) return
    let stood: Stood = {}
    try {
      stood = JSON.parse(
        await fs.promises.readFile(
          path.join(this.root(projectId, conversationId), STOOD),
          "utf8"
        )
      ) as Stood
    } catch {
      // nothing says how they stood: each is read, then
    }
    const wanted = new Set(copied.map((file) => file.path))
    for (const file of standing) {
      if (wanted.has(file.path)) continue
      await fs.promises.rm(path.join(folder, file.path), { force: true })
      // and the folders that were there for it, where nothing else is in them
      for (
        let above = path.dirname(file.path);
        above !== "." && above !== "";
        above = path.dirname(above)
      ) {
        const emptied = await fs.promises
          .rmdir(path.join(folder, above))
          .then(() => true)
          .catch(() => false)
        if (!emptied) break
      }
    }
    const there = new Map(standing.map((file) => [file.path, file]))
    const ordered = [...copied].sort(
      (a, b) => Number(a.path === last) - Number(b.path === last)
    )
    for (const file of ordered) {
      const from = path.join(kept, file.path)
      const at = path.join(folder, file.path)
      const is = there.get(file.path)
      const was = stood[file.path]
      // as it stood when it was copied, to the instant: not written to since, whichever
      // conversations the folder has been in between
      if (is && was && is.size === was.size && is.mtimeMs === was.mtimeMs)
        continue
      // or written since, with what was in it already
      if (
        is &&
        is.size === file.size &&
        (await hashOf(at)) === (await hashOf(from))
      )
        continue
      await copy(from, at)
    }
  }

  /**
   * Have a project's folder be a conversation's. With versions `kept`, it is copied
   * aside for the conversation it was, and put as it was copied for this one, if it
   * ever was. Without, it only becomes this one's, as it stands. Resolves to what came
   * of it, or to null if the folder was this conversation's already.
   */
  turnTo(
    projectId: string,
    to: string,
    folder: string,
    how: { kept: boolean; last?: string | null } = { kept: true }
  ): Promise<Turned | null> {
    return this.queued(projectId, async (): Promise<Turned | null> => {
      if (!named(to)) return null
      const index = this.index(projectId)
      const last = how.last ?? null
      const from = index.on
      let restored = false
      // One the app was quit in the middle of is seen through first: the folder is part
      // one conversation's and part another's, and nothing is to be copied of that.
      if (index.turning !== null) {
        const half = index.turning
        if (this.has(projectId, half))
          await this.put(projectId, half, folder, last).catch(() => {})
        index.on = half
        index.turning = null
        this.save(projectId)
        restored = true
      }
      if (index.on !== to) {
        // only a folder that was copied aside is put another way: nothing is lost by it
        const copied =
          how.kept &&
          index.on !== null &&
          (await this.keep(projectId, index.on, folder))
        if (copied && this.has(projectId, to)) {
          index.turning = to
          this.save(projectId)
          // (what could not be put is in the copy still, and the folder is this one's
          // from here on either way)
          await this.put(projectId, to, folder, last).catch(() => {})
          index.turning = null
          restored = true
        }
        index.on = to
        this.save(projectId)
      }
      return from === to && !restored ? null : { from, to, restored }
    })
  }

  /** A project is taken off the list: none of its versions are kept. */
  forget(projectId: string) {
    this.indexes.delete(projectId)
    fs.rmSync(this.root(projectId), { recursive: true, force: true })
  }
}
