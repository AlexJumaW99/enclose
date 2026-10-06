import { describe, expect, it } from "vitest"

import type { ConversationSummary } from "@shared/api"
import { stackOf } from "./conversations"

const DAY = 86_400_000
const NOW = 100 * DAY

/** A conversation last touched so many days ago. */
const left = (
  id: string,
  days: number,
  status: ConversationSummary["status"] = "idle"
): ConversationSummary => ({
  id,
  title: `About ${id}`,
  status,
  since: null,
  lastMessage: null,
  updatedAt: NOW - days * DAY,
})

/** A layout by its ids: the card, what is under it, and what the panel shows. */
const laid = (
  conversations: ConversationSummary[],
  picked?: string | null,
  settleDays = 3
) => {
  const { cover, under, open } = stackOf(conversations, picked, settleDays, NOW)
  return [cover?.id ?? null, under.map((c) => c.id), open?.id ?? null]
}

describe("stackOf", () => {
  it("offers a new conversation where there has been none", () => {
    expect(laid([])).toEqual([null, [], null])
  })

  it("puts the latest on the card and the earlier ones under it", () => {
    expect(laid([left("c", 0.1), left("b", 1), left("a", 9)])).toEqual([
      "c",
      ["b", "a"],
      "c",
    ])
  })

  it("settles the latest once it has been left alone long enough", () => {
    expect(laid([left("b", 2.9), left("a", 9)])).toEqual(["b", ["a"], "b"])
    expect(laid([left("b", 3.1), left("a", 9)])).toEqual([
      null,
      ["b", "a"],
      null,
    ])
  })

  it("settles after as many days as it is told to", () => {
    expect(laid([left("a", 5)], undefined, 7)).toEqual(["a", [], "a"])
    expect(laid([left("a", 5)], undefined, 1)).toEqual([null, ["a"], null])
  })

  it("never settles one that Claude is still at work on", () => {
    expect(laid([left("a", 4, "working")])).toEqual(["a", [], "a"])
    expect(laid([left("a", 4, "asking")])).toEqual(["a", [], "a"])
  })

  it("shows an earlier one that is turned to, and leaves the card as it is", () => {
    expect(laid([left("c", 0.1), left("b", 1), left("a", 9)], "a")).toEqual([
      "c",
      ["b", "a"],
      "a",
    ])
    // one that has settled can be turned to as well
    expect(laid([left("b", 5), left("a", 9)], "b")).toEqual([
      null,
      ["b", "a"],
      "b",
    ])
  })

  it("puts a new one on the card when one is asked for, over the latest", () => {
    expect(laid([left("b", 0.1), left("a", 9)], null)).toEqual([
      null,
      ["b", "a"],
      null,
    ])
  })

  it("goes by the card when what was turned to is no longer there", () => {
    expect(laid([left("b", 0.1), left("a", 9)], "gone")).toEqual([
      "b",
      ["a"],
      "b",
    ])
  })
})
