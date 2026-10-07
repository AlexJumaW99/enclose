// Run from a checkout, the app is Electron's own copy of itself, and a Mac takes the name
// in the menu bar from that copy, whatever the app calls itself once it is running. So
// the copy is told the app's name before it is started, by the dev loop and `npm start`.
// (An app made into a package carries its own name, and needs none of this.)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import electron from "electron"

const { productName } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
)

export function nameElectron() {
  if (process.platform !== "darwin") return
  // <copy>.app/Contents/MacOS/Electron is what gets run; the name is in Contents/Info.plist
  const plist = path.join(path.dirname(electron), "../Info.plist")
  const plutil = (...args) =>
    execFileSync("plutil", [...args, plist], { encoding: "utf8" }).trim()
  try {
    let renamed = false
    for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
      if (plutil("-extract", key, "raw", "-o", "-") === productName) continue
      plutil("-replace", key, "-string", productName)
      renamed = true
    }
    // the system remembers what it read of an app until the app itself looks changed
    if (renamed) {
      const bundle = path.join(path.dirname(plist), "..")
      fs.utimesSync(bundle, new Date(), new Date())
    }
  } catch (error) {
    // a name is not worth failing to start over
    console.warn(
      `[name] Electron keeps its own name in the menu bar: ${error.message}`
    )
  }
}
