// A project's own tools: what its user had made to work the model with, each a file of
// JavaScript in tools/ at the top of its folder (see shared/tool-format.ts). The app's
// own process only finds them and hands the window what is written in them: they are
// run there, shut away from the rest of the window.
import fs from "node:fs"
import path from "node:path"

import type { ToolSource } from "../shared/api"
import {
  MOST_TOOL_BYTES,
  MOST_TOOLS,
  TOOL_FILE,
  TOOLS_FOLDER,
} from "../shared/tool-format"

/** The files in a folder's tools/ that are tools, by name: in the order they are shown. */
export function findTools(root: string): string[] {
  let names: string[]
  try {
    names = fs.readdirSync(path.join(root, TOOLS_FOLDER))
  } catch {
    return []
  }
  return names
    .filter((name) => TOOL_FILE.test(name))
    .sort()
    .slice(0, MOST_TOOLS)
}

/** A folder's tools as they are written. One that cannot be read, or is too long, is left out. */
export function readTools(root: string): ToolSource[] {
  return findTools(root).flatMap((name) => {
    const file = path.join(root, TOOLS_FOLDER, name)
    try {
      if (fs.statSync(file).size > MOST_TOOL_BYTES) return []
      return [
        {
          id: TOOL_FILE.exec(name)![1],
          file: `${TOOLS_FOLDER}/${name}`,
          source: fs.readFileSync(file, "utf8"),
        },
      ]
    } catch {
      return []
    }
  })
}
