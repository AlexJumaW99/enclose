// Finding the Claude Code already installed on this machine. The app has no login of its
// own: it runs that install, which carries whatever account the user signed in with.
import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import {
  query,
  type ModelInfo,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk"

import { EFFORTS, type ClaudeStatus, type ModelChoice } from "../shared/api"

const run = promisify(execFile)

// What a Claude Code session sets for the processes it starts. If this app is launched
// from inside one (a terminal in an editor, say), the Claude it starts must not inherit
// them, or it would take itself for a child of that session.
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

/** The environment to start Claude Code with: ours, minus what belongs to a parent session. */
/**
 * Where Claude Code keeps what it knows of a folder: the conversations had there, and
 * the notes it has made about the project. It files them under the folder's path.
 */
const storeOf = (dir: string) =>
  path.join(
    process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"),
    "projects",
    dir.replace(/[^a-zA-Z0-9]/g, "-")
  )

/**
 * A project's folder has been renamed: take what Claude Code keeps about it along, so
 * that its notes are still the project's. (A conversation can be carried on either way:
 * Claude Code finds it by its id.) If this cannot be done, nothing is lost by it.
 */
export function followRename(from: string, to: string) {
  try {
    const [was, is] = [storeOf(from), storeOf(to)]
    if (fs.existsSync(was) && !fs.existsSync(is)) fs.renameSync(was, is)
  } catch {
    // left where it was
  }
}

export function claudeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env }
  for (const key of PARENT_SESSION) delete env[key]
  delete env.VITE_DEV_SERVER_URL
  return env
}

function onPath(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue
    const file = path.join(dir, name)
    try {
      fs.accessSync(file, fs.constants.X_OK)
      return file
    } catch {
      // not in this directory
    }
  }
  return null
}

/**
 * An app opened from the Dock or Finder gets a bare PATH, without the directories a
 * terminal adds - which is where `claude`, `python3` and the rest live. Ask the login
 * shell what PATH it would use, and adopt it.
 */
async function adoptShellPath(): Promise<void> {
  if (process.platform === "win32") return
  const shell = process.env.SHELL ?? "/bin/zsh"
  try {
    const { stdout } = await run(
      shell,
      ["-ilc", 'printf "__PATH__%s__PATH__" "$PATH"'],
      {
        timeout: 5000,
      }
    )
    const found = /__PATH__(.*)__PATH__/s.exec(stdout)?.[1]
    if (found) process.env.PATH = found
  } catch {
    // keep the PATH we were started with
  }
}

export async function findClaude(): Promise<ClaudeStatus> {
  const name = process.platform === "win32" ? "claude.exe" : "claude"
  let file = onPath(name)
  if (!file) {
    await adoptShellPath()
    file = onPath(name)
  }
  if (!file) return { path: null, version: null }

  const real = fs.realpathSync(file)
  let version: string | null = null
  try {
    const { stdout } = await run(real, ["--version"], {
      timeout: 8000,
      env: claudeEnv(),
    })
    version = stdout.trim().split(/\s+/)[0] || null
  } catch {
    // it is there but would not report a version; still worth trying to run
  }
  return { path: real, version }
}

/** What Claude Code says of its models, as the app offers them. */
export function modelChoices(rows: ModelInfo[]): ModelChoice[] {
  const choices = rows.map((row): ModelChoice => {
    const standing = row.value === "default"
    // the default is one of the models, which the list also has under its own name
    const itself = standing
      ? rows.find(
          (other) =>
            other !== row &&
            other.resolvedModel !== undefined &&
            other.resolvedModel === row.resolvedModel
        )
      : undefined
    return {
      id: standing ? null : row.value,
      name: row.displayName,
      short: itself?.displayName ?? row.displayName,
      detail: row.description,
      efforts: EFFORTS.filter(
        (effort) =>
          row.supportsEffort && row.supportedEffortLevels?.includes(effort)
      ),
    }
  })
  // there is always the choice of leaving it to Claude Code
  if (choices.length > 0 && !choices.some((choice) => choice.id === null))
    choices.unshift({
      id: null,
      name: "Default",
      short: "Default",
      detail: "The model Claude Code is set to run",
      efforts: [],
    })
  return choices
}

/** How long Claude Code is given to say what models it has. */
const MODELS_TIMEOUT_MS = 20_000

/**
 * The models the installed Claude Code offers the account it is signed in to. It is
 * asked through a session that is given nothing to answer, and ended once it has said.
 * None, if it is not installed or would not say.
 */
export async function listModels(claude: ClaudeStatus): Promise<ModelChoice[]> {
  if (!claude.path) return []
  const abort = new AbortController()
  const gaveUp = new Promise<never>((_, reject) =>
    abort.signal.addEventListener("abort", () => reject(new Error("ended")), {
      once: true,
    })
  )
  // nothing is ever said to it: the session is only there to be asked
  const nothing: AsyncIterable<SDKUserMessage> = {
    [Symbol.asyncIterator]: () => ({
      next: () =>
        gaveUp.catch(() => ({ done: true as const, value: undefined })),
    }),
  }
  const timer = setTimeout(() => abort.abort(), MODELS_TIMEOUT_MS)
  try {
    const session = query({
      prompt: nothing,
      options: {
        cwd: os.tmpdir(),
        pathToClaudeCodeExecutable: claude.path,
        env: claudeEnv(),
        abortController: abort,
        settingSources: ["user"],
      },
    })
    return modelChoices(await Promise.race([session.supportedModels(), gaveUp]))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
    abort.abort()
  }
}
