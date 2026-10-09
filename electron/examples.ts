// Starting from an example. The app comes with projects to try things on, in examples/.
// They are the app's own files, so one is never opened where it is: it is copied into a
// folder where new projects go, and that copy is the user's to change.
import fs from "node:fs"
import path from "node:path"

import { SCRIPT } from "./imports"
import { folderName, makeFolder } from "./projects"

/** What is never copied: what a build or a Mac leaves lying in a folder. */
const LEFT_BEHIND = new Set(["__pycache__", ".DS_Store"])

/**
 * An example's model.py finds the exporter in the app, two folders up from it. A project
 * has its own copy beside its model.py, which Python finds with nothing said: the line
 * that points at the app comes out.
 */
export function ownExporter(script: string): string {
  return script.replace(/^sys\.path\.insert\(.*"kit"\)\)\r?\n/m, "")
}

/** The app's library of screws, beside its exporter: what a model that has screws reads. */
const SCREWS = "screws.py"
const USES_SCREWS = /^(?:from screws import|import screws)\b/m

/**
 * Make a project of an example, in `into`, and return where it is. The example is
 * copied, its model with it if it has been built, and the copy gets the app's exporter
 * (`kit`) beside its model.py as any project has, and the app's screws where its model
 * is made with them.
 */
export function startFrom(
  example: string,
  name: string,
  into: string,
  kit: string,
  now = new Date()
): string {
  const dir = makeFolder(into, folderName(name, now))
  try {
    fs.cpSync(example, dir, {
      recursive: true,
      // where the disk can, a copy that shares the original's blocks: no wait, no room
      mode: fs.constants.COPYFILE_FICLONE,
      filter: (from) => !LEFT_BEHIND.has(path.basename(from)),
    })
    fs.copyFileSync(kit, path.join(dir, "enclose.py"))
    const script = path.join(dir, SCRIPT)
    if (fs.existsSync(script)) {
      const written = fs.readFileSync(script, "utf8")
      fs.writeFileSync(script, ownExporter(written))
      if (USES_SCREWS.test(written))
        fs.copyFileSync(
          path.join(path.dirname(kit), SCREWS),
          path.join(dir, SCREWS)
        )
    }
  } catch (error) {
    // half a project is no project: the folder was made a moment ago, and is all copies
    fs.rmSync(dir, { recursive: true, force: true })
    throw error
  }
  return dir
}
