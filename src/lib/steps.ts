// The conversation as it is drawn. What Claude does between saying things is not listed
// thing by thing: each stretch of it is one line, which opens into its steps. What it
// says on the way, before going on to the next step, is kept with them: its answer is
// what it says last.

import type { ThreadItem } from "@shared/api"

/** One thing Claude did: read a file, ran a command, looked at the viewport. */
export type Step = Extract<ThreadItem, { kind: "tool" }>

/** Something Claude said on its way to the next step, and not as its answer. */
export type Aside = Extract<ThreadItem, { kind: "assistant" }>

/**
 * A stretch of steps, with what Claude said between them, in the order they came. It
 * goes by the first of them.
 */
export type Steps = {
  kind: "steps"
  id: string
  steps: (Step | Aside)[]
  /** how long Claude was at them, in ms, once something has come after them */
  took: number | null
}

export type Block = Exclude<ThreadItem, Step> | Steps

/** The items of a conversation, with every stretch of steps gathered into one. */
export function inBlocks(items: ThreadItem[]): Block[] {
  // a yes that was given has nothing left to show: the step it let through says the rest
  const shown = items.filter(
    (item) => !(item.kind === "permission" && item.state === "allowed")
  )
  // What Claude said and then went on working from was said on the way: a step comes
  // straight after it, or something else said on the way. Told from the end, since it
  // is what follows a thing said that makes it so; until something does, it may be the
  // answer, and is shown as one.
  const aside = new Set<ThreadItem>()
  let next: ThreadItem | undefined
  for (const item of shown.toReversed()) {
    if (
      item.kind === "assistant" &&
      next &&
      (next.kind === "tool" || aside.has(next))
    )
      aside.add(item)
    next = item
  }

  const blocks: Block[] = []
  // when Claude set to work on the stretch of steps that is last so far
  let from = 0
  for (const item of shown) {
    const last = blocks.at(-1)
    if (
      item.kind !== "tool" &&
      !(item.kind === "assistant" && aside.has(item))
    ) {
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

/**
 * What Claude is at in a turn that is under way, in a line: the step it is on, in the
 * words the conversation has for it, or the last it took; that it is writing, once it is
 * saying what came of them; or that it is waiting on the user. Nothing, while it has done
 * none of these yet: it has only been asked.
 */
export function atWork(items: ThreadItem[]): string | null {
  const last = items.at(-1)
  if (!last) return null
  if (last.kind === "permission")
    return last.state === "pending"
      ? "Waiting for your answer in the conversation"
      : null
  if (last.kind === "assistant") return "Writing what it found"
  if (last.kind !== "tool") return null
  // the one it is on, if it is on more than one; and failing that the last it took
  const step =
    items.findLast(
      (item): item is Step => item.kind === "tool" && item.state === "running"
    ) ?? last
  return [step.name, step.detail].filter(Boolean).join(" ")
}
