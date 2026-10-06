// How a project's conversations are laid out: which one is on its card, which are under
// it, and which the conversation panel shows. All of them are kept; this only says where
// each is to be found.

import type { ConversationSummary } from "@shared/api"

const DAY = 86_400_000

/** How many days a conversation can be left alone before it settles, at either end. */
export const SETTLE_DAYS = { min: 1, max: 365, initial: 3 }

export type Stack = {
  /** the conversation on the project's card; null when the card offers a new one */
  cover: ConversationSummary | null
  /** the ones under the card, the latest first */
  under: ConversationSummary[]
  /** the one the panel shows; null is a new one, with nothing said in it yet */
  open: ConversationSummary | null
}

/**
 * Lay out a project's conversations, given latest first. The card is the latest of them
 * for as long as it is being carried on. Left alone for `settleDays` it settles: it goes
 * under the card with the earlier ones, and the card offers a new one.
 */
export function stackOf(
  conversations: ConversationSummary[],
  /** what the user turned to: a conversation, a new one (null), or nothing yet */
  picked: string | null | undefined,
  settleDays: number,
  now: number
): Stack {
  const latest = conversations.at(0)
  const carriedOn =
    latest !== undefined &&
    (latest.status !== "idle" || now - latest.updatedAt < settleDays * DAY)
  // a new one is on the card while it is what the user is on, as well
  const cover = picked === null || !carriedOn ? null : latest
  const chosen =
    typeof picked === "string"
      ? conversations.find((c) => c.id === picked)
      : undefined
  return {
    cover,
    under: cover ? conversations.slice(1) : conversations,
    // with nothing turned to (or something that is no longer there), what is on the card
    open: chosen ?? (picked === null ? null : cover),
  }
}
