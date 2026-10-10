// Reference scenes: things of a known real size that the view draws round a model, so
// that how big the model is can be seen. A desk for it to stand on, a room to stand in.
//
// The app has some of its own. Each is drawn in code the way a project's model is, by a
// reference.py in kit/scenes/<name>/, and what that writes is kept with the app (see
// scripts/scenes.mjs). A project can have one of its own, built the same way in its own
// folder, which is then the one its model is shown in.
import fs from "node:fs"
import path from "node:path"

import {
  CONFIG_NAMES,
  REFERENCE_FOLDER,
  REFERENCE_NAME,
} from "../shared/manifest-format"

/** One of the app's own scenes. */
export type AppScene = {
  /** what it is known by, which is what its folder is called: "table" */
  id: string
  /** what the list of scenes calls it */
  name: string
  /** what kind of thing it is for, in a few words: what an agent chooses among them by */
  suits: string
  /** the script that draws it, which a project starts its own from */
  script: string
  /** the folder its manifest and meshes are in */
  dir: string
  /** its manifest, parsed and not yet checked: the window does that */
  manifest: unknown
}

const MAX_BYTES = 1_000_000

/** A scene's manifest as it is written, or null if the file is not one. */
export function readScene(file: string): Record<string, unknown> | null {
  try {
    if (fs.statSync(file).size > MAX_BYTES) return null
    const json: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
    const parts = (json as { parts?: unknown } | null)?.parts
    return Array.isArray(parts) &&
      parts.length > 0 &&
      typeof (parts[0] as { file?: unknown } | null)?.file === "string"
      ? (json as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** How big a model a scene is for, at the most, as one number: none said is any size. */
function room(manifest: Record<string, unknown>): number {
  const upTo = manifest.upTo
  return Array.isArray(upTo) &&
    upTo.length === 3 &&
    upTo.every((n) => typeof n === "number" && n > 0)
    ? (upTo as number[]).reduce((all, n) => all * n, 1)
    : Infinity
}

/**
 * The app's own scenes, as they are kept in a folder: from the one for the smallest
 * things to the one for the biggest, which is the order they are listed in and the order
 * a model is tried in them by its size.
 */
export function appScenes(dir: string): AppScene[] {
  let names: string[]
  try {
    names = fs.readdirSync(dir).sort()
  } catch {
    return []
  }
  return (
    names
      // a name is part of an address the window loads from: nothing else is one
      .filter((name) => /^[a-z0-9-]+$/.test(name))
      .flatMap((id) => {
        const inside = path.join(dir, id, REFERENCE_FOLDER)
        const manifest = readScene(path.join(inside, REFERENCE_NAME))
        if (!manifest) return []
        const text = (key: string) =>
          typeof manifest[key] === "string" ? manifest[key] : ""
        return [
          {
            scene: {
              id,
              name: text("name") || id,
              suits: text("suits"),
              script: path.join(dir, id, "reference.py"),
              dir: inside,
              manifest,
            },
            room: room(manifest),
          },
        ]
      })
      .sort((a, b) => a.room - b.room)
      .map(({ scene }) => scene)
  )
}

/**
 * Where a folder keeps a reference scene of its own, if it has one: where its
 * enclose.json says ({ "reference": "path/to/enclose.reference.json" }), or else in
 * reference/ at the top of it.
 */
export function findReference(root: string): string | null {
  for (const name of CONFIG_NAMES) {
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(root, name), "utf8")
      ) as { reference?: unknown }
      if (typeof config.reference === "string") {
        const file = path.resolve(root, config.reference)
        if (readScene(file)) return file
      }
      break
    } catch {
      // no config by this name, or not valid JSON: try the next, then the usual place
    }
  }
  const file = path.join(root, REFERENCE_FOLDER, REFERENCE_NAME)
  return readScene(file) ? file : null
}
