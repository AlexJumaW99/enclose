import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  APP_AUTHOR,
  BIG,
  branchFor,
  commitAll,
  ignoreText,
  managed,
  messageOf,
  setUp,
  slugged,
} from "./backup"
import { git } from "./git"

let dir: string
const write = (file: string, content: string | Buffer = "") => {
  const full = path.join(dir, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}
const out = async (...args: string[]) => (await git(args, dir)).stdout.trim()

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "enclose-git-")))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe("ignoreText", () => {
  it("leaves out what the build writes and what is never kept", () => {
    expect(ignoreText(null, "build")).toBe(
      [
        "# Enclose: made again from the project's own files",
        "build/",
        ".venv/",
        "venv/",
        "__pycache__/",
        ".DS_Store",
        ".env",
        ".env.*",
        "",
      ].join("\n")
    )
  })

  it("keeps what the file says, and adds only what it does not say already", () => {
    const next = ignoreText("*.log\nbuild\n.DS_Store\n", "build")
    expect(next.startsWith("*.log\nbuild\n.DS_Store\n\n")).toBe(true)
    expect(next).toContain(".venv/")
    expect(next.match(/build/g)).toHaveLength(1)
    expect(ignoreText(next, "build")).toBe(next)
  })

  it("keeps what is built where nothing builds it again", () => {
    expect(ignoreText(null, null)).not.toContain("build/")
  })
})

describe("names", () => {
  it("are lower case, with dashes, in letters a URL has", () => {
    expect(slugged("Café table, 2nd try!")).toBe("cafe-table-2nd-try")
    expect(slugged("***")).toBe("project")
    expect(branchFor("Make the lid thicker", "a1b2c3d4e5")).toBe(
      "version/make-the-lid-thicker-a1b2c3"
    )
  })

  it("make a commit's message of what was asked, and the conversation", () => {
    expect(messageOf("Make the lid\nthicker", "Lid")).toBe(
      "Make the lid thicker\n\nConversation: Lid"
    )
    expect(messageOf("x".repeat(100), null)).toHaveLength(72)
  })
})

describe("setUp", () => {
  it("makes a folder a repository the app keeps", async () => {
    write("model.py", "print('hi')")
    expect(await setUp(git, dir, "build")).toBe(true)
    expect(await managed(git, dir)).toBe(true)
    expect(fs.readFileSync(path.join(dir, ".gitignore"), "utf8")).toContain(
      "build/"
    )
    // and a second time, changes nothing
    expect(await setUp(git, dir, "build")).toBe(true)
  })

  it("leaves a repository that was somebody's own as theirs", async () => {
    await git(["init", "--quiet"], dir)
    expect(await setUp(git, dir, "build")).toBe(false)
    expect(await managed(git, dir)).toBe(false)
    expect(fs.existsSync(path.join(dir, ".gitignore"))).toBe(false)
  })
})

describe("commitAll", () => {
  const by = { message: "Begin", author: APP_AUTHOR }

  it("commits all that is kept, by the one it is said to be by, and nothing twice", async () => {
    write("model.py", "a = 1")
    write("build/lid.glb", "mesh")
    await setUp(git, dir, "build")
    const first = await commitAll(git, dir, { ...by, branch: "main" })
    expect(first.commit).toMatch(/^[0-9a-f]{40}$/)
    expect((await out("ls-files")).split("\n")).toEqual([
      ".gitignore",
      "model.py",
    ])
    expect(await out("log", "-1", "--format=%an <%ae>|%s")).toBe(
      "Enclose <noreply@enclose.dev>|Begin"
    )
    expect((await commitAll(git, dir, { ...by, branch: "main" })).commit).toBe(
      null
    )
  })

  it("puts each version on its own branch, from where the folder was, leaving the files be", async () => {
    write("model.py", "a = 1")
    await setUp(git, dir, "build")
    await commitAll(git, dir, { ...by, branch: "main" })
    // another conversation's turn changes the folder, as versions.ts leaves it
    write("model.py", "a = 2")
    const branch = branchFor("Thicker", "c0ffee00")
    await commitAll(git, dir, { ...by, message: "Thicker", branch })
    expect(await out("rev-parse", "--abbrev-ref", "HEAD")).toBe(branch)
    expect(await out("show", "main:model.py")).toBe("a = 1")
    expect(await out("show", `${branch}:model.py`)).toBe("a = 2")
    // the folder turned back to the first conversation's, which goes on on main
    write("model.py", "a = 3")
    await commitAll(git, dir, { ...by, message: "Again", branch: "main" })
    expect(await out("log", "--format=%s", "main")).toBe("Again\nBegin")
    expect(fs.readFileSync(path.join(dir, "model.py"), "utf8")).toBe("a = 3")
  })

  it("has Git LFS keep a file too big for a repository", async () => {
    write("model.py", "a = 1")
    write("source/scan [1].stl", Buffer.alloc(BIG))
    await setUp(git, dir, "build")
    await commitAll(git, dir, { ...by, branch: "main" })
    expect(await out("lfs", "ls-files", "--name-only")).toBe(
      "source/scan [1].stl"
    )
    // what the repository holds of it is a pointer to it
    expect(await out("cat-file", "-s", "HEAD:source/scan [1].stl")).toMatch(
      /^1\d\d$/
    )
  }, 30_000)
})
