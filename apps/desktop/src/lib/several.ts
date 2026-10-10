// Picking several things out of a list, the way lists have it. A click picks the one
// thing. With Cmd held, a click on a thing has it join what is picked, or leave it.
// With Shift held, a click picks everything from the thing last clicked to this one:
// and another such click, further or nearer, picks from that same thing to there
// instead.

/** Where a sweep with Shift starts from, and what the last sweep from there picked. */
export type Sweep = { from: string | null; over: string[] }

/** Stable while nothing has been clicked to sweep from. */
export const NO_SWEEP: Sweep = { from: null, over: [] }

/** Some things in the order the list has them, each once. */
const inOrder = (order: string[], ids: string[]) =>
  order.filter((id) => ids.includes(id))

/**
 * A click on a thing with Cmd held: it joins what is picked (`had`), or leaves it, and
 * is where the next sweep starts from.
 */
export function toggled(
  order: string[],
  had: string[],
  id: string
): { ids: string[]; sweep: Sweep } {
  return {
    ids: inOrder(
      order,
      had.includes(id) ? had.filter((other) => other !== id) : [...had, id]
    ),
    sweep: { from: id, over: [] },
  }
}

/**
 * A click on a thing with Shift held: everything from where the sweep starts to the
 * thing is picked, with what was picked otherwise, in place of what the last sweep
 * from there picked. Where there is nowhere to sweep from, because nothing was clicked
 * or what was is picked no longer, the thing is picked with the rest and the sweep
 * starts from it. `left` are things the sweep passes over: they are not there to pick.
 */
export function sweptTo(
  order: string[],
  had: string[],
  sweep: Sweep,
  id: string,
  left: string[] = []
): { ids: string[]; sweep: Sweep } {
  const from = sweep.from
  if (from === null || !had.includes(from) || !order.includes(from))
    return {
      ids: inOrder(order, [...had, id]),
      sweep: { from: id, over: [] },
    }
  const [first, last] = [order.indexOf(from), order.indexOf(id)].sort(
    (a, b) => a - b
  )
  const over = order
    .slice(first, last + 1)
    .filter((other) => other === id || !left.includes(other))
  const kept = had.filter((other) => !sweep.over.includes(other))
  return {
    ids: inOrder(order, [...kept, from, ...over]),
    sweep: { from, over },
  }
}

/**
 * A click with Cmd or Shift held on something that stands for several things, a group
 * of them: they all join what is picked, or, if every one of them is picked already,
 * all leave it.
 */
export function toggledAll(
  order: string[],
  had: string[],
  ids: string[]
): string[] {
  return inOrder(
    order,
    ids.every((id) => had.includes(id))
      ? had.filter((other) => !ids.includes(other))
      : [...had, ...ids]
  )
}
