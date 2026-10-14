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
      analytics: true,
      versions: true,
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

  it("offers a newer version of one in use, puts it in the way it was installed, and looks again", async () => {
    // a Claude Code installed with the npm of a Node of its own
    const prefix = path.join(dir, "node")
    const pkg = path.join(prefix, "lib/node_modules/@anthropic-ai/claude-code")
    fs.mkdirSync(path.join(pkg, "bin"), { recursive: true })
    fs.mkdirSync(path.join(prefix, "bin"))
    fs.writeFileSync(path.join(prefix, "bin", "npm"), "", { mode: 0o755 })
    const claude = path.join(pkg, "bin", "claude")
    const says = (version: string) =>
      fs.writeFileSync(
        claude,
        `#!/bin/sh
echo "${version} (Claude Code)"
`,
        {
          mode: 0o755,
        }
      )
    says("2.1.296")
    process.env.PATH = dir
    process.env.SHELL = "/nonexistent"
    const settings = new SettingsStore(path.join(dir, "settings.json"), {
      projectsFolder: dir,
      lookOver: true,
      analytics: true,
      versions: true,
    })
    settings.setProvider("claude", { binary: claude })
    const ran: string[][] = []
    const providers = new Providers({
      settings,
      look: {
        claude: async () => ({
          signedIn: true,
          account: "Claude Max",
          trouble: null,
          models: [],
        }),
        codex: async () => ({
          signedIn: null,
          account: null,
          trouble: null,
          models: [],
        }),
        grok: async () => ({
          signedIn: null,
          account: null,
          trouble: null,
          models: [],
        }),
      },
      onChange: () => {},
      updates: {
        newest: async () => "2.1.299",
        run: async (command) => {
          ran.push([command.file, ...command.args])
          says("2.1.299")
          return { ok: true, output: "" }
        },
      },
    })
    await providers.found
    await settled(providers)
    const claudeOf = () => providers.list().find((one) => one.id === "claude")
    expect(claudeOf()).toMatchObject({
      update: {
        version: "2.1.299",
        command: "npm install -g @anthropic-ai/claude-code@latest",
      },
      updating: false,
    })

    expect(await providers.update("claude")).toEqual({
      outcome: "updated",
      version: "2.1.299",
    })
    // by the npm of its own Node, into that Node's folder
    const real = fs.realpathSync(prefix)
    expect(ran).toEqual([
      [
        path.join(real, "bin", "npm"),
        "install",
        "-g",
        "--prefix",
        real,
        "@anthropic-ai/claude-code@latest",
      ],
    ])
    expect(claudeOf()).toMatchObject({
      status: { version: "2.1.299" },
      update: null,
      updating: false,
    })
    // nothing newer is offered for one switched off
    await providers.change("claude", { enabled: false })
    expect(claudeOf()?.update).toBeNull()
  })
})
