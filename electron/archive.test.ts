import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { filesIn, pack, tar, unpack, untar, type Filed } from "./archive"

let root: string
const write = (file: string, content = "") => {
  const full = path.join(root, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}
const read = (files: Filed[]) =>
  files.map((file) => [file.path, file.data.toString()])

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cad-ai-test-")))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("filesIn", () => {
  it("finds every file, however deep, and leaves what a build leaves lying", () => {
    write("model.py", "m")
    write("build/step/base.step", "s")
    write("build/base.glb", "g")
    write("__pycache__/model.pyc", "x")
    write("build/.DS_Store", "x")
    expect(read(filesIn(root))).toEqual([
      ["build/base.glb", "g"],
      ["build/step/base.step", "s"],
      ["model.py", "m"],
    ])
  })
})

describe("tar", () => {
  const files = [
    { path: "model.py", data: Buffer.from("print(1)\n") },
    { path: "build/base.glb", data: Buffer.alloc(1300, 7) },
    { path: "empty", data: Buffer.alloc(0) },
  ]

  it("gives back the files it was made of", () => {
    const back = untar(tar(files))
    expect(back.map((file) => file.path)).toEqual(files.map((f) => f.path))
    for (const [index, file] of back.entries())
      expect(file.data.equals(files[index].data)).toBe(true)
  })

  it("makes the same archive of the same files", () => {
    expect(tar(files).equals(tar(files))).toBe(true)
  })

  it("will not take a name longer than a header holds", () => {
    expect(() =>
      tar([{ path: "a".repeat(101), data: Buffer.alloc(0) }])
    ).toThrow(/too long/)
  })
})

describe("untar", () => {
  /** An archive of one file, named as nothing that packs honestly would name it. */
  const named = (name: string) => {
    const archive = tar([
      { path: "x".repeat(name.length), data: Buffer.from("!") },
    ])
    archive.write(name, 0)
    return archive
  }

  it.each(["../outside", "/etc/passwd", "a/../../b", "a\\b", "a//b"])(
    "will not unpack %s",
    (name) => {
      expect(() => untar(named(name))).toThrow(/out of place/)
    }
  )

  it("says so when the archive stops before its file does", () => {
    const whole = tar([{ path: "a", data: Buffer.alloc(2000, 1) }])
    expect(() => untar(whole.subarray(0, 1024))).toThrow(/cut short/)
  })

  it("takes files only", () => {
    const archive = tar([
      { path: "folder", data: Buffer.alloc(0) },
      { path: "folder/a", data: Buffer.from("a") },
    ])
    // the first is marked as a folder, as other packers mark theirs
    archive.write("5", 156)
    expect(read(untar(archive))).toEqual([["folder/a", "a"]])
  })
})

describe("pack", () => {
  it("makes of a folder an archive that unpacks to its files", async () => {
    write("model.py", "m")
    write("build/base.glb", "g".repeat(5000))
    write(".DS_Store", "x")
    const packed = pack(root)
    expect(packed.length).toBeLessThan(5000)
    expect(read(await unpack(packed))).toEqual([
      ["build/base.glb", "g".repeat(5000)],
      ["model.py", "m"],
    ])
  })

  it("says so when what it is given is no archive", async () => {
    await expect(unpack(Buffer.from("not one"))).rejects.toThrow()
  })
})
