import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { findModel, readBranch, resolveInside } from "./projects"

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
    write("cad-ai.json", {
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
