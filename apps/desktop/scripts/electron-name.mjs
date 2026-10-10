// Run from a checkout, the app is Electron's own copy of itself, and a Mac takes the
// app's name from that copy, whatever the app calls itself once it is running: the name
// in the menu bar from what the copy says it is called, and the name under its icon in
// the Dock from what the copy's own folder is called. So the dev loop and `npm start`
// run a copy of that copy, which is called what the app is and says so. It is made once
// for each Electron that is installed, beside the other things that are made from what
// is in node_modules, and on a Mac's own disk it takes no room of its own.
// (An app made into a package carries its own name, and needs none of this.)
//
// The copy is not called quite what the app is: where the app's name says how far along
// it is ("Enclose (Alpha)"), the copy's says that it is the one being worked on
// ("Enclose (Dev)"). And it has an icon of its own (icons/icon-dev.icns, which `npm run
// icons` makes): the app's mark on another colour. A Mac that is asked for the app by
// name finds this copy beside the one that is installed, and they are told apart by both.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import electron from "electron"

const { productName: installed } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
)
/**
 * What the app is called as it is run from a checkout: its name, and that it is the one
 * being worked on, in place of how far along it is. (electron/main.ts says the same
 * where the app says what it is called.)
 */
const productName = `${installed.replace(/\s*\(.*\)$/, "")} (Dev)`
/** the icon of the app as it is run from a checkout */
const ICON = fileURLToPath(new URL("../icons/icon-dev.icns", import.meta.url))

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
  // which Electron it was made from, what it was called and what its icon was: when any
  // of them is no longer so, it is made again
  const from = path.join(kept, "made-from")
  try {
    const icon = createHash("sha1").update(fs.readFileSync(ICON)).digest("hex")
    const now = `${fs.readFileSync(path.join(theirs, "../version"), "utf8").trim()} ${productName} ${icon}`
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
    // its icon, in place of Electron's, under the name the copy already asks for it by
    const asked = execFileSync(
      "plutil",
      ["-extract", "CFBundleIconFile", "raw", plist],
      { encoding: "utf8" }
    ).trim()
    fs.copyFileSync(ICON, path.join(ours, "Contents/Resources", asked))
    fs.writeFileSync(from, now)
    return run
  } catch (error) {
    // a name is not worth failing to start over
    console.warn(`[name] the app runs under Electron's name: ${error.message}`)
    return electron
  }
}
