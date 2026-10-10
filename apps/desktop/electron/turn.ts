// One turn of a conversation, as whichever agent runs it is given it: what was asked,
// how it is to be answered, and what the agent says back with. The conversations
// (threads.ts) make one of these for each turn and hand it to the agent's own runner.
import fs from "node:fs"
import path from "node:path"

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"

import type { Manner, PermissionAnswer, ThreadItem } from "../shared/api"
import type { Launch } from "./providers"
import type { AppTool } from "./tools"

/** What goes into a turn: words, or words and pictures, as Claude Code takes a message. */
export type Content = SDKUserMessage["message"]["content"]

/** Something an agent wants leave for, as it is put to the user. */
export type Asked = {
  title: string
  detail: string
  /** whether "always" is among the answers: the agent can be told not to ask this again */
  canAlways: boolean
}

export type Turn = {
  /** the project's folder, which the agent works in */
  cwd: string
  /** what to start, and with what around it */
  launch: Launch
  manner: Manner
  content: Content
  /** what the agent is told about where it is, on top of its own instructions */
  guide: string
  /**
   * That is other than what the session it carries on was told: an agent that takes its
   * instructions only when a session begins has to be told again, with the message.
   */
  guideChanged: boolean
  /** the session of the agent's own that carries the conversation on, if it has had one */
  sessionId: string | null
  /** The agent says which of its sessions the conversation now is. */
  session(id: string): void
  /** set off when the turn is stopped */
  signal: AbortSignal
  /** Add an item to the conversation, or replace the one with the same id. */
  put(item: ThreadItem): void
  notice(tone: "error" | "info", text: string): void
  /**
   * Put a question to the user, and wait for the answer. Stopping the turn answers no,
   * and so does `signal`, where the agent can take a question back.
   */
  ask(asked: Asked, signal?: AbortSignal): Promise<PermissionAnswer>
  /** Something was done in the folder, or said: have the project looked at again. */
  touched(): void
  /**
   * The app's own tools, by the name of each set. An agent that cannot be handed them
   * in-process is given `served` instead: where the same sets answer over HTTP.
   */
  tools: Record<string, AppTool[]>
  served: Record<string, string>
  /**
   * The turn is the app's own asking, that a model be looked over. The agent does it
   * with the app's tools: anything else it reaches for is put to the user, whatever it
   * is let do when the user asks.
   */
  lookOver: boolean
  /** A tool call in a few words: what kind of thing, and on what. */
  describe(name: string, input: unknown): { name: string; detail: string }
  /** An id for an item, which no other item has. */
  id(kind: string): string
}

type Piece =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }

/** A turn's content as a plain run of words and pictures, in the order they come. */
export function piecesOf(content: Content): Piece[] {
  if (typeof content === "string") return [{ type: "text", text: content }]
  return content.flatMap((block): Piece[] =>
    block.type === "text"
      ? [{ type: "text", text: block.text }]
      : block.type === "image" && block.source.type === "base64"
        ? [
            {
              type: "image",
              data: block.source.data,
              mimeType: block.source.media_type,
            },
          ]
        : []
  )
}

/**
 * What an agent is told ahead of a message when what it was told of the project at the
 * start of its session no longer holds: the project has a model now, or a name.
 */
export const guideAgain = (guide: string) =>
  [
    "<enclose>",
    "What the app told you about this project when the conversation began has changed. This is how it stands now, and takes the place of what you were told then:",
    "",
    guide,
    "</enclose>",
  ].join("\n")

/** Rejects once a turn is stopped: raced against whatever is being waited for. */
export function stopped(signal: AbortSignal): Promise<never> {
  const halt = new Promise<never>((_, reject) => {
    const stop = () => reject(new Error("Stopped."))
    if (signal.aborted) stop()
    else signal.addEventListener("abort", stop, { once: true })
  })
  // nobody may be waiting on it when it happens
  halt.catch(() => {})
  return halt
}

/** A command as it is worth showing: without the shell it was wrapped in to be run. */
export function bare(command: string): string {
  const inner = /^(?:\S*\/)?(?:ba|z|da)?sh\s+-l?c\s+(['"])([\s\S]*)\1$/.exec(
    command.trim()
  )
  return (inner?.[2] ?? command).trim()
}

/**
 * Says where a file is as seen from a folder, for a file inside it: an agent gives the
 * whole path, and may know the folder by another way to it than the app does.
 */
export function inside(root: string): (file: string) => string {
  const roots = [root]
  try {
    const real = fs.realpathSync(root)
    if (real !== root) roots.push(real)
  } catch {
    // a folder that is not there has only the one name
  }
  return (file) => {
    const within = roots.find((one) => file.startsWith(one + path.sep))
    return within ? file.slice(within.length + 1) : file
  }
}
