// The git the app runs: its own, with Git LFS, which it has beside it (dugite), and not
// whatever the machine has or lacks. Nobody is asked anything by it: what it needs to
// be told, the app tells it.
import { exec } from "dugite"

import type { Git } from "./backup"

/** What every run of it is given: no prompt, and nothing of the user's kept from it. */
const QUIET = {
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
}

export const git: Git = async (args, cwd, env = {}) => {
  // a password asked for is never kept by whatever keeps the user's own
  const done = await exec(["-c", "credential.helper=", ...args], cwd, {
    env: { ...QUIET, ...env },
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    code: done.exitCode,
    stdout: String(done.stdout),
    stderr: String(done.stderr),
  }
}
