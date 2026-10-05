// Finding the Claude Code already installed on this machine. The app has no login of its
// own: it runs that install, which carries whatever account the user signed in with.
import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"

import type { ClaudeStatus } from "../shared/api"

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
