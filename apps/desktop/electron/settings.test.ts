import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { providerDefaults, providerSettings, SettingsStore } from "./settings"

let dir: string
let file: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-settings-"))
  file = path.join(dir, "settings.json")
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})
const DEFAULTS = {
  projectsFolder: "/projects",
  lookOver: true,
  analytics: true,
}

describe("providerSettings", () => {
  it("starts with Claude Code on and the others off", () => {
    expect(providerDefaults("claude").enabled).toBe(true)
    expect(providerDefaults("codex").enabled).toBe(false)
    expect(providerDefaults("grok").enabled).toBe(false)
  })

  it("takes what is as it should be, and leaves the rest as it was", () => {
    const was = { ...providerDefaults("codex"), binary: "codex-beta" }
    expect(
      providerSettings(
        {
          enabled: "yes",
          binary: 7,
          home: "  ~/.codex-work ",
          env: [
            { name: " OPENAI_API_KEY ", value: " sk " },
            { name: "X" },
            null,
          ],
          hidden: ["a", "a", " ", 3, "b"],
        },
        was
      )
    ).toEqual({
      ...was,
      home: "~/.codex-work",
      env: [{ name: "OPENAI_API_KEY", value: " sk " }],
      hidden: ["a", "b"],
    })
    expect(providerSettings(null, was)).toEqual(was)
  })
})

describe("SettingsStore", () => {
  it("keeps what is chosen about each agent, apart from the rest", () => {
    const store = new SettingsStore(file, DEFAULTS)
    store.set({ lookOver: false })
    store.setProvider("grok", { enabled: true, custom: ["grok-build"] })
    store.setProvider("grok", { hidden: ["grok-4.5"] })

    const again = new SettingsStore(file, DEFAULTS)
    expect(again.get()).toEqual({
      projectsFolder: "/projects",
      lookOver: false,
      analytics: true,
    })
    expect(again.provider("grok")).toEqual({
      ...providerDefaults("grok"),
      enabled: true,
      custom: ["grok-build"],
      hidden: ["grok-4.5"],
    })
    expect(again.provider("claude")).toEqual(providerDefaults("claude"))
  })

  it("keeps the count of how the app is used switched off", () => {
    new SettingsStore(file, DEFAULTS).set({ analytics: false })
    expect(new SettingsStore(file, DEFAULTS).get().analytics).toBe(false)
  })

  it("reads a file from before there were agents to choose about", () => {
    fs.writeFileSync(file, JSON.stringify({ projectsFolder: "/mine" }))
    const store = new SettingsStore(file, DEFAULTS)
    expect(store.provider("claude")).toEqual(providerDefaults("claude"))
    store.setProvider("codex", { enabled: true })
    expect(new SettingsStore(file, DEFAULTS).get().projectsFolder).toBe("/mine")
  })

  it("has the system keep what is set in an environment, where it can", () => {
    const vault = {
      seal: (text: string) => Buffer.from(text).toString("hex"),
      unseal: (sealed: string) => Buffer.from(sealed, "hex").toString(),
    }
    const store = new SettingsStore(file, DEFAULTS, vault)
    store.setProvider("codex", {
      env: [
        { name: "OPENAI_API_KEY", value: "sk-secret" },
        { name: "EMPTY", value: "" },
      ],
    })
    // changing another agent leaves it kept as it was
    store.setProvider("claude", { args: "--chrome" })
    const written = fs.readFileSync(file, "utf8")
    expect(written).not.toContain("sk-secret")
    expect(written).toContain("OPENAI_API_KEY")

    expect(
      new SettingsStore(file, DEFAULTS, vault).provider("codex").env
    ).toEqual([
      { name: "OPENAI_API_KEY", value: "sk-secret" },
      { name: "EMPTY", value: "" },
    ])
    // a system that will not give it back: the name stands, the value is to be given again
    const broken = {
      ...vault,
      unseal: () => {
        throw new Error("no keychain")
      },
    }
    expect(
      new SettingsStore(file, DEFAULTS, broken).provider("codex").env
    ).toEqual([
      { name: "OPENAI_API_KEY", value: "" },
      { name: "EMPTY", value: "" },
    ])
  })

  it("keeps it in the file itself where the system has nowhere to", () => {
    const store = new SettingsStore(file, DEFAULTS)
    store.setProvider("grok", {
      env: [{ name: "XAI_API_KEY", value: "xai-1" }],
    })
    expect(new SettingsStore(file, DEFAULTS).provider("grok").env).toEqual([
      { name: "XAI_API_KEY", value: "xai-1" },
    ])
  })
})
