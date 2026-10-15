// Every project's history kept, and backed up: committed after each turn (backup.ts),
// and, where the user has connected GitHub, pushed to a private repository of the
// project's own on their account, which is made the first time there is anything to
// push. Nobody is asked: connecting GitHub is saying yes to it.
//
// What is done in one project is done one thing at a time, in the order it was asked;
// projects do not wait on each other. A push that fails is tried again a while later,
// and the next time anything is committed.
import path from "node:path"

import {
  APP_AUTHOR,
  branchFor,
  commitAll,
  isRepository,
  managed,
  messageOf,
  setUp,
  slugged,
  type Author,
  type Git,
} from "./backup"
import { SignedOut, type Account, type GitHub } from "./github"

/** A project, as far as its backing up goes. */
export type Backed = {
  id: string
  path: string
  name: string
  /** the manifest, absolute; null where there is no model yet */
  manifest: string | null
  /** the command that builds the model; null where there is none */
  build: string | null
}

/** How far backing up all the projects has got, while it is under way. */
export type BackingUp = { done: number; total: number } | null

export type BackupsDeps = {
  git: Git
  projects: () => Backed[]
  /** whether a folder is not too big to keep the history of (as versions.ts has it) */
  fits: (dir: string) => Promise<boolean>
  /** whether each conversation has the project its own way (versions.ts) */
  versioned: () => boolean
  /** GitHub, where it is connected, and who is signed in to it */
  github: () => { client: GitHub; account: Account } | null
  /** the app is no longer signed in, and has to be connected again */
  signedOut: () => void
  onProgress: (progress: BackingUp) => void
}

/** How long a push that failed waits to be tried again, ms. */
const AGAIN_MS = 3 * 60_000

/** What the build writes, within the project: what is not kept, being made again. */
function builtOf(project: Backed): string | null {
  // nothing built yet: where the app's own projects build to, when they do
  if (!project.manifest) return "build"
  // no build to make it again: what is there is all there is of it
  if (!project.build) return null
  const within = path.relative(project.path, path.dirname(project.manifest))
  return within && !within.startsWith("..")
    ? within.split(path.sep).join("/")
    : null
}

export class Backups {
  private queues = new Map<string, Promise<unknown>>()
  /** the projects with commits GitHub does not have yet */
  private unpushed = new Set<string>()
  private again: ReturnType<typeof setTimeout> | null = null

  private readonly deps: BackupsDeps

  constructor(deps: BackupsDeps) {
    this.deps = deps
  }

  private project(id: string): Backed | null {
    return this.deps.projects().find((one) => one.id === id) ?? null
  }

  /** Do this in a project once what was asked of it before is done. */
  private queue<T>(id: string, work: () => Promise<T>): Promise<T | null> {
    const before = this.queues.get(id) ?? Promise.resolve()
    const next = before.then(work).catch((error: unknown) => {
      if (error instanceof SignedOut) this.deps.signedOut()
      else console.error("[backup]", id, error)
      return null
    })
    this.queues.set(id, next)
    return next
  }

  private author(): Author {
    const github = this.deps.github()
    if (!github) return APP_AUTHOR
    const { id, login, name } = github.account
    // the address GitHub gives every account to put on commits, which keeps theirs private
    return {
      name: name ?? login,
      email: `${id}+${login}@users.noreply.github.com`,
    }
  }

  /**
   * The branch a conversation's version of the project is committed on: main for the
   * first conversation that commits anything, or where there are no versions; a branch
   * of its own for each one after, from where the folder was when it began.
   */
  private async branchOf(
    dir: string,
    conversationId: string | null,
    what: string
  ): Promise<string> {
    const { git } = this.deps
    if (!conversationId || !this.deps.versioned()) return "main"
    const key = `enclose-version.${conversationId}.branch`
    const known = (await git(["config", "--get", key], dir)).stdout.trim()
    if (known) return known
    const first = (
      await git(["config", "--get", "enclose.main"], dir)
    ).stdout.trim()
    let branch = "main"
    if (!first) await git(["config", "enclose.main", conversationId], dir)
    else if (first !== conversationId) branch = branchFor(what, conversationId)
    await git(["config", key, branch], dir)
    return branch
  }

  /**
   * Keep a project's history from now on, where it is the app's to keep: one the app
   * made, or a folder that was no repository. What it holds now is the first commit.
   */
  prepare(id: string, message: string): Promise<unknown> {
    return this.queue(id, async () => {
      const project = this.project(id)
      if (!project) return
      if (!(await this.keeps(project))) return
      await this.commit(project, null, message, message)
    })
  }

  /**
   * Set a project up to have its history kept, where it is the app's to keep: not a
   * repository of somebody's own, and not a folder too big to be a model's.
   */
  private async keeps(project: Backed): Promise<boolean> {
    if (!isRepository(project.path) && !(await this.deps.fits(project.path)))
      return false
    return setUp(this.deps.git, project.path, builtOf(project))
  }

  /** Commit what a turn left, or what taking one back did: in the conversation it was in. */
  record(
    id: string,
    {
      what,
      conversation,
      conversationId,
    }: {
      what: string
      conversation: string | null
      conversationId: string | null
    }
  ): Promise<unknown> {
    return this.queue(id, async () => {
      const project = this.project(id)
      if (!project || !(await managed(this.deps.git, project.path))) return
      await this.commit(
        project,
        conversationId,
        what,
        messageOf(what, conversation)
      )
    })
  }

  private async commit(
    project: Backed,
    conversationId: string | null,
    what: string,
    message: string
  ) {
    const branch = await this.branchOf(project.path, conversationId, what)
    const { commit } = await commitAll(this.deps.git, project.path, {
      branch,
      message,
      author: this.author(),
    })
    const pushedOnce = await this.pushedOnce(project)
    // A project with no model yet has no repository made for it: most that are begun
    // and come to nothing are, and are cleared away. It is made with the model.
    if (!pushedOnce && !project.manifest) return
    if (commit || this.unpushed.has(project.id) || !pushedOnce)
      await this.push(project)
  }

  private pushedOnce = async (project: Backed) =>
    (
      await this.deps.git(
        ["config", "--get", "enclose.repository"],
        project.path
      )
    ).stdout.trim() !== ""

  /** Push every branch of a project's to GitHub, making its repository where there is none. */
  private async push(project: Backed) {
    const github = this.deps.github()
    if (!github) return
    const { git } = this.deps
    const dir = project.path
    try {
      const full = await this.repositoryOf(project, github.client)
      const env = await github.client.pushing()
      const pushed = await git(
        ["push", "--all", "--porcelain", "origin"],
        dir,
        env
      )
      if (pushed.code !== 0) {
        // gone from GitHub (deleted there): a new one is made, and pushed to
        if (/not found/i.test(pushed.stderr)) {
          await git(["config", "--unset", "enclose.repository"], dir)
          throw new Error(`The repository ${full} is gone from GitHub.`)
        }
        throw new Error(
          pushed.stderr.trim().split("\n").at(-1) ?? "push failed"
        )
      }
      this.unpushed.delete(project.id)
    } catch (error) {
      this.unpushed.add(project.id)
      this.later()
      throw error
    }
  }

  /** The repository a project is kept in on GitHub: made now, where there is none yet. */
  private async repositoryOf(project: Backed, client: GitHub): Promise<string> {
    const { git } = this.deps
    const dir = project.path
    const kept = (
      await git(["config", "--get", "enclose.repository"], dir)
    ).stdout.trim()
    if (kept) return kept
    const made = await client.createRepository(
      `enclose-${slugged(project.name, 80)}`,
      `${project.name}, designed in Enclose`
    )
    await git(["config", "enclose.repository", made.full], dir)
    const has = (await git(["remote"], dir)).stdout
      .split("\n")
      .includes("origin")
    await git(
      has
        ? ["remote", "set-url", "origin", made.url]
        : ["remote", "add", "origin", made.url],
      dir
    )
    return made.full
  }

  /** Try the pushes that failed again, a while from now. */
  private later() {
    if (this.again) return
    this.again = setTimeout(() => {
      this.again = null
      for (const id of [...this.unpushed])
        void this.queue(id, async () => {
          const project = this.project(id)
          if (project) await this.push(project)
        })
    }, AGAIN_MS)
  }

  /** The project is called something else now: its repository is too, where it has one. */
  renamed(id: string): Promise<unknown> {
    return this.queue(id, async () => {
      const project = this.project(id)
      const github = this.deps.github()
      if (!project || !github || !(await managed(this.deps.git, project.path)))
        return
      const { git } = this.deps
      const full = (
        await git(["config", "--get", "enclose.repository"], project.path)
      ).stdout.trim()
      if (!full) return
      const name = `enclose-${slugged(project.name, 80)}`
      if (full.split("/")[1] === name) return
      const changed = await github.client.changeRepository(full, {
        name,
        description: `${project.name}, designed in Enclose`,
      })
      if (!changed) return
      await git(["config", "enclose.repository", changed.full], project.path)
      await git(["remote", "set-url", "origin", changed.url], project.path)
    })
  }

  /**
   * Back every project up: each the app keeps or can keep set up, committed as it
   * stands, and pushed. Said how far it has got as it goes, where `shown`.
   */
  async all(shown: boolean): Promise<void> {
    const projects = this.deps.projects()
    let done = 0
    const say = () => {
      if (shown) this.deps.onProgress({ done, total: projects.length })
    }
    say()
    await Promise.all(
      projects.map(async (project) => {
        await this.queue(project.id, async () => {
          if (!(await this.keeps(project))) return
          await this.commit(
            project,
            null,
            "Backed up by Enclose",
            "Backed up by Enclose"
          )
        })
        done++
        say()
      })
    )
    if (shown) this.deps.onProgress(null)
  }
}
