// Run from a checkout, the app is Electron's own copy of itself, and a Mac takes the
// app's name from that copy, whatever the app calls itself once it is running: the name
// in the menu bar from what the copy says it is called, and the name under its icon in
// the Dock from what the copy's own folder is called. So the dev loop and `npm start`
// run a copy of that copy, which is called what the app is and says so. It is made once
// for each Electron that is installed, beside the other things that are made from what
// is in node_modules, and on a Mac's own disk it takes no room of its own.
// (An app made into a package carries its own name, and needs none of this.)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import electron from "electron"

const { productName } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
)

/**
 * Whether anything is running out of a folder: an app that is not to be taken from under
 * itself. By what is run, and not by what it was run with: a shell that only names the
 * folder is not running out of it.
 */
function running(folder) {
  try {
    return execFileSync("ps", ["-axww", "-o", "comm="], { encoding: "utf8" })
      .split("\n")
      .some((command) => command.trim().startsWith(`${folder}/`))
  } catch {
    return false
  }
}

/** What to run for the app: Electron, under the app's own name where a system goes by that. */
export function namedElectron() {
  if (process.platform !== "darwin") return electron
  // <copy>.app/Contents/MacOS/Electron is what gets run
  const theirs = path.resolve(path.dirname(electron), "../..")
  const kept = fileURLToPath(
    new URL("../node_modules/.cache/enclose", import.meta.url)
  )
  const ours = path.join(kept, `${productName}.app`)
  const run = path.join(ours, path.relative(theirs, electron))
  // which Electron it was made from, and what it was called: when either is no longer
  // so, it is made again
  const from = path.join(kept, "made-from")
  try {
    const now = `${fs.readFileSync(path.join(theirs, "../version"), "utf8").trim()} ${productName}`
    const made = fs.existsSync(from) ? fs.readFileSync(from, "utf8") : null
    if (made === now && fs.existsSync(run)) return run
    if (running(kept)) {
      console.warn(
        `[name] ${productName} is running from the copy that is to be made again: this once it is Electron's own that is run, under Electron's name`
      )
      return electron
    }
    fs.rmSync(kept, { recursive: true, force: true })
    fs.mkdirSync(kept, { recursive: true })
    // links and all, as it stands
    execFileSync("cp", ["-cR", theirs, ours])
    const plist = path.join(ours, "Contents/Info.plist")
    for (const key of ["CFBundleName", "CFBundleDisplayName"])
      execFileSync("plutil", ["-replace", key, "-string", productName, plist])
    fs.writeFileSync(from, now)
    return run
  } catch (error) {
    // a name is not worth failing to start over
    console.warn(`[name] the app runs under Electron's name: ${error.message}`)
    return electron
  }
}
