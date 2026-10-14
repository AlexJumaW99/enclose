import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { newer, newestOf, updateCommand, wayOf } from "./updates"

describe("newer", () => {
  it("compares versions a number at a time", () => {
    expect(newer("2.1.296", "2.1.299")).toBe(true)
    expect(newer("2.1.299", "2.1.296")).toBe(false)
    expect(newer("0.99.0", "0.162.1")).toBe(true)
    expect(newer("1.0.52", "1.0.52")).toBe(false)
    expect(newer("v1.2", "1.2.1")).toBe(true)
  })

  it("takes a release for newer than what led up to it", () => {
    expect(newer("1.2.0-beta.1", "1.2.0")).toBe(true)
    expect(newer("1.2.0", "1.2.0-beta.1")).toBe(false)
    expect(newer("1.1.9", "1.2.0-beta.1")).toBe(true)
  })
})

describe("wayOf", () => {
  const home = "/Users/someone"

  it("knows Homebrew's, and has its Claude Code follow npm's stable release", () => {
    expect(
      wayOf("claude", "/opt/homebrew/Caskroom/claude-code/2.1.287/claude", home)
    ).toEqual({ kind: "brew", cask: "claude-code", channel: "stable" })
    expect(
      wayOf(
        "claude",
        "/opt/homebrew/Caskroom/claude-code@latest/2.1.299/claude",
        home
      )
    ).toEqual({ kind: "brew", cask: "claude-code@latest", channel: "latest" })
    expect(
      wayOf("codex", "/opt/homebrew/Caskroom/codex/0.162.1/codex", home)
    ).toEqual({ kind: "brew", cask: "codex", channel: "latest" })
  })

  it("knows an npm's by the folder it is in, whichever Node that is", () => {
    expect(
      wayOf(
        "claude",
        `${home}/.nvm/versions/node/v24.18.0/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`,
        home
      )
    ).toEqual({
      kind: "npm",
      prefix: `${home}/.nvm/versions/node/v24.18.0`,
      channel: "latest",
    })
    expect(
      wayOf(
        "codex",
        "/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js",
        home
      )
    ).toMatchObject({ kind: "npm", prefix: "/opt/homebrew" })
  })

  it("knows the makers' own installers", () => {
    expect(
      wayOf("claude", `${home}/.local/share/claude/versions/2.1.299`, home)
    ).toEqual({ kind: "own", channel: "latest" })
    expect(wayOf("grok", `${home}/.grok/bin/grok`, home)).toMatchObject({
      kind: "own",
    })
    expect(
      wayOf("codex", `${home}/.codex/packages/standalone/codex`, home)
    ).toMatchObject({ kind: "installer" })
    expect(wayOf("codex", `${home}/.local/bin/codex`, home)).toMatchObject({
      kind: "installer",
    })
  })

  it("does not guess at one put in some other way", () => {
    expect(wayOf("claude", "/usr/local/bin/claude", home)).toBeNull()
    expect(wayOf("codex", "/somewhere/codex", home)).toBeNull()
  })
})

describe("updateCommand", () => {
  let dir: string
  beforeEach(() => {
    dir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "enclose-updates-"))
    )
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it("runs an agent's own updater, by the file that was found", () => {
    expect(
      updateCommand(
        "grok",
        "/x/.grok/bin/grok",
        { kind: "own", channel: "latest" },
        null
      )
    ).toEqual({
      file: "/x/.grok/bin/grok",
      args: ["update"],
      said: "grok update",
    })
  })

  it("runs Homebrew's where there is one", () => {
    const way = {
      kind: "brew",
      cask: "claude-code",
      channel: "stable",
    } as const
    expect(
      updateCommand("claude", "/c", way, "/opt/homebrew/bin/brew")
    ).toEqual({
      file: "/opt/homebrew/bin/brew",
      args: ["upgrade", "--cask", "claude-code"],
      said: "brew upgrade --cask claude-code",
    })
    expect(updateCommand("claude", "/c", way, null)).toBeNull()
  })

  it("runs the npm of the Node it was installed with, by that Node, into its folder", () => {
    fs.mkdirSync(path.join(dir, "bin"))
    fs.writeFileSync(path.join(dir, "bin", "npm"), "", { mode: 0o755 })
    const way = { kind: "npm", prefix: dir, channel: "latest" } as const
    expect(updateCommand("claude", "/c", way, null)).toEqual({
      file: path.join(dir, "bin", "npm"),
      args: [
        "install",
        "-g",
        "--prefix",
        dir,
        "@anthropic-ai/claude-code@latest",
      ],
      said: "npm install -g @anthropic-ai/claude-code@latest",
      first: path.join(dir, "bin"),
    })
    // with no npm where it was installed, there is nothing to run
    const elsewhere = {
      kind: "npm",
      prefix: path.join(dir, "gone"),
      channel: "latest",
    } as const
    expect(updateCommand("claude", "/c", elsewhere, null)).toBeNull()
  })

  it("runs Codex's installer again for one it put in, and nothing for one it cannot tell", () => {
    expect(
      updateCommand(
        "codex",
        "/c",
        { kind: "installer", channel: "latest" },
        null
      )
    ).toMatchObject({
      file: "/bin/sh",
      said: "curl -fsSL https://chatgpt.com/codex/install.sh | sh",
    })
    expect(updateCommand("codex", "/c", null, null)).toBeNull()
  })
})

describe("newestOf", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("reads npm's release for those on npm, and asks again only when it is to", async () => {
    const asked: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(url)
        return new Response(
          JSON.stringify({
            stable: "2.1.287",
            latest: "2.1.299",
            next: "2.1.299",
          })
        )
      })
    )
    const brew = {
      kind: "brew",
      cask: "claude-code",
      channel: "stable",
    } as const
    const npm = { kind: "npm", prefix: "/p", channel: "latest" } as const
    expect(await newestOf("claude", "/c", brew, {}, true)).toBe("2.1.287")
    expect(await newestOf("claude", "/c", npm, {}, true)).toBe("2.1.299")
    // what it said is taken for an hour, unless it is to be asked afresh
    expect(await newestOf("claude", "/c", npm, {}, false)).toBe("2.1.299")
    expect(asked).toEqual([
      "https://registry.npmjs.org/-/package/@anthropic-ai/claude-code/dist-tags",
      "https://registry.npmjs.org/-/package/@anthropic-ai/claude-code/dist-tags",
    ])
  })

  it("knows of nothing newer while npm cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline")
      })
    )
    expect(
      await newestOf(
        "codex",
        "/c",
        { kind: "npm", prefix: "/p", channel: "latest" },
        {},
        true
      )
    ).toBeNull()
  })

  it("asks Grok itself, which knows the release it follows", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "enclose-grok-"))
    const grok = path.join(dir, "grok")
    fs.writeFileSync(
      grok,
      `#!/bin/sh\n[ "$1 $2 $3" = "update --check --json" ] && echo '{"currentVersion":"1.0.50","latestVersion":"1.0.52","updateAvailable":true}'\n`,
      { mode: 0o755 }
    )
    try {
      expect(
        await newestOf(
          "grok",
          grok,
          { kind: "own", channel: "latest" },
          process.env,
          true
        )
      ).toBe("1.0.52")
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
