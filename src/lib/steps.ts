// The conversation as it is drawn. What Claude does between saying things is not listed
// thing by thing: each stretch of it is one line, which opens into its steps.

import type { ThreadItem } from "@shared/api"

/** One thing Claude did: read a file, ran a command, looked at the viewport. */
export type Step = Extract<ThreadItem, { kind: "tool" }>

/** A stretch of steps with nothing said in between. It goes by the first of them. */
export type Steps = {
  kind: "steps"
  id: string
  steps: Step[]
  /** how long Claude was at them, in ms, once something has come after them */
  took: number | null
}

export type Block = Exclude<ThreadItem, Step> | Steps

/** The items of a conversation, with every stretch of steps gathered into one. */
export function inBlocks(items: ThreadItem[]): Block[] {
  const blocks: Block[] = []
  // when Claude set to work on the stretch of steps that is last so far
  let from = 0
  for (const item of items) {
    // a yes that was given has nothing left to show: the step it let through says the rest
    if (item.kind === "permission" && item.state === "allowed") continue
    const last = blocks.at(-1)
    if (item.kind !== "tool") {
      // whatever comes next is where the steps before it ended
      if (last?.kind === "steps") last.took = item.at - from
      blocks.push(item)
      continue
    }
    if (last?.kind === "steps") last.steps.push(item)
    else {
      // straight after being asked, Claude was at work from then: thinking is working
      from = last?.kind === "user" ? last.at : item.at
      blocks.push({ kind: "steps", id: item.id, steps: [item], took: null })
    }
  }
  return blocks
}
