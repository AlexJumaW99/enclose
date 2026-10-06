import { describe, expect, it } from "vitest"

import type { ThreadItem } from "@shared/api"
import { inBlocks } from "./steps"

const user = (id: string, at = 0): ThreadItem => ({
  kind: "user",
  id,
  at,
  text: "Make a cube",
  part: null,
})
const says = (id: string, at = 0): ThreadItem => ({
  kind: "assistant",
  id,
  at,
  text: "Done.",
  streaming: false,
})
const step = (
  id: string,
  state: "running" | "done" | "failed" = "done",
  at = 0
) =>
  ({
    kind: "tool",
    id,
    at,
    name: "Run",
    detail: "python3 model.py",
    state,
  }) satisfies ThreadItem
const asked = (
  id: string,
  state: "pending" | "allowed" | "denied"
): ThreadItem => ({
  kind: "permission",
  id,
  at: 0,
  title: "Run this command?",
  detail: "python3 model.py",
  canAlways: false,
  state,
})

/** What each block is, in a word: a stretch of steps is the ids of its steps. */
const shape = (items: ThreadItem[]) =>
  inBlocks(items).map((block) =>
    block.kind === "steps" ? block.steps.map((s) => s.id).join("+") : block.kind
  )

describe("inBlocks", () => {
  it("gathers the steps between two things said into one", () => {
    expect(
      shape([user("u"), step("a"), step("b"), step("c"), says("s")])
    ).toEqual(["user", "a+b+c", "assistant"])
  })

  it("starts again after anything said", () => {
    const blocks = inBlocks([step("a"), says("s"), step("b"), step("c")])
    expect(blocks.map((block) => block.id)).toEqual(["a", "s", "b"])
  })

  it("keeps a stretch its name as it grows", () => {
    const before = inBlocks([user("u"), step("a", "running")])
    const after = inBlocks([user("u"), step("a"), step("b", "running")])
    expect(after[1].id).toBe(before[1].id)
  })

  it("stops for a question that is waiting on an answer", () => {
    expect(shape([step("a", "running"), asked("q", "pending")])).toEqual([
      "a",
      "permission",
    ])
  })

  it("carries on through a question that was answered yes", () => {
    expect(
      shape([
        step("a"),
        asked("q", "allowed"),
        step("b"),
        asked("r", "allowed"),
      ])
    ).toEqual(["a+b"])
  })

  it("leaves a no where it was said", () => {
    expect(
      shape([step("a", "failed"), asked("q", "denied"), step("b")])
    ).toEqual(["a", "permission", "b"])
  })

  it("times a stretch from when Claude was asked to what came after it", () => {
    const blocks = inBlocks([
      user("u", 1_000),
      step("a", "done", 9_000),
      step("b", "done", 20_000),
      says("s", 31_000),
    ])
    expect(blocks[1]).toMatchObject({ kind: "steps", took: 30_000 })
  })

  it("times it from its first step when something was said before it", () => {
    const blocks = inBlocks([
      user("u", 1_000),
      says("s", 2_000),
      step("a", "done", 5_000),
      step("b", "done", 6_000),
      says("t", 12_000),
    ])
    expect(blocks[2]).toMatchObject({ kind: "steps", took: 7_000 })
  })

  it("has no time for a stretch that nothing has come after", () => {
    const blocks = inBlocks([user("u", 1_000), step("a", "done", 5_000)])
    expect(blocks[1]).toMatchObject({ kind: "steps", took: null })
  })

  it("has nothing to show for nothing", () => {
    expect(inBlocks([])).toEqual([])
  })
})
