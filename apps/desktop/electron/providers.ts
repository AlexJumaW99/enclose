// The agents the app can put a message to: Claude Code, Codex, Grok. Each is its maker's
// command-line agent, already installed on this machine and signed in there. This finds
// them, keeps what the user has chosen about each, and says what each is started with.
import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import {
  PROVIDERS,
  type ModelChoice,
  type Provider,
  type ProviderId,
  type ProviderSettings,
  type ProviderStatus,
} from "../shared/api"
import type { SettingsStore } from "./settings"

const run = promisify(execFile)

/** An agent as it is run: what to start, and with what around it. */
export type Launch = {
  path: string
  /** more to start it with, from what the user chose */
  args: string[]
  env: Record<string, string | undefined>
}

/** What an agent says of itself when it is asked. */
export type Looked = {
  /** where it says so itself, in place of what `--version` printed */
  version?: string | null
  signedIn: boolean | null
  account: string | null
  trouble: string | null
  models: ModelChoice[]
}

/** What each is called on a command line, and what it reads where its home is from. */
const CLI: Record<ProviderId, { command: string; home: string | null }> = {
  claude: { command: "claude", home: "CLAUDE_CONFIG_DIR" },
  codex: { command: "codex", home: "CODEX_HOME" },
  grok: { command: "grok", home: null },
}

// What a Claude Code session sets for the processes it starts. If this app is launched
// from inside one (a terminal in an editor, say), the agents it starts must not inherit
// them, or Claude Code would take itself for a child of that session.
const PARENT_SESSION = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_AGENT_SDK_VERSION",
  "CLAUDE_PID",
  "CLAUDE_EFFORT",
]

/** The environment to start anything with: ours, minus what belongs to a parent session. */
export function cleanEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env }
  for (const key of PARENT_SESSION) delete env[key]
  delete env.VITE_DEV_SERVER_URL
  return env
}

/** A path as it was typed, with the home folder written out. */
export const expandHome = (given: string) =>
  given === "~" || given.startsWith("~/") || given.startsWith("~\\")
    ? path.join(os.homedir(), given.slice(2))
    : given

/**
 * What is typed after a command's name, as the words a shell would make of it: split at
 * the spaces, but for what is in quotation marks, which is one word without them.
 */
export function splitArgs(typed: string): string[] {
  const words: string[] = []
  let word: string | null = null
  let quote: string | null = null
  for (let at = 0; at < typed.length; at++) {
    const char = typed[at]
    if (quote) {
      if (char === quote) quote = null
      else if (char === "\\" && quote === '"' && at + 1 < typed.length)
        word = (word ?? "") + typed[++at]
      else word = (word ?? "") + char
    } else if (char === '"' || char === "'") {
      quote = char
      word ??= ""
    } else if (/\s/.test(char)) {
      if (word !== null) words.push(word)
      word = null
    } else if (char === "\\" && at + 1 < typed.length) {
      word = (word ?? "") + typed[++at]
    } else word = (word ?? "") + char
  }
  if (word !== null) words.push(word)
  return words
}

function executable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function onPath(name: string): string | null {
  // a Windows command goes by one of several endings
  const names =
    process.platform === "win32" && !path.extname(name)
      ? [`${name}.exe`, `${name}.cmd`]
      : [name]
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue
    for (const one of names) {
      const file = path.join(dir, one)
      if (executable(file)) return file
    }
  }
  return null
}

/**
 * An app opened from the Dock or Finder gets a bare PATH, without the directories a
 * terminal adds - which is where `claude`, `python3` and the rest live. Ask the login
 * shell what PATH it would use, and adopt it. Once is enough.
 */
let adopted: Promise<void> | null = null
function adoptShellPath(): Promise<void> {
  adopted ??= (async () => {
    if (process.platform === "win32") return
    const shell = process.env.SHELL ?? "/bin/zsh"
    try {
      const { stdout } = await run(
        shell,
        ["-ilc", 'printf "__PATH__%s__PATH__" "$PATH"'],
        { timeout: 5000 }
      )
      const found = /__PATH__(.*)__PATH__/s.exec(stdout)?.[1]
      if (found) process.env.PATH = found
    } catch {
      // keep the PATH we were started with
    }
  })()
  return adopted
}

/** Where a command is: looked for on the PATH by its name, or taken for a path. */
export async function locate(command: string): Promise<string | null> {
  const given = expandHome(command)
  if (given.includes("/") || given.includes(path.sep))
    return executable(given) ? path.resolve(given) : null
  const file = onPath(given)
  if (file) return file
  await adoptShellPath()
  return onPath(given)
}

/** The version a command prints of itself, as far as it is one. */
async function versionOf(
  file: string,
  env: Record<string, string | undefined>
): Promise<string | null> {
  try {
    const { stdout, stderr } = await run(file, ["--version"], {
      timeout: 8000,
      env,
    })
    return (
      /\b(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\b/.exec(`${stdout}\n${stderr}`)?.[1] ??
      null
    )
  } catch {
    // it is there but would not report a version; still worth trying to run
    return null
  }
}

export type ProvidersDeps = {
  settings: SettingsStore
  /** each agent's own way of saying who is signed in to it and what models it has */
  look: Record<ProviderId, (launch: Launch) => Promise<Looked>>
  /** something of what is known of them changed: the window is to hear of it */
  onChange: () => void
}

export class Providers {
  private readonly deps: ProvidersDeps
  private statuses = new Map<ProviderId, ProviderStatus>()
  private models = new Map<ProviderId, ModelChoice[]>()
  /** what is being found out about each, one thing after another */
  private queues = new Map<ProviderId, Promise<void>>()
  /** how many things are yet to be found out about each */
  private waiting = new Map<ProviderId, number>()
  /**
   * Each has been looked for once: what is installed is known, and the PATH a terminal
   * would have has been taken up if it was needed to find them.
   */
  readonly found: Promise<void>

  constructor(deps: ProvidersDeps) {
    this.deps = deps
    this.found = Promise.all(
      PROVIDERS.map((id) => this.next(id, () => this.find(id)))
    ).then(() => {})
    // who is signed in and what models there are takes longer, and is asked after
    void this.found.then(() => {
      for (const id of PROVIDERS) void this.next(id, () => this.ask(id))
    })
  }

  /** One thing at a time is found out about an agent, in the order asked for. */
  private next(id: ProviderId, what: () => Promise<void>): Promise<void> {
    this.waiting.set(id, (this.waiting.get(id) ?? 0) + 1)
    const queued = (this.queues.get(id) ?? Promise.resolve())
      .then(what)
      .catch((error: unknown) => console.error(`[${id}]`, error))
      .then(() => {
        const left = (this.waiting.get(id) ?? 1) - 1
        this.waiting.set(id, left)
        // the last of it: it is no longer being looked at
        if (left === 0) this.deps.onChange()
      })
    this.queues.set(id, queued)
    return queued
  }

  private env(id: ProviderId, settings: ProviderSettings) {
    const env = cleanEnv()
    for (const { name, value } of settings.env) if (name) env[name] = value
    const home = CLI[id].home
    if (home && settings.home) env[home] = expandHome(settings.home)
    return env
  }

  /** Look for an agent: where it is, and what version. */
  private async find(id: ProviderId) {
    const settings = this.deps.settings.provider(id)
    let file = await locate(settings.binary || CLI[id].command)
    // Claude Code is run through its SDK, which wants the file itself
    if (file && id === "claude") file = fs.realpathSync(file)
    const version = file ? await versionOf(file, this.env(id, settings)) : null
    const was = this.statuses.get(id)
    this.statuses.set(id, {
      path: file,
      version,
      // what the same one said of its account stands until it is asked again
      signedIn: was?.path === file ? was.signedIn : null,
      account: was?.path === file ? was.account : null,
      trouble: null,
      checkedAt: Date.now(),
    })
    if (!file) this.models.delete(id)
    this.deps.onChange()
  }

  /** Ask an agent that is installed and switched on who is signed in, and for its models. */
  private async ask(id: ProviderId) {
    const launch = this.launch(id)
    const status = this.statuses.get(id)
    if (!launch || !status) return
    const looked = await this.deps.look[id](launch).catch(
      (error: unknown): Looked => ({
        signedIn: null,
        account: null,
        trouble: error instanceof Error ? error.message : String(error),
        models: [],
      })
    )
    // looked for again meanwhile, and found elsewhere or not at all
    if (this.statuses.get(id) !== status) return
    this.statuses.set(id, {
      ...status,
      version: looked.version ?? status.version,
      signedIn: looked.signedIn,
      account: looked.account,
      trouble: looked.trouble,
      checkedAt: Date.now(),
    })
    // one that would not say this time keeps what it said before
    if (looked.models.length > 0) this.models.set(id, looked.models)
    this.deps.onChange()
  }

  /** Each of them, as the window has it. */
  list(): Provider[] {
    return PROVIDERS.map((id) => ({
      id,
      settings: this.deps.settings.provider(id),
      status: this.statuses.get(id) ?? null,
      checking: (this.waiting.get(id) ?? 0) > 0,
      models: this.models.get(id) ?? [],
    }))
  }

  /** What to start an agent with: null if it is switched off, or is not installed. */
  launch(id: ProviderId): Launch | null {
    const settings = this.deps.settings.provider(id)
    const file = this.statuses.get(id)?.path
    if (!file || !settings.enabled) return null
    return {
      path: file,
      args: splitArgs(settings.args),
      env: this.env(id, settings),
    }
  }

  /** Whether there is any agent at all to put something to. */
  any(): boolean {
    return PROVIDERS.some((id) => this.launch(id) !== null)
  }

  /**
   * Change what is chosen about one. What only the window goes by (which models are
   * shown) is kept and no more; anything that changes what is run has it looked at again.
   */
  change(id: ProviderId, patch: unknown): Promise<void> {
    const was = this.deps.settings.provider(id)
    const now = this.deps.settings.setProvider(id, patch)
    this.deps.onChange()
    const same =
      was.enabled === now.enabled &&
      was.binary === now.binary &&
      was.home === now.home &&
      was.args === now.args &&
      JSON.stringify(was.env) === JSON.stringify(now.env)
    return same ? Promise.resolve() : this.check(id)
  }

  /** Look at one of them again, or at them all. */
  check(id?: ProviderId): Promise<void> {
    return Promise.all(
      (id ? [id] : PROVIDERS).map((one) =>
        this.next(one, async () => {
          await this.find(one)
          await this.ask(one)
        })
      )
    ).then(() => {})
  }
}
