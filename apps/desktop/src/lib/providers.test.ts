import { describe, expect, it } from "vitest"

import type { ModelChoice, Provider, ProviderSettings } from "@shared/api"
import {
  answering,
  listedModels,
  offeredModels,
  standing,
  usable,
} from "./providers"

const model = (id: string | null): ModelChoice => ({
  id,
  name: id ?? "Default",
  short: id ?? "Opus",
  detail: "",
  efforts: [],
})
const SETTINGS: ProviderSettings = {
  enabled: true,
  binary: "",
  home: "",
  args: "",
  env: [],
  hidden: [],
  favorites: [],
  custom: [],
}
const provider = (
  id: Provider["id"],
  more: Partial<Omit<Provider, "settings" | "status">> & {
    settings?: Partial<ProviderSettings>
    status?: Partial<NonNullable<Provider["status"]>> | null
  } = {}
): Provider => ({
  id,
  checking: false,
  models: [model(null), model("opus"), model("sonnet"), model("haiku")],
  ...more,
  settings: { ...SETTINGS, ...more.settings },
  status:
    more.status === null
      ? null
      : {
          path: `/bin/${id}`,
          version: "1.0.0",
          signedIn: true,
          account: "Max",
          trouble: null,
          checkedAt: 1,
          ...more.status,
        },
})

describe("offeredModels", () => {
  it("leads with leaving it to the agent, then favourites, and leaves out the hidden", () => {
    const one = provider("claude", {
      settings: {
        hidden: ["sonnet"],
        favorites: ["haiku", "sonnet"],
        custom: ["claude-next", "opus"],
      },
    })
    expect(offeredModels(one).map((m) => m.id)).toEqual([
      null,
      "haiku",
      "opus",
      "claude-next",
    ])
    // every one there is to list: its own, then what the user told it of, each once
    expect(listedModels(one).map((m) => m.id)).toEqual([
      "opus",
      "sonnet",
      "haiku",
      "claude-next",
    ])
  })

  it("is nothing while nothing is known of the agent", () => {
    expect(offeredModels(undefined)).toEqual([])
    expect(offeredModels(provider("grok", { models: [] }))).toEqual([])
  })
})

describe("answering", () => {
  const all = [
    provider("claude"),
    provider("codex", { settings: { enabled: false } }),
    provider("grok"),
  ]

  it("is the agent a conversation is had with, whatever is picked", () => {
    expect(answering(all, "claude", { provider: "grok" })).toBe("grok")
    expect(answering(all, "grok", { provider: "codex" })).toBe("codex")
  })

  it("is the one picked for a new conversation, if a message can be put to it", () => {
    expect(answering(all, "grok", null)).toBe("grok")
    expect(answering(all, "codex", null)).toBe("claude")
    expect(answering([all[1], all[2]], "claude", null)).toBe("grok")
  })

  it("stays with what is picked while none can be used, or none are known", () => {
    expect(answering([all[1]], "codex", null)).toBe("codex")
    expect(answering([], "grok", undefined)).toBe("grok")
  })
})

describe("standing", () => {
  it("says who is signed in", () => {
    expect(standing(provider("claude"))).toMatchObject({
      tone: "ok",
      headline: "Signed in · Max",
    })
    expect(
      standing(provider("grok", { status: { account: null } })).headline
    ).toBe("Signed in")
  })

  it("says what is wanting, and what to do about it", () => {
    expect(
      standing(provider("codex", { status: { signedIn: false } }))
    ).toEqual({
      tone: "warn",
      headline: "Not signed in",
      detail: "Run codex login in a terminal to sign in, then check again.",
    })
    expect(
      standing(
        provider("grok", {
          status: { signedIn: null, trouble: "Grok did not answer." },
        })
      )
    ).toEqual({
      tone: "warn",
      headline: "Needs attention",
      detail: "Grok did not answer.",
    })
    expect(
      standing(provider("codex", { status: { path: null } }))
    ).toMatchObject({ tone: "bad", headline: "Not installed" })
  })

  it("is quiet about one that is not in use, or is still being looked at", () => {
    const off = provider("codex", { settings: { enabled: false } })
    expect(standing(off)).toMatchObject({ tone: "off", headline: "Off" })
    expect(usable(off)).toBe(false)
    expect(
      standing(
        provider("codex", {
          settings: { enabled: false },
          status: { path: null },
        })
      )
    ).toMatchObject({ tone: "off", headline: "Not installed" })
    expect(standing(provider("grok", { status: null })).tone).toBe("wait")
    expect(
      standing(provider("grok", { checking: true, status: { signedIn: null } }))
        .headline
    ).toBe("Checking…")
  })
})
