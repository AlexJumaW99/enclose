import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { ThreadItem } from "../shared/api"
import {
  forgetConversations,
  newConversation,
  readConversations,
  writeConversation,
} from "./conversations"

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-conversations-"))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const said = (id: string, text: string, at = 1): ThreadItem => ({
  kind: "user",
  id,
  at,
  text,
  part: null,
})
const none = () => null

describe("conversations on disk", () => {
  it("keeps each of a project's conversations, and each project's apart", () => {
    const first = { ...newConversation(), items: [said("a", "A cube")] }
    const second = {
      ...newConversation(),
      sessionId: "session-2",
      items: [said("b", "A lid")],
    }
    writeConversation(dir, "p1", first)
    writeConversation(dir, "p1", second)
    writeConversation(dir, "p2", {
      ...newConversation(),
      items: [said("c", "A gear")],
    })

    const read = readConversations(dir, "p1", none)
    expect(read).toHaveLength(2)
    expect(read.find((c) => c.id === first.id)).toEqual(first)
    expect(read.find((c) => c.id === second.id)).toEqual(second)
    expect(readConversations(dir, "p2", none)).toHaveLength(1)
    expect(readConversations(dir, "p3", none)).toEqual([])
  })

  it("writes over a conversation that is carried on, rather than beside it", () => {
    const one = { ...newConversation(), items: [said("a", "A cube")] }
    writeConversation(dir, "p1", one)
    one.items.push(said("b", "With a hole"))
    one.sessionId = "session-1"
    writeConversation(dir, "p1", one)
    expect(readConversations(dir, "p1", none)).toEqual([one])
  })

  it("takes in the one conversation a project had before it could have more", () => {
    const items = [said("a", "A cube"), said("b", "With a hole")]
    fs.writeFileSync(path.join(dir, "p1.json"), JSON.stringify(items))

    const read = readConversations(dir, "p1", () => "session-1")
    expect(read).toEqual([
      {
        id: read[0].id,
        provider: "claude",
        sessionId: "session-1",
        guided: null,
        name: null,
        items,
        gist: null,
      },
    ])
    // moved, not copied: reading again finds the same one, not a second
    expect(fs.existsSync(path.join(dir, "p1.json"))).toBe(false)
    expect(readConversations(dir, "p1", none)).toEqual(read)
  })

  it("keeps the name a conversation was given", () => {
    const named = {
      ...newConversation(),
      name: "The lid",
      items: [said("a", "A cube")],
    }
    writeConversation(dir, "p1", named)
    expect(readConversations(dir, "p1", none)).toEqual([named])
  })

  it("keeps whose agent a conversation is had with, and takes one that says nothing of it for Claude Code's", () => {
    const groks = {
      ...newConversation("grok"),
      sessionId: "01a1",
      guided: "abc",
      items: [said("a", "A cube")],
    }
    writeConversation(dir, "p1", groks)
    expect(readConversations(dir, "p1", none)).toEqual([groks])

    // from before there was any other, or with something else written where it goes
    for (const provider of [undefined, "gemini", 3])
      fs.writeFileSync(
        path.join(dir, "p1", `${groks.id}.json`),
        JSON.stringify({ provider, sessionId: "s", items: groks.items })
      )
    expect(readConversations(dir, "p1", none)).toMatchObject([
      { provider: "claude", sessionId: "s", guided: null },
    ])
  })

  it("keeps what a message was summed up as, and drops what does not read as that", () => {
    const summed = {
      ...newConversation(),
      items: [said("a", "A cube")],
      gist: { of: "a", text: "A cube, summed up" },
    }
    writeConversation(dir, "p1", summed)
    expect(readConversations(dir, "p1", none)).toEqual([summed])
    fs.writeFileSync(
      path.join(dir, "p1", `${summed.id}.json`),
      JSON.stringify({ sessionId: null, items: summed.items, gist: { of: 3 } })
    )
    expect(readConversations(dir, "p1", none)).toEqual([
      { ...summed, gist: null },
    ])
  })

  it("makes no conversation of one in which nothing was said", () => {
    fs.writeFileSync(path.join(dir, "p1.json"), "[]")
    expect(readConversations(dir, "p1", () => "session-1")).toEqual([])
    expect(fs.existsSync(path.join(dir, "p1.json"))).toBe(false)
  })

  it("leaves alone what it cannot read", () => {
    fs.writeFileSync(path.join(dir, "p1.json"), "{ cut short")
    fs.mkdirSync(path.join(dir, "p1"))
    fs.writeFileSync(path.join(dir, "p1", "broken.json"), "{ cut short")
    fs.writeFileSync(path.join(dir, "p1", "notes.txt"), "not ours")
    expect(readConversations(dir, "p1", none)).toEqual([])
    expect(fs.readdirSync(path.join(dir, "p1")).sort()).toEqual([
      "broken.json",
      "notes.txt",
    ])
    expect(fs.existsSync(path.join(dir, "p1.json"))).toBe(true)
  })

  it("brings back what was in flight when the app closed as over", () => {
    writeConversation(dir, "p1", {
      ...newConversation(),
      items: [
        said("a", "A cube"),
        {
          kind: "tool",
          id: "t",
          at: 2,
          name: "Run",
          detail: "python3 model.py",
          state: "running",
        },
        { kind: "assistant", id: "s", at: 3, text: "The cu", streaming: true },
      ],
    })
    expect(readConversations(dir, "p1", none)[0].items.slice(1)).toMatchObject([
      { state: "failed" },
      { streaming: false },
    ])
  })

  it("forgets a project's conversations, and only that project's", () => {
    writeConversation(dir, "p1", {
      ...newConversation(),
      items: [said("a", "A cube")],
    })
    writeConversation(dir, "p2", {
      ...newConversation(),
      items: [said("b", "A lid")],
    })
    fs.writeFileSync(path.join(dir, "p1.json"), "[]")
    forgetConversations(dir, "p1")
    expect(fs.readdirSync(dir)).toEqual(["p2"])
    expect(readConversations(dir, "p2", none)).toHaveLength(1)
  })
})
