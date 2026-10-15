import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Backups, type Backed } from "./backups"
import { git } from "./git"
import type { GitHub } from "./github"

let root: string
let project: Backed
/** where "GitHub" keeps the repositories it makes: bare ones, in a folder */
let remote: string
let versioned: boolean
let made: string[]

const write = (file: string, content: string) => {
  const full = path.join(project.path, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}
const show = async (repo: string, ...args: string[]) =>
  (await git(args, repo)).stdout.trim()

/** GitHub as a folder of bare repositories. */
const github = {
  createRepository: async (name: string) => {
    const url = path.join(remote, `${name}.git`)
    await git(["init", "--quiet", "--bare", url], root)
    made.push(name)
    return { full: `ada/${name}`, url }
  },
  changeRepository: async (_: string, change: { name?: string }) => ({
    full: `ada/${change.name}`,
    url: path.join(remote, `${change.name}.git`),
  }),
  pushing: async () => ({}),
} as unknown as GitHub

const backups = (connected: boolean) =>
  new Backups({
    git,
    projects: () => [project],
    fits: async () => true,
    versioned: () => versioned,
    github: () =>
      connected
        ? { client: github, account: { id: 7, login: "ada", name: "Ada" } }
        : null,
    signedOut: () => {},
    onProgress: () => {},
  })

beforeEach(() => {
  root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "enclose-backups-"))
  )
  remote = path.join(root, "github")
  fs.mkdirSync(remote)
  project = {
    id: "p1",
    path: path.join(root, "Lid"),
    name: "Lid",
    manifest: path.join(root, "Lid", "build", "enclose.model.json"),
    build: "python3 model.py",
  }
  fs.mkdirSync(project.path)
  versioned = true
  made = []
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe("Backups", () => {
  it("keeps a new project's history where nothing is connected, and pushes none of it", async () => {
    write("model.py", "a = 1")
    await backups(false).prepare("p1", "Started in Enclose")
    expect(await show(project.path, "log", "--format=%an|%s")).toBe(
      "Enclose|Started in Enclose"
    )
    expect(made).toEqual([])
  })

  it("makes a project's repository the first time, and pushes each turn to it, by the user", async () => {
    write("model.py", "a = 1")
    const kept = backups(true)
    await kept.prepare("p1", "Started in Enclose")
    expect(made).toEqual(["enclose-lid"])
    write("model.py", "a = 2")
    await kept.record("p1", {
      what: "Thicker lid",
      conversation: "Lid",
      conversationId: "c1",
    })
    const bare = path.join(remote, "enclose-lid.git")
    expect(await show(bare, "log", "--format=%an <%ae>|%s", "main")).toBe(
      "Ada <7+ada@users.noreply.github.com>|Thicker lid\nAda <7+ada@users.noreply.github.com>|Started in Enclose"
    )
    // a second conversation's version goes on a branch of its own
    write("model.py", "a = 3")
    await kept.record("p1", {
      what: "Round corners",
      conversation: null,
      conversationId: "c2xxxx",
    })
    expect(await show(bare, "branch", "--format=%(refname:short)")).toBe(
      "main\nversion/round-corners-c2xxxx"
    )
    expect(made).toEqual(["enclose-lid"])
  })

  it("makes no repository for a project with no model yet, and makes it with the model", async () => {
    project = { ...project, manifest: null, build: null }
    write("notes.txt", "a lid")
    const kept = backups(true)
    await kept.prepare("p1", "Started in Enclose")
    expect(made).toEqual([])
    project = {
      ...project,
      manifest: path.join(project.path, "build", "enclose.model.json"),
    }
    await kept.record("p1", {
      what: "Built the model",
      conversation: null,
      conversationId: null,
    })
    expect(made).toEqual(["enclose-lid"])
  })

  it("commits on main alone where there are no versions", async () => {
    versioned = false
    write("model.py", "a = 1")
    const kept = backups(false)
    await kept.prepare("p1", "Started in Enclose")
    write("model.py", "a = 2")
    await kept.record("p1", {
      what: "One",
      conversation: null,
      conversationId: "c1",
    })
    write("model.py", "a = 3")
    await kept.record("p1", {
      what: "Two",
      conversation: null,
      conversationId: "c2",
    })
    expect(
      await show(project.path, "branch", "--format=%(refname:short)")
    ).toBe("main")
  })

  it("backs up projects made before GitHub was connected, and renames a repository with its project", async () => {
    write("model.py", "a = 1")
    await backups(false).prepare("p1", "Started in Enclose")
    const kept = backups(true)
    await kept.all(false)
    expect(made).toEqual(["enclose-lid"])
    project = { ...project, name: "Pill box" }
    await kept.renamed("p1")
    expect(
      await show(project.path, "config", "--get", "enclose.repository")
    ).toBe("ada/enclose-pill-box")
  })

  it("leaves a repository that was somebody's own alone", async () => {
    await git(["init", "--quiet"], project.path)
    write("model.py", "a = 1")
    const kept = backups(true)
    await kept.prepare("p1", "Opened in Enclose")
    await kept.all(false)
    expect(made).toEqual([])
    expect((await git(["rev-parse", "HEAD"], project.path)).code).not.toBe(0)
  })
})
