// The conversations had about each project, as they are kept on disk: a folder for each
// project, and in it a file for each conversation. Nothing here takes one away but
// `forgetConversations`, which is for a project taken off the list.
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import type { ThreadItem } from "../shared/api"

export type Conversation = {
  id: string
  /** the Claude Code session that carries it on, once it has one */
  sessionId: string | null
  /** what the user has called it; until they do, it goes by the first thing said in it */
  name: string | null
  items: ThreadItem[]
  /** what one of its messages comes to in a few words, and which message: see gist.ts */
  gist: { of: string; text: string } | null
}

/**
 * An item as it should read once nothing is running any more. The app can be closed in
 * the middle of a turn; what was in flight then did not finish, and must not come back
 * looking as if it were still going.
 */
function settled(item: ThreadItem): ThreadItem {
  if (item.kind === "tool" && item.state === "running")
    return { ...item, state: "failed" }
  if (item.kind === "permission" && item.state === "pending")
    return { ...item, state: "denied" }
  if (item.kind === "assistant" && item.streaming)
    return { ...item, streaming: false }
  return item
}

/** A conversation that is about to have its first thing said in it. */
export function newConversation(): Conversation {
  return {
    id: randomBytes(6).toString("hex"),
    sessionId: null,
    name: null,
    items: [],
    gist: null,
  }
}

const folder = (dir: string, projectId: string) => path.join(dir, projectId)
/** Where a project's one conversation was kept, when a project had only one. */
const single = (dir: string, projectId: string) =>
  path.join(dir, `${projectId}.json`)

export function writeConversation(
  dir: string,
  projectId: string,
  { id, sessionId, name, items, gist }: Conversation
) {
  fs.mkdirSync(folder(dir, projectId), { recursive: true })
  fs.writeFileSync(
    path.join(folder(dir, projectId), `${id}.json`),
    JSON.stringify({ sessionId, name, items, gist })
  )
}

/**
 * The conversation a project had when it could have only one, moved in with the others.
 * `session` is asked for the Claude Code session that went with it.
 */
function adopt(dir: string, projectId: string, session: () => string | null) {
  const old = single(dir, projectId)
  let items: unknown
  try {
    items = JSON.parse(fs.readFileSync(old, "utf8"))
  } catch {
    // there is none, or it cannot be read: left as it is
    return
  }
  if (Array.isArray(items) && items.length > 0) {
    writeConversation(dir, projectId, {
      ...newConversation(),
      sessionId: session(),
      items: items as ThreadItem[],
    })
  }
  // only now that it is kept in the new place
  fs.unlinkSync(old)
}

/** A project's conversations, in no particular order. */
export function readConversations(
  dir: string,
  projectId: string,
  /** the session of the conversation a project had when it could have only one */
  session: () => string | null
): Conversation[] {
  adopt(dir, projectId, session)
  let names: string[]
  try {
    names = fs.readdirSync(folder(dir, projectId))
  } catch {
    // nothing has been said about this project yet
    return []
  }
  const found: Conversation[] = []
  for (const name of names) {
    if (!name.endsWith(".json")) continue
    try {
      const {
        sessionId,
        name: called,
        items,
        gist,
      } = JSON.parse(
        fs.readFileSync(path.join(folder(dir, projectId), name), "utf8")
      ) as {
        sessionId?: unknown
        name?: unknown
        items?: unknown
        gist?: unknown
      }
      if (!Array.isArray(items) || items.length === 0) continue
      const { of, text } = (gist ?? {}) as { of?: unknown; text?: unknown }
      found.push({
        id: name.slice(0, -".json".length),
        sessionId: typeof sessionId === "string" ? sessionId : null,
        name: typeof called === "string" && called ? called : null,
        items: (items as ThreadItem[]).map(settled),
        gist:
          typeof of === "string" && typeof text === "string"
            ? { of, text }
            : null,
      })
    } catch {
      // not one of ours, or cut short while being written: passed over, and left alone
    }
  }
  return found
}

/** Forget everything said about a project. */
export function forgetConversations(dir: string, projectId: string) {
  fs.rmSync(folder(dir, projectId), { recursive: true, force: true })
  fs.rmSync(single(dir, projectId), { force: true })
}
