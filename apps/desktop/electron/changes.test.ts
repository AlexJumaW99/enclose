import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { Changes } from "./changes"

let dir: string
let folder: string
let kept: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-changes-"))
  folder = path.join(dir, "project")
  kept = path.join(dir, "kept")
  fs.mkdirSync(folder)
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

/** Write a file of the project's, as a turn would: later than whatever was there. */
let clock = 1_700_000_000
function write(file: string, text: string) {
  const at = path.join(folder, file)
  fs.mkdirSync(path.dirname(at), { recursive: true })
  fs.writeFileSync(at, text)
  clock += 10
  fs.utimesSync(at, clock, clock)
}
const read = (file: string) => {
  try {
    return fs.readFileSync(path.join(folder, file), "utf8")
  } catch {
    return null
  }
}
const about = (what: string, conversationId = "c1") => ({
  conversationId,
  what,
})

/** A turn: the folder copied aside, something done in it, and what came of that kept. */
async function turn(changes: Changes, what: string, work: () => void) {
  const pending = await changes.before("p1", folder)
  if (!pending) throw new Error("not copied aside")
  work()
  return changes.after(pending, folder, about(what))
}

describe("Changes", () => {
  beforeEach(() => {
    write("model.py", "box(10)")
    write("build/model.json", '{"parts":["lid"]}')
    write("build/lid.glb", "LID")
    write("notes.txt", "keep me")
  })

  it("keeps what a turn wrote to, made and took away, and nothing it left alone", async () => {
    const changes = new Changes(kept)
    const change = await turn(changes, "Make it taller", () => {
      write("model.py", "box(20)")
      write("build/lid.glb", "TALLER LID")
      write("build/base.glb", "BASE")
      // written again by the build, with what was in it already
      write("build/model.json", '{"parts":["lid"]}')
      fs.rmSync(path.join(folder, "notes.txt"))
    })
    expect(change?.what).toBe("Make it taller")
    expect(change?.files.map((file) => file.path).sort()).toEqual([
      path.join("build", "base.glb"),
      path.join("build", "lid.glb"),
      "model.py",
      "notes.txt",
    ])
    expect(changes.last("p1").undo?.id).toBe(change?.id)
    expect(changes.last("p1").redo).toBeNull()
  })

  it("takes a change back, and puts it back again", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Make it taller", () => {
      write("model.py", "box(20)")
      write("build/lid.glb", "TALLER LID")
      write("build/extra/base.glb", "BASE")
      fs.rmSync(path.join(folder, "notes.txt"))
    })

    const undone = await changes.undo("p1", folder)
    expect(undone.ok).toBe(true)
    expect(read("model.py")).toBe("box(10)")
    expect(read("build/lid.glb")).toBe("LID")
    expect(read("notes.txt")).toBe("keep me")
    // what the turn made is gone, and the folder it made for it
    expect(read("build/extra/base.glb")).toBeNull()
    expect(fs.existsSync(path.join(folder, "build", "extra"))).toBe(false)
    expect(changes.last("p1").undo).toBeNull()
    expect(changes.last("p1").redo?.what).toBe("Make it taller")

    const redone = await changes.redo("p1", folder)
    expect(redone.ok).toBe(true)
    expect(read("model.py")).toBe("box(20)")
    expect(read("build/lid.glb")).toBe("TALLER LID")
    expect(read("build/extra/base.glb")).toBe("BASE")
    expect(read("notes.txt")).toBeNull()
    expect(changes.last("p1").undo?.what).toBe("Make it taller")
  })

  it("takes changes back one at a time, the latest first", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Taller", () => write("model.py", "box(20)"))
    await turn(changes, "Wider", () => write("model.py", "box(20, 30)"))
    expect((await changes.undo("p1", folder)).ok).toBe(true)
    expect(read("model.py")).toBe("box(20)")
    expect((await changes.undo("p1", folder)).ok).toBe(true)
    expect(read("model.py")).toBe("box(10)")
    expect(await changes.undo("p1", folder)).toEqual({
      ok: false,
      why: "nothing",
      files: [],
    })
    // and back again, in the order they were made
    expect((await changes.redo("p1", folder)).ok).toBe(true)
    expect(read("model.py")).toBe("box(20)")
    expect((await changes.redo("p1", folder)).ok).toBe(true)
    expect(read("model.py")).toBe("box(20, 30)")
  })

  it("keeps nothing of a turn that changed nothing", async () => {
    const changes = new Changes(kept)
    expect(await turn(changes, "What is this?", () => {})).toBeNull()
    expect(changes.last("p1").undo).toBeNull()
    expect(
      fs.readdirSync(path.join(kept, "p1")).filter((n) => n !== "index.json")
    ).toEqual([])
  })

  it("does not write over a file that has been changed since the turn", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Taller", () => {
      write("model.py", "box(20)")
      write("build/lid.glb", "TALLER LID")
    })
    write("model.py", "box(20)  # and a note of my own")
    expect(await changes.undo("p1", folder)).toEqual({
      ok: false,
      why: "changed",
      files: ["model.py"],
    })
    // nothing was done: not to that file, and not to the other
    expect(read("model.py")).toBe("box(20)  # and a note of my own")
    expect(read("build/lid.glb")).toBe("TALLER LID")
    expect(changes.last("p1").undo?.what).toBe("Taller")
  })

  it("does not put a change back over something done since it was taken back", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Taller", () => write("model.py", "box(20)"))
    await changes.undo("p1", folder)
    write("model.py", "box(12)")
    expect(await changes.redo("p1", folder)).toEqual({
      ok: false,
      why: "changed",
      files: ["model.py"],
    })
    expect(read("model.py")).toBe("box(12)")
  })

  it("lets go of what was taken back once a turn has changed something since", async () => {
    const changes = new Changes(kept)
    const first = await turn(changes, "Taller", () =>
      write("model.py", "box(20)")
    )
    await changes.undo("p1", folder)
    await turn(changes, "Wider", () => write("model.py", "box(10, 30)"))
    expect(changes.last("p1").redo).toBeNull()
    expect(changes.last("p1").undo?.what).toBe("Wider")
    expect(fs.existsSync(path.join(kept, "p1", first!.id))).toBe(false)
  })

  it("leaves alone what is not the project's own, and does not copy it", async () => {
    write(".git/HEAD", "ref: main")
    write("node_modules/three/index.js", "three")
    write("env/pyvenv.cfg", "home = /usr/bin")
    write("env/lib/site.py", "site")
    const changes = new Changes(kept)
    const change = await turn(changes, "Taller", () => {
      write("model.py", "box(20)")
      write(".git/HEAD", "ref: other")
      write("env/lib/site.py", "changed")
    })
    expect(change?.files.map((file) => file.path)).toEqual(["model.py"])
    await changes.undo("p1", folder)
    expect(read(".git/HEAD")).toBe("ref: other")
    expect(read("env/lib/site.py")).toBe("changed")
  })

  it("keeps what was done from one run of the app to the next", async () => {
    await turn(new Changes(kept), "Taller", () => write("model.py", "box(20)"))
    const again = new Changes(kept)
    expect(again.last("p1").undo?.what).toBe("Taller")
    expect((await again.undo("p1", folder)).ok).toBe(true)
    expect(read("model.py")).toBe("box(10)")
    expect(new Changes(kept).last("p1").redo?.what).toBe("Taller")
  })

  it("keeps only so many, and lets the oldest go", async () => {
    const changes = new Changes(kept)
    for (let n = 0; n < 14; n++)
      await turn(changes, `Change ${n}`, () => write("model.py", `box(${n})`))
    let taken = 0
    while ((await changes.undo("p1", folder)).ok) taken++
    expect(taken).toBe(12)
    expect(read("model.py")).toBe("box(1)")
  })

  it("says what Claude is to be told, once, and what has been put back since", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Taller", () => write("model.py", "box(20)"))
    expect(changes.toTell("p1", "c1")).toEqual({ undone: [], redone: [] })
    await changes.undo("p1", folder)
    // not in a conversation the turn was no part of
    expect(changes.toTell("p1", "c2")).toEqual({ undone: [], redone: [] })
    expect(changes.toTell("p1", "c1")).toEqual({
      undone: ["Taller"],
      redone: [],
    })
    expect(changes.toTell("p1", "c1")).toEqual({ undone: [], redone: [] })
    await changes.redo("p1", folder)
    expect(changes.toTell("p1", "c1")).toEqual({
      undone: [],
      redone: ["Taller"],
    })
    expect(changes.toTell("p1", "c1")).toEqual({ undone: [], redone: [] })
  })

  it("has nothing to tell of a change taken back and put back before anything was said", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Taller", () => write("model.py", "box(20)"))
    await changes.undo("p1", folder)
    await changes.redo("p1", folder)
    expect(changes.toTell("p1", "c1")).toEqual({ undone: [], redone: [] })
  })

  it("sees to the file it is told to last", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Taller", () => {
      write("build/model.json", '{"parts":["lid","base"]}')
      write("build/lid.glb", "TALLER LID")
      write("model.py", "box(20)")
    })
    await changes.undo("p1", folder, path.join("build", "model.json"))
    const written = (file: string) =>
      fs.statSync(path.join(folder, file)).mtimeMs
    expect(written("build/model.json")).toBeGreaterThanOrEqual(
      written("build/lid.glb")
    )
    expect(written("build/model.json")).toBeGreaterThanOrEqual(
      written("model.py")
    )
  })

  it("lets go of a copy put aside for a turn the app was quit in the middle of", async () => {
    const first = new Changes(kept)
    await turn(first, "Taller", () => write("model.py", "box(20)"))
    const left = await first.before("p1", folder)
    expect(fs.existsSync(path.join(kept, "p1", left!.id))).toBe(true)
    // the app comes up again, with that turn never having come to an end
    const again = new Changes(kept)
    expect(again.last("p1").undo?.what).toBe("Taller")
    expect(fs.existsSync(path.join(kept, "p1", left!.id))).toBe(false)
    expect((await again.undo("p1", folder)).ok).toBe(true)
  })

  it("does not take the copy for a turn under way for one left behind", async () => {
    const changes = new Changes(kept)
    const pending = await changes.before("p1", folder)
    // the project is looked at for the first time while the turn is going on
    expect(changes.last("p1").undo).toBeNull()
    write("model.py", "box(20)")
    expect((await changes.after(pending!, folder, about("Taller")))?.what).toBe(
      "Taller"
    )
    expect((await changes.undo("p1", folder)).ok).toBe(true)
    expect(read("model.py")).toBe("box(10)")
  })

  it("takes back only a conversation's own turns, where the folder is that conversation's alone", async () => {
    const changes = new Changes(kept)
    const turnOf = async (id: string, what: string, work: () => void) => {
      const pending = await changes.before("p1", folder)
      work()
      return changes.after(pending!, folder, about(what, id), id)
    }
    await turnOf("c1", "Taller", () => write("model.py", "box(20)"))
    await turnOf("c2", "A note", () => write("notes.txt", "other"))
    expect(changes.last("p1").undo?.what).toBe("A note")
    expect(changes.last("p1", "c1").undo?.what).toBe("Taller")

    expect((await changes.undo("p1", folder, null, "c1")).ok).toBe(true)
    expect(read("model.py")).toBe("box(10)")
    expect(read("notes.txt")).toBe("other")
    expect(changes.last("p1", "c1").undo).toBeNull()
    expect(changes.last("p1", "c1").redo?.what).toBe("Taller")
    expect(changes.last("p1", "c2").undo?.what).toBe("A note")
    expect(changes.last("p1", "c2").redo).toBeNull()

    // what another does since is not something it cannot be put back over
    await turnOf("c2", "More", () => write("notes.txt", "more"))
    expect(changes.last("p1", "c1").redo?.what).toBe("Taller")
    expect((await changes.redo("p1", folder, null, "c1")).ok).toBe(true)
    expect(read("model.py")).toBe("box(20)")
    expect(read("notes.txt")).toBe("more")
  })

  it("keeps as many turns for each conversation, where the folder is each one's alone", async () => {
    const changes = new Changes(kept)
    const turnOf = async (id: string, n: number) => {
      const pending = await changes.before("p1", folder)
      write("model.py", `box(${id}, ${n})`)
      return changes.after(pending!, folder, about(`${id} ${n}`, id), id)
    }
    await turnOf("c1", 0)
    for (let n = 0; n < 14; n++) await turnOf("c2", n)
    // the one of the first is still there, and of the second the last twelve
    expect(changes.last("p1", "c1").undo?.what).toBe("c1 0")
    let taken = 0
    while ((await changes.undo("p1", folder, null, "c2")).ok) taken++
    expect(taken).toBe(12)
  })

  it("forgets a project that is taken off the list", async () => {
    const changes = new Changes(kept)
    await turn(changes, "Taller", () => write("model.py", "box(20)"))
    changes.forget("p1")
    expect(changes.last("p1").undo).toBeNull()
    expect(fs.existsSync(path.join(kept, "p1"))).toBe(false)
  })
})
