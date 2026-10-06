import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  findModel,
  folderName,
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
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cad-ai-test-")))
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

  it("still reads the file a project wrote before the app was called Enclose", () => {
    write("deep/custom.json", MANIFEST)
    write("cad-ai.json", { model: "deep/custom.json", build: "make" })
    expect(findModel(root)).toEqual({
      manifest: path.join(root, "deep/custom.json"),
      build: "make",
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
  const idle = () => ({
    status: "idle" as const,
    since: null,
    updatedAt: null,
    lastMessage: null,
  })

  it("remembers a closed project, so adding its folder again is the same project", () => {
    write("thing/model.json", MANIFEST)
    const file = path.join(root, "state/projects.json")
    const projects = new Projects(file, () => {})
    const id = projects.add(path.join(root, "thing"), "The Thing")
    projects.setSession(id, "session-1")
    expect(projects.list(idle).map((p) => [p.id, p.name])).toEqual([
      [id, "The Thing"],
    ])

    projects.remove(id)
    expect(projects.list(idle)).toEqual([])
    expect(projects.get(id)).toBeNull()
    // and it stays closed across a restart
    expect(new Projects(file, () => {}).list(idle)).toEqual([])

    // and comes back under the name it was given, which is not its folder's
    expect(projects.add(path.join(root, "thing"))).toBe(id)
    expect(projects.get(id)).toMatchObject({ sessionId: "session-1" })
    expect(projects.list(idle)[0]).toMatchObject({
      id,
      name: "The Thing",
      manifest: "model.json",
    })
    // a folder that is only opened goes by its own name
    write("other/model.json", MANIFEST)
    const other = projects.add(path.join(root, "other"))
    expect(projects.list(idle).find((p) => p.id === other)?.name).toBe("other")
    projects.close()
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
