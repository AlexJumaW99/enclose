// What the user has chosen for the app as a whole, kept in one file in its data folder.
import fs from "node:fs"
import path from "node:path"

import {
  PROVIDERS,
  type EnvVar,
  type ProviderId,
  type ProviderSettings,
  type Settings,
} from "../shared/api"

/** A list of names, from what may be anything: the strings in it, each once. */
const names = (given: unknown): string[] => [
  ...new Set(
    (Array.isArray(given) ? given : [])
      .filter((one): one is string => typeof one === "string")
      .map((one) => one.trim())
      .filter(Boolean)
  ),
]

/** What is set in an agent's environment, from what may be anything. */
const variables = (given: unknown): EnvVar[] =>
  (Array.isArray(given) ? given : []).flatMap(
    (one: Partial<EnvVar> | null): EnvVar[] =>
      typeof one?.name === "string" && typeof one.value === "string"
        ? [{ name: one.name.trim(), value: one.value }]
        : []
  )

/**
 * What is chosen about an agent, from what was kept or what the window gave, either of
 * which may be anything: each thing as it should be, or as `otherwise` has it.
 */
export function providerSettings(
  given: unknown,
  otherwise: ProviderSettings
): ProviderSettings {
  const read = (given ?? {}) as Partial<Record<keyof ProviderSettings, unknown>>
  const text = (key: "binary" | "home" | "args") =>
    typeof read[key] === "string" ? read[key].trim() : otherwise[key]
  return {
    enabled:
      typeof read.enabled === "boolean" ? read.enabled : otherwise.enabled,
    binary: text("binary"),
    home: text("home"),
    args: text("args"),
    env: read.env === undefined ? otherwise.env : variables(read.env),
    hidden: read.hidden === undefined ? otherwise.hidden : names(read.hidden),
    favorites:
      read.favorites === undefined
        ? otherwise.favorites
        : names(read.favorites),
    custom: read.custom === undefined ? otherwise.custom : names(read.custom),
  }
}

/**
 * An agent as it is until something is chosen about it. Claude Code is what the app was
 * made around, and is on; the others are for whoever switches them on.
 */
export const providerDefaults = (id: ProviderId): ProviderSettings => ({
  enabled: id === "claude",
  binary: "",
  home: "",
  args: "",
  env: [],
  hidden: [],
  favorites: [],
  custom: [],
})

/**
 * Keeps a secret so that the file it is written in does not give it away: the system's
 * own keeping, where there is one. What is set in an agent's environment is often a key.
 */
export type Vault = {
  seal(text: string): string
  unseal(sealed: string): string
}

type Saved = Partial<Settings> & {
  providers?: Partial<Record<ProviderId, unknown>>
}

export class SettingsStore {
  private readonly file: string
  private readonly defaults: Settings
  private readonly vault: Vault | null
  private saved: Saved = {}

  constructor(file: string, defaults: Settings, vault: Vault | null = null) {
    this.file = file
    this.defaults = defaults
    this.vault = vault
    try {
      const read: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
      if (typeof read === "object" && read !== null) this.saved = read
    } catch {
      // first run, or a file that is not JSON: the defaults stand
    }
  }

  get(): Settings {
    const folder = this.saved.projectsFolder
    const lookOver = this.saved.lookOver
    return {
      projectsFolder:
        typeof folder === "string" && folder
          ? folder
          : this.defaults.projectsFolder,
      lookOver:
        typeof lookOver === "boolean" ? lookOver : this.defaults.lookOver,
    }
  }

  set(patch: Partial<Settings>): Settings {
    this.saved = { ...this.saved, ...patch }
    this.write()
    return this.get()
  }

  /** What is kept about the agents, as it is kept: one that is none of them left out. */
  private kept(): Partial<Record<ProviderId, unknown>> {
    const { providers } = this.saved
    if (typeof providers !== "object" || providers === null) return {}
    return Object.fromEntries(
      PROVIDERS.flatMap((id) =>
        providers[id] === undefined ? [] : [[id, providers[id]]]
      )
    )
  }

  /** What is chosen about one of the agents. */
  provider(id: ProviderId): ProviderSettings {
    const kept = this.kept()[id] as { env?: unknown } | undefined
    const env = (Array.isArray(kept?.env) ? kept.env : []).map(
      (one: { name?: unknown; value?: unknown; sealed?: unknown } | null) => {
        if (typeof one?.sealed !== "string") return one
        try {
          return { name: one.name, value: this.vault?.unseal(one.sealed) ?? "" }
        } catch {
          // kept by a system that will not give it back: it has to be given again
          return { name: one.name, value: "" }
        }
      }
    )
    return providerSettings({ ...kept, env }, providerDefaults(id))
  }

  /** Change what is chosen about one, in as much as `patch` says anything of it. */
  setProvider(id: ProviderId, patch: unknown): ProviderSettings {
    const next = providerSettings(patch, this.provider(id))
    const { vault } = this
    this.saved = {
      ...this.saved,
      providers: {
        ...this.kept(),
        [id]: {
          ...next,
          env: next.env.map(({ name, value }) =>
            vault && value
              ? { name, sealed: vault.seal(value) }
              : { name, value }
          ),
        },
      },
    }
    this.write()
    return next
  }

  private write() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(this.file, JSON.stringify(this.saved, null, 2))
  }
}
