import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { Provider } from "../shared/api"
import { expandHome, Providers, splitArgs, type Looked } from "./providers"
import { SettingsStore } from "./settings"

describe("splitArgs", () => {
  it("is the words a shell would make of what was typed", () => {
    expect(splitArgs("")).toEqual([])
    expect(splitArgs("  --chrome  ")).toEqual(["--chrome"])
    expect(splitArgs("--model opus -c 'a b' --x=\"c d\"")).toEqual([
      "--model",
      "opus",
      "-c",
      "a b",
      "--x=c d",
    ])
    expect(splitArgs('-c key="va\\"lue" a\\ b ""')).toEqual([
      "-c",
      'key=va"lue',
      "a b",
      "",
    ])
  })
})

describe("expandHome", () => {
  it("writes the home folder out, where a path begins with it", () => {
    expect(expandHome("~/.codex")).toBe(path.join(os.homedir(), ".codex"))
    expect(expandHome("~")).toBe(os.homedir())
    expect(expandHome("/opt/~/x")).toBe("/opt/~/x")
    expect(expandHome("~other/x")).toBe("~other/x")
  })
})

describe("Providers", () => {
  let dir: string
  let was: string | undefined
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-providers-"))
    was = process.env.PATH
  })
  afterEach(() => {
    process.env.PATH = was
    fs.rmSync(dir, { recursive: true, force: true })
  })

  /** A command that says it is some version, and what it was started with. */
  const command = (name: string, version: string) => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, `#!/bin/sh\necho "${name} ${version} (build 1)"\n`, {
      mode: 0o755,
    })
    return file
  }
  const settled = (providers: Providers) =>
    new Promise<void>((resolve) => {
      const look = () =>
        providers.list().some((one) => one.checking)
          ? setTimeout(look, 10)
          : resolve()
      look()
    })

  it("finds each where it is, asks the ones in use about themselves, and says how to start them", async () => {
    command("claude", "2.1.0")
    const grok = command("grok-nightly", "1.0.50")
    // (a PATH with nothing else on it: what is installed on this machine is not found)
    process.env.PATH = dir
    process.env.SHELL = "/nonexistent"
    const settings = new SettingsStore(path.join(dir, "settings.json"), {
      projectsFolder: dir,
      lookOver: true,
    })
    settings.setProvider("grok", {
      enabled: true,
      binary: grok,
      args: "--debug 'two words'",
      env: [{ name: "XAI_API_KEY", value: "xai-123" }],
    })
    const asked: string[] = []
    const looked = (models: number): Looked => ({
      signedIn: true,
      account: "Someone",
      trouble: null,
      models: Array.from({ length: models }, (_, index) => ({
        id: index === 0 ? null : `m${index}`,
        name: `M${index}`,
        short: `M${index}`,
        detail: "",
        efforts: [],
      })),
    })
    let changes = 0
    const providers = new Providers({
      settings,
      look: {
        claude: async () => (asked.push("claude"), looked(2)),
        codex: async () => (asked.push("codex"), looked(1)),
        grok: async (launch) => {
          asked.push(`grok ${launch.args.join("|")} ${launch.env.XAI_API_KEY}`)
          throw new Error("Grok did not answer.")
        },
      },
      onChange: () => changes++,
    })
    await providers.found
    await settled(providers)

    const by = Object.fromEntries(
      providers.list().map((one) => [one.id, one])
    ) as Record<string, Provider>
    expect(by.claude.status).toMatchObject({
      path: fs.realpathSync(path.join(dir, "claude")),
      version: "2.1.0",
      signedIn: true,
      account: "Someone",
      trouble: null,
    })
    expect(by.claude.models).toHaveLength(2)
    // not installed, and off: nothing is asked of it
    expect(by.codex.status).toMatchObject({ path: null, version: null })
    expect(by.codex.models).toEqual([])
    // found where the user said, and what went wrong in asking it is said
    expect(by.grok.status).toMatchObject({
      path: grok,
      version: "1.0.50",
      signedIn: null,
      trouble: "Grok did not answer.",
    })
    expect(asked.sort()).toEqual(["claude", "grok --debug|two words xai-123"])
    expect(changes).toBeGreaterThan(0)

    expect(providers.launch("claude")).toMatchObject({
      path: fs.realpathSync(path.join(dir, "claude")),
      args: [],
    })
    expect(providers.launch("codex")).toBeNull()
    expect(providers.any()).toBe(true)

    // switched off, it is not something to start: and it is not asked again
    await providers.change("claude", { enabled: false })
    expect(providers.launch("claude")).toBeNull()
    expect(asked.filter((one) => one === "claude")).toHaveLength(1)
    // what only the window goes by changes nothing that is run
    await providers.change("grok", { hidden: ["m1"], favorites: ["m2"] })
    expect(asked).toHaveLength(2)
    expect(settings.provider("grok")).toMatchObject({
      hidden: ["m1"],
      favorites: ["m2"],
      binary: grok,
    })
    // given a home of its own, it is started with that, and asked again
    await providers.change("claude", { enabled: true, home: "~/elsewhere" })
    expect(providers.launch("claude")?.env.CLAUDE_CONFIG_DIR).toBe(
      path.join(os.homedir(), "elsewhere")
    )
    expect(asked.filter((one) => one === "claude")).toHaveLength(2)
  })
})
