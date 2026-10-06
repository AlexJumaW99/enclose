// The conversation as it is drawn. What Claude does between saying things is not listed
// thing by thing: each stretch of it is one line, which opens into its steps.

import type { ThreadItem } from "@shared/api"

/** One thing Claude did: read a file, ran a command, looked at the viewport. */
export type Step = Extract<ThreadItem, { kind: "tool" }>

/** A stretch of steps with nothing said in between. It goes by the first of them. */
export type Steps = { kind: "steps"; id: string; steps: Step[] }

export type Block = Exclude<ThreadItem, Step> | Steps

/** The items of a conversation, with every stretch of steps gathered into one. */
export function inBlocks(items: ThreadItem[]): Block[] {
  const blocks: Block[] = []
  for (const item of items) {
    // a yes that was given has nothing left to show: the step it let through says the rest
    if (item.kind === "permission" && item.state === "allowed") continue
    if (item.kind !== "tool") {
      blocks.push(item)
      continue
    }
    const last = blocks.at(-1)
    if (last?.kind === "steps") last.steps.push(item)
    else blocks.push({ kind: "steps", id: item.id, steps: [item] })
  }
  return blocks
}
