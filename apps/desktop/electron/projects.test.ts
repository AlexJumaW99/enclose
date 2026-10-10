import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  findModel,
  folderName,
  folderSize,
  Projects,
  readBranch,
  resolveInside,
} from "./projects"

let root: string
const write = (file: string, content: unknown) => {
  const full = path.join(root, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(
    full,
    typeof content === "string" ? content : JSON.stringify(content)
  )
}
const MANIFEST = { parts: [{ id: "a", file: "a.glb" }] }

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "enclose-test-")))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("resolveInside", () => {
  it("resolves files under the root", () => {
    expect(resolveInside("/models/a", "/top.glb")).toBe("/models/a/top.glb")
    expect(resolveInside("/models/a", "step/top.step")).toBe(
      "/models/a/step/top.step"
    )
  })

  it("refuses anything that would land outside it", () => {
    expect(resolveInside("/models/a", "../b/secret")).toBeNull()
    expect(resolveInside("/models/a", "/../../etc/passwd")).toBeNull()
    expect(resolveInside("/models/a", "step/../../a-sibling/x")).toBeNull()
  })
})

describe("findModel", () => {
  it("finds nothing in a folder without a manifest", () => {
    write("README.md", "hello")
    expect(findModel(root)).toEqual({ manifest: null, build: null })
  })

  it("finds the nearest manifest, searching level by level", () => {
    write("a/b/c/report.json", MANIFEST)
    write("viewer/model.json", MANIFEST)
    expect(findModel(root).manifest).toBe(path.join(root, "viewer/model.json"))
  })

  it("passes over files that share the name but are not manifests", () => {
    write("report.json", { coverage: 0.9 })
    write("out/report.json", MANIFEST)
    expect(findModel(root).manifest).toBe(path.join(root, "out/report.json"))
  })

  it("does not look inside dependencies or hidden folders", () => {
    write("node_modules/pkg/model.json", MANIFEST)
    write(".cache/model.json", MANIFEST)
    expect(findModel(root).manifest).toBeNull()
  })

  it("takes the project's word for where the model is and how it is built", () => {
    write("near/model.json", MANIFEST)
    write("deep/down/here/custom.json", MANIFEST)
    write("enclose.json", {
      model: "deep/down/here/custom.json",
      build: "python3 make.py",
    })
    expect(findModel(root)).toEqual({
      manifest: path.join(root, "deep/down/here/custom.json"),
      build: "python3 make.py",
    })
  })

})

describe("readBranch", () => {
  it("reads the branch of the repository a folder is in", () => {
    write(".git/HEAD", "ref: refs/heads/feature/thing\n")
    write("hardware/enclosure/x.txt", "")
    expect(readBranch(path.join(root, "hardware/enclosure"))).toBe(
      "feature/thing"
    )
  })

  it("shows the start of the commit when no branch is checked out", () => {
    write(".git/HEAD", "0123456789abcdef0123456789abcdef01234567\n")
    expect(readBranch(root)).toBe("0123456")
  })

  it("follows a worktree's .git file to the real directory", () => {
    write("main/.git/worktrees/wt/HEAD", "ref: refs/heads/side\n")
    write("wt/.git", `gitdir: ${path.join(root, "main/.git/worktrees/wt")}\n`)
    expect(readBranch(path.join(root, "wt"))).toBe("side")
  })
})

describe("Projects", () => {
  const idle = () => []

  it("forgets a project taken off the list, so adding its folder again is a new one", () => {
    write("thing/model.json", MANIFEST)
    const file = path.join(root, "state/projects.json")
    const projects = new Projects(file, () => {})
    const id = projects.add(path.join(root, "thing"), { name: "The Thing" })
    expect(projects.list(idle).map((p) => [p.id, p.name])).toEqual([
      [id, "The Thing"],
    ])
    // adding a folder that is already a project is that project
    expect(projects.add(path.join(root, "thing"))).toBe(id)
    // and it is the same one after a restart
    expect(new Projects(file, () => {}).list(idle)[0]).toMatchObject({ id })

    projects.remove(id)
    expect(projects.list(idle)).toEqual([])
    expect(projects.get(id)).toBeNull()
    expect(new Projects(file, () => {}).list(idle)).toEqual([])
    // what is in the folder is no business of the list's
    expect(fs.existsSync(path.join(root, "thing/model.json"))).toBe(true)

    // it comes back clean: another project, by its folder's name
    const again = projects.add(path.join(root, "thing"))
    expect(again).not.toBe(id)
    expect(projects.list(idle)).toMatchObject([
      { id: again, name: "thing", manifest: "model.json" },
    ])
    projects.close()
  })

  it("lists the project added last first, and so it does after a restart", () => {
    const file = path.join(root, "state/projects.json")
    const projects = new Projects(file, () => {})
    const ids = ["first", "second", "third"].map((name) => {
      fs.mkdirSync(path.join(root, name))
      return projects.add(path.join(root, name))
    })
    const newestFirst = [...ids].reverse()
    expect(projects.list(idle).map((p) => p.id)).toEqual(newestFirst)
    expect(new Projects(file, () => {}).list(idle).map((p) => p.id)).toEqual(
      newestFirst
    )
    projects.close()
  })

  it("forgets the projects that an earlier version only closed", () => {
    write("open/model.json", MANIFEST)
    write("shut/model.json", MANIFEST)
    const file = path.join(root, "state/projects.json")
    const saved = (name: string, extra: object) => ({
      id: name,
      path: path.join(root, name),
      addedAt: 1,
      ...extra,
    })
    write("state/projects.json", {
      projects: [
        saved("open", { sessionId: "session-1" }),
        saved("shut", { closed: true, sessionId: "session-2" }),
      ],
    })
    const projects = new Projects(file, () => {})
    expect(projects.list(idle).map((p) => p.id)).toEqual(["open"])
    expect(projects.add(path.join(root, "shut"))).not.toBe("shut")
    projects.close()
  })

  it("hands over the session of the one conversation a project used to have, once", () => {
    write("thing/model.json", MANIFEST)
    const file = path.join(root, "state/projects.json")
    write("state/projects.json", {
      projects: [
        {
          id: "thing",
          path: path.join(root, "thing"),
          addedAt: 1,
          sessionId: "session-1",
        },
      ],
    })
    const projects = new Projects(file, () => {})
    expect(projects.takeSession("thing")).toBe("session-1")
    expect(projects.takeSession("thing")).toBeNull()
    expect(new Projects(file, () => {}).takeSession("thing")).toBeNull()
    expect(projects.takeSession("no-such-project")).toBeNull()
    projects.close()
  })

  it("clears away a project that came to nothing, and only that", () => {
    const file = path.join(root, "state/projects.json")
    const projects = new Projects(file, () => {})
    const dir = (name: string) => {
      fs.mkdirSync(path.join(root, name), { recursive: true })
      return path.join(root, name)
    }

    // made here and nothing put in it: the folder goes with the project
    const blank = projects.add(dir("made-blank"), { name: "Blank" })
    fs.writeFileSync(path.join(root, "made-blank/.DS_Store"), "")
    projects.remove(blank)
    expect(fs.existsSync(path.join(root, "made-blank"))).toBe(false)

    // made here, and something is in it: kept
    const filled = projects.add(dir("made-filled"), { name: "Filled" })
    write("made-filled/model.py", "")
    projects.remove(filled)
    expect(fs.existsSync(path.join(root, "made-filled/model.py"))).toBe(true)

    // an empty folder of the user's own is never deleted
    const theirs = projects.add(dir("their-empty"))
    projects.remove(theirs)
    expect(fs.existsSync(path.join(root, "their-empty"))).toBe(true)
    expect(projects.list(idle)).toEqual([])
    projects.close()
  })

  it("names a stand-in project after its model, and its folder to match", () => {
    const projects = new Projects(
      path.join(root, "state/projects.json"),
      () => {}
    )
    const start = path.join(root, "2026-10-05-2306-quiet-heron")
    fs.mkdirSync(start)
    const id = projects.add(start, { name: "Quiet heron", standIn: true })
    const moves: string[][] = []
    const christen = () =>
      projects.christen(id, (from, to) => moves.push([from, to]))
    const now = () => projects.list(idle).find((p) => p.id === id)!

    // nothing made yet: it keeps the stand-in
    christen()
    expect(now().name).toBe("Quiet heron")

    write("2026-10-05-2306-quiet-heron/build/enclose.model.json", {
      ...MANIFEST,
      title: "  Pill   box ",
    })
    projects.refresh(id)
    const revision = now().revision
    christen()
    expect(now().name).toBe("Pill box")
    expect(path.basename(now().path)).toMatch(
      /^\d{4}-\d\d-\d\d-\d{4}-pill-box$/
    )
    expect(fs.existsSync(start)).toBe(false)
    expect(
      fs.existsSync(path.join(now().path, "build/enclose.model.json"))
    ).toBe(true)
    // the model is the same one, in the same place within the folder: not reloaded
    expect(now().manifest).toBe("build/enclose.model.json")
    expect(now().revision).toBe(revision)
    expect(moves).toEqual([
      [fs.realpathSync(root) + "/2026-10-05-2306-quiet-heron", now().path],
    ])

    // it has its name now: a later title does not rename it again
    write(
      path.relative(root, path.join(now().path, "build/enclose.model.json")),
      {
        ...MANIFEST,
        title: "Something else",
      }
    )
    christen()
    expect(now().name).toBe("Pill box")
    expect(moves).toHaveLength(1)
    projects.close()
  })

  it("never renames a folder the app did not name", () => {
    const projects = new Projects(
      path.join(root, "state/projects.json"),
      () => {}
    )
    write("theirs/model.json", { ...MANIFEST, title: "A title" })
    const id = projects.add(path.join(root, "theirs"))
    projects.christen(id, () => {
      throw new Error("renamed")
    })
    expect(projects.list(idle)[0]).toMatchObject({ name: "theirs" })
    expect(fs.existsSync(path.join(root, "theirs/model.json"))).toBe(true)
    projects.close()
  })
})

describe("folderSize", () => {
  it("adds up every file, however deep", async () => {
    write("a.txt", "12345")
    write("one/b.txt", "123")
    write("one/two/c.txt", "12")
    expect(await folderSize(root)).toBe(10)
  })

  it("counts a link as itself, not as what it points at", async () => {
    write("big.txt", "x".repeat(1000))
    fs.symlinkSync(path.join(root, "big.txt"), path.join(root, "link"))
    const link = fs.lstatSync(path.join(root, "link")).size
    expect(await folderSize(root)).toBe(1000 + link)
  })

  it("is nothing for a folder that is empty, or not there", async () => {
    expect(await folderSize(root)).toBe(0)
    expect(await folderSize(path.join(root, "nowhere"))).toBe(0)
  })
})

describe("folderName", () => {
  const made = new Date(2026, 9, 5, 23, 6)

  it("puts when it was made first, then the name in lower case with dashes", () => {
    expect(folderName("Pill box", made)).toBe("2026-10-05-2306-pill-box")
    expect(folderName("  Desk   Clamp v2!  ", made)).toBe(
      "2026-10-05-2306-desk-clamp-v2"
    )
  })

  it("keeps nothing a folder name should not have", () => {
    expect(folderName("../odd:name/", made)).toBe("2026-10-05-2306-odd-name")
    expect(folderName("Café holder №2", made)).toBe(
      "2026-10-05-2306-cafe-holder-no2"
    )
  })

  it("keeps letters of other scripts, and has a name when given none", () => {
    expect(folderName("箱 1", made)).toBe("2026-10-05-2306-箱-1")
    expect(folderName("", made)).toBe("2026-10-05-2306-untitled")
    expect(folderName("!!!", made)).toBe("2026-10-05-2306-untitled")
  })
})

describe("Projects, of files being made a model of", () => {
  it("lists a project as being read from the first, then as what came of it", () => {
    let told = 0
    const projects = new Projects(path.join(root, "state.json"), () => told++)
    const dir = path.join(root, "made")
    fs.mkdirSync(dir)
    const id = projects.add(dir, { name: "Made", reading: true })
    const now = () => projects.list(() => []).find((p) => p.id === id)!
    expect(now().bringingIn).toEqual({ state: "working", done: 0, total: null })

    projects.report(id, { state: "working", done: 3, total: 7 })
    expect(now().bringingIn).toEqual({ state: "working", done: 3, total: 7 })

    // the build is through: its model is found without being looked for again
    write("made/build/enclose.model.json", MANIFEST)
    const before = told
    projects.report(id, null)
    expect(now()).toMatchObject({
      bringingIn: null,
      manifest: path.join("build", "enclose.model.json"),
    })
    expect(told).toBe(before + 1)
    projects.close()
  })
})

describe("Projects, of a model Claude is to look over", () => {
  const written = { title: "Made", files: ["source/made.step"] }

  it("waits to be looked over only once there is a model, and until it has been", () => {
    const file = path.join(root, "state.json")
    const projects = new Projects(file, () => {})
    const dir = path.join(root, "made")
    fs.mkdirSync(dir)
    const id = projects.add(dir, {
      name: "Made",
      reading: true,
      lookOver: written,
    })
    const now = () => projects.list(() => []).find((p) => p.id === id)!
    // nothing to look over yet
    expect(now().lookOver).toBeNull()
    write("made/build/enclose.model.json", MANIFEST)
    projects.report(id, null)
    expect(now().lookOver).toBe("wanted")
    projects.close()

    // it is still waiting when the app is next started
    const again = new Projects(file, () => {})
    expect(again.list(() => [])[0].lookOver).toBe("wanted")
    expect(again.get(id)?.lookOver).toEqual(written)

    // and is asked for once: what it was written from is handed over with that
    let told = 0
    const last = new Projects(file, () => told++)
    expect(last.lookedOver(id)).toEqual(written)
    expect(told).toBe(1)
    expect(last.list(() => [])[0].lookOver).toBeNull()
    expect(last.lookedOver(id)).toBeNull()
    expect(told).toBe(1)
    expect(new Projects(file, () => {}).get(id)?.lookOver).toBeUndefined()
    again.close()
    last.close()
  })

  it("asks it of no project that was not made of files", () => {
    const projects = new Projects(path.join(root, "state.json"), () => {})
    write("theirs/enclose.model.json", MANIFEST)
    const id = projects.add(path.join(root, "theirs"))
    expect(projects.list(() => [])[0].lookOver).toBeNull()
    expect(projects.lookedOver(id)).toBeNull()
    projects.close()
  })
})

describe("standInName", () => {
  it("is two plain words", async () => {
    const { standInName } = await import("./names")
    for (let i = 0; i < 50; i++)
      expect(standInName()).toMatch(/^[A-Z][a-z]+ [a-z]+$/)
  })
})
