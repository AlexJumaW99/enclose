// The agents a message can be put to, as the window knows them: what each is called, how
// it stands, and which of its models are offered where one is chosen.
import type {
  ConversationSummary,
  ModelChoice,
  Provider,
  ProviderId,
} from "@shared/api"

/**
 * What each is called: by its name, by the command-line agent that is run, and by what
 * is typed to run that, which is also how its sign-in is begun.
 */
export const PROVIDER_WORDS: Record<
  ProviderId,
  { name: string; cli: string; command: string; signIn: string }
> = {
  claude: {
    name: "Claude",
    cli: "Claude Code",
    command: "claude",
    signIn: "claude",
  },
  codex: {
    name: "Codex",
    cli: "Codex",
    command: "codex",
    signIn: "codex login",
  },
  grok: { name: "Grok", cli: "Grok", command: "grok", signIn: "grok login" },
}

/** Whether a message can be put to one: it is switched on, and installed. */
export const usable = (provider: Provider) =>
  provider.settings.enabled && provider.status?.path != null

/** Stable while nothing is known of the agents, or one has no models. */
const NO_MODELS: ModelChoice[] = []

/** A model the user told an agent of, by what the agent knows it as. */
const added = (id: string): ModelChoice => ({
  id,
  name: id,
  short: id,
  detail: "Added in Settings",
  efforts: [],
})

/**
 * Every model there is to list for an agent, but for the choice of leaving it to the
 * agent: its own, then those the user told it of.
 */
export function listedModels(provider: Provider): ModelChoice[] {
  const own = provider.models.filter((model) => model.id !== null)
  return [
    ...own,
    ...provider.settings.custom
      .filter((id) => !own.some((model) => model.id === id))
      .map(added),
  ]
}

/**
 * The models offered where one is chosen: leaving it to the agent, then the favourites,
 * then the rest, without those the user has hidden.
 */
export function offeredModels(provider: Provider | undefined): ModelChoice[] {
  if (!provider) return NO_MODELS
  const { hidden, favorites } = provider.settings
  const shown = listedModels(provider).filter(
    (model) => !hidden.includes(model.id ?? "")
  )
  const first = (model: ModelChoice) => favorites.includes(model.id ?? "")
  return [
    ...provider.models.filter((model) => model.id === null),
    ...shown.filter(first),
    ...shown.filter((model) => !first(model)),
  ]
}

/**
 * The agent that answers in a conversation: the one it is had with; or, of one not yet
 * begun, the one picked, if a message can be put to it, and failing that the first that
 * one can be put to.
 */
export function answering(
  providers: Provider[],
  picked: ProviderId,
  conversation: Pick<ConversationSummary, "provider"> | null | undefined
): ProviderId {
  if (conversation) return conversation.provider
  const ready = providers.filter(usable)
  return (ready.find((one) => one.id === picked) ?? ready[0])?.id ?? picked
}

/** How an agent stands, as a line says it: what, and how much it wants looking at. */
export type Standing = {
  /** off: not in use. wait: being looked at. ok, warn, bad: as they sound. */
  tone: "off" | "wait" | "ok" | "warn" | "bad"
  headline: string
  /** what to do about it, or what it means, in a sentence; null if nothing needs saying */
  detail: string | null
}

export function standing(provider: Provider): Standing {
  const { cli, signIn } = PROVIDER_WORDS[provider.id]
  const { status, settings } = provider
  if (!status) return { tone: "wait", headline: "Checking…", detail: null }
  if (!status.path)
    return {
      tone: settings.enabled ? "bad" : "off",
      headline: "Not installed",
      detail: settings.binary
        ? `Nothing to run was found at ${settings.binary}.`
        : `Install ${cli}, then check again.`,
    }
  if (!settings.enabled)
    return {
      tone: "off",
      headline: "Off",
      detail: `Switch it on to use ${cli} in Enclose.`,
    }
  if (status.signedIn)
    return {
      tone: "ok",
      headline: status.account ? `Signed in · ${status.account}` : "Signed in",
      detail: `Enclose uses the account signed in to ${cli}.`,
    }
  if (status.signedIn === false)
    return {
      tone: "warn",
      headline: "Not signed in",
      detail: `Run ${signIn} in a terminal to sign in, then check again.`,
    }
  if (provider.checking)
    return { tone: "wait", headline: "Checking…", detail: null }
  if (status.trouble)
    return { tone: "warn", headline: "Needs attention", detail: status.trouble }
  return {
    tone: "ok",
    headline: "Ready",
    detail: `Enclose uses the account signed in to ${cli}.`,
  }
}
