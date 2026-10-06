// What the user has chosen for the app as a whole, kept in one file in its data folder.
import fs from "node:fs"
import path from "node:path"

import type { Settings } from "../shared/api"

export class SettingsStore {
  private readonly file: string
  private readonly defaults: Settings
  private saved: Partial<Settings> = {}

  constructor(file: string, defaults: Settings) {
    this.file = file
    this.defaults = defaults
    try {
      const read: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
      if (typeof read === "object" && read !== null) this.saved = read
    } catch {
      // first run, or a file that is not JSON: the defaults stand
    }
  }

  get(): Settings {
    const folder = this.saved.projectsFolder
    return {
      projectsFolder:
        typeof folder === "string" && folder
          ? folder
          : this.defaults.projectsFolder,
    }
  }

  set(patch: Partial<Settings>): Settings {
    this.saved = { ...this.saved, ...patch }
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(this.file, JSON.stringify(this.saved, null, 2))
    return this.get()
  }
}
