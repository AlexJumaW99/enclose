// The git the app runs (dugite, in node_modules/dugite/git), made ready to go into the
// app for one kind of Mac: fetched for it, since dugite fetches only the one the build
// runs on, and without what the app has no use for: Git Credential Manager, a .NET app
// of 117 MB that asks people for passwords. The app gives git what it needs itself.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const DUGITE = resolve(ROOT, "node_modules/dugite")
const CORE = resolve(DUGITE, "git/libexec/git-core")

/** What of git-core is Git Credential Manager's: its program, its runtime, its words. */
const MANAGERS = (name) =>
  /\.(dll|dylib)$/.test(name) ||
  name.startsWith("git-credential-manager") ||
  name === "createdump" ||
  name === "uninstall.sh" ||
  /^[a-z]{2}(-[A-Za-z]+)?$/.test(name)

/** Fetch git for `arch` ("arm64" or "x64"), and take out what is not wanted of it. */
export function prepareGit(arch) {
  execFileSync(process.execPath, [resolve(DUGITE, "script/download-git.js")], {
    cwd: DUGITE,
    env: { ...process.env, npm_config_arch: arch },
    stdio: "inherit",
  })
  for (const name of fs.readdirSync(CORE))
    if (MANAGERS(name))
      fs.rmSync(resolve(CORE, name), { recursive: true, force: true })
}
