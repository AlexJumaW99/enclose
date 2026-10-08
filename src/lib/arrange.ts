// How the user has put a model's parts into groups by hand, over what the model says:
// parts made a group of (Cmd+G), parts taken out of their groups (Shift+Cmd+G), and
// groups called something else. It is the app's, kept apart from the project's files,
// as the colours given to parts are: the model is shown so whatever its manifest says,
// and Claude is told so when it asks what the parts are.
//
// What was done by hand holds for as long as the model has not been changed under it. A
// part the build has since put in another group is where the build puts it, and a group
// the build has since called something else is called that. Nothing done by hand is
// forgotten for it: should the model go back to how it was, as it does when what
// Claude did is taken back, what was done by hand holds again.

import type { Group, Model } from "./model"

/** The group of parts that are in none: what the exporter calls it (kit/enclose.py). */
export const LOOSE = "parts"
/** What that group goes by, where the model has no such group of its own. */
const LOOSE_LABEL = "Ungrouped"
/** What a group made by hand goes by until it is given a name. */
export const UNNAMED = "New group"

export type Arrangement = {
  /** the groups made by hand, by id, the latest first */
  made: string[]
  /** where parts were put by hand: the group, and the one the model had them in then */
  put: Record<string, { group: string; from: string }>
  /**
   * what groups were called by hand, by group: and, for a group of the model's, what
   * the model called it then
   */
  called: Record<string, { label: string; from: string | null }>
}

/** Stable for a model nothing has been done to by hand. */
export const NOT_ARRANGED: Arrangement = { made: [], put: {}, called: {} }

/** The names groups made by hand were given for them, by group: not by hand, by Claude. */
export type Named = Record<string, string>

type Told = Pick<Model, "parts" | "groups">

/** The group each part is in, by part: where it was put by hand, if that still holds. */
function places(model: Told, arrangement: Arrangement): Map<string, string> {
  return new Map(
    model.parts.map((part) => {
      const put = arrangement.put[part.id]
      const holds =
        put !== undefined &&
        put.from === part.group &&
        (put.group === LOOSE || arrangement.made.includes(put.group))
      return [part.id, holds ? put.group : part.group]
    })
  )
}

/**
 * A model's groups, and the group each of its parts is in, as the user has them. The
 * groups made by hand come first, the latest of them first; then the model's own, in
 * the model's order, but for any that have lost all their parts; and last the parts
 * that are in no group, where there are any and the model has no group for them.
 *
 * A group made by hand goes by the name it was given by hand, or else the one Claude
 * gave it (`named`), or else by none in particular. It is the outside of the thing if
 * all that was put in it was.
 */
export function arranged(
  model: Told,
  arrangement: Arrangement,
  named: Named
): { groups: Group[]; of: Map<string, string> } {
  const of = places(model, arrangement)
  const filled = new Set(of.values())
  const emptied = new Set(
    model.parts.map((part) => part.group).filter((group) => !filled.has(group))
  )
  const shell = new Set(model.groups.filter((g) => g.shell).map((g) => g.id))
  const made: Group[] = arrangement.made
    .filter((id) => filled.has(id))
    .map((id) => ({
      id,
      label: arrangement.called[id]?.label ?? named[id] ?? UNNAMED,
      shell: model.parts
        .filter((part) => of.get(part.id) === id)
        .every((part) => shell.has(part.group)),
    }))
  const own: Group[] = model.groups
    .filter((group) => !emptied.has(group.id))
    .map((group) => {
      const called = arrangement.called[group.id]
      return called && called.from === group.label
        ? { ...group, label: called.label }
        : group
    })
  const loose: Group[] =
    filled.has(LOOSE) && !own.some((group) => group.id === LOOSE)
      ? [{ id: LOOSE, label: LOOSE_LABEL, shell: false }]
      : []
  return { groups: [...made, ...own, ...loose], of }
}

/** Whether a group is one that was made by hand. */
export function byHand(arrangement: Arrangement, groupId: string): boolean {
  return arrangement.made.includes(groupId)
}

/** The parts among some that the model has, each once, in the model's order. */
const known = (model: Told, partIds: string[]) =>
  model.parts.filter((part) => partIds.includes(part.id))

/**
 * Some parts made a group of, called `id`: null where there is nothing to do, because
 * none of them is in the model, or because they are a group already, all of one and
 * nothing else.
 */
export function grouped(
  model: Told,
  arrangement: Arrangement,
  partIds: string[],
  id: string
): Arrangement | null {
  const parts = known(model, partIds)
  if (parts.length === 0) return null
  const of = places(model, arrangement)
  const now = new Set(parts.map((part) => of.get(part.id)))
  if (now.size === 1 && !now.has(LOOSE)) {
    const [group] = now
    const all = model.parts.filter((part) => of.get(part.id) === group)
    if (all.length === parts.length) return null
  }
  return {
    ...arrangement,
    made: [id, ...arrangement.made.filter((other) => other !== id)],
    put: {
      ...arrangement.put,
      ...Object.fromEntries(
        parts.map((part) => [part.id, { group: id, from: part.group }])
      ),
    },
  }
}

/**
 * Some parts taken out of the groups they are in, to be in none: null where there is
 * nothing to do, because none of them is in a group.
 */
export function ungrouped(
  model: Told,
  arrangement: Arrangement,
  partIds: string[]
): Arrangement | null {
  const of = places(model, arrangement)
  const parts = known(model, partIds).filter(
    (part) => of.get(part.id) !== LOOSE
  )
  if (parts.length === 0) return null
  const put = { ...arrangement.put }
  for (const part of parts)
    if (part.group === LOOSE) delete put[part.id]
    else put[part.id] = { group: LOOSE, from: part.group }
  return { ...arrangement, put }
}

/**
 * A group called something else: or, with nothing written, what it went by before it
 * was called anything by hand. Null where that is what it goes by already, or there is
 * no such group.
 */
export function renamed(
  model: Told,
  arrangement: Arrangement,
  named: Named,
  groupId: string,
  label: string
): Arrangement | null {
  const group = arranged(model, arrangement, named).groups.find(
    (one) => one.id === groupId
  )
  if (!group) return null
  const written = label.replace(/\s+/g, " ").trim()
  if (written === group.label) return null
  const called = { ...arrangement.called }
  if (written === "") {
    if (!(groupId in called)) return null
    delete called[groupId]
  } else {
    const own = model.groups.find((one) => one.id === groupId)
    called[groupId] = { label: written, from: own ? own.label : null }
  }
  return { ...arrangement, called }
}

/** Whether nothing done by hand shows in how a model is arranged. */
export function untouched(arrangement: Arrangement): boolean {
  return (
    arrangement.made.length === 0 &&
    Object.keys(arrangement.put).length === 0 &&
    Object.keys(arrangement.called).length === 0
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** An arrangement as it was kept, read back: nothing of it that is not as it should be. */
export function readArrangement(kept: unknown): Arrangement {
  if (!isRecord(kept)) return NOT_ARRANGED
  const made = Array.isArray(kept.made)
    ? kept.made.filter((id): id is string => typeof id === "string")
    : []
  const put: Arrangement["put"] = {}
  if (isRecord(kept.put))
    for (const [part, where] of Object.entries(kept.put))
      if (
        isRecord(where) &&
        typeof where.group === "string" &&
        typeof where.from === "string"
      )
        put[part] = { group: where.group, from: where.from }
  const called: Arrangement["called"] = {}
  if (isRecord(kept.called))
    for (const [group, name] of Object.entries(kept.called))
      if (isRecord(name) && typeof name.label === "string")
        called[group] = {
          label: name.label,
          from: typeof name.from === "string" ? name.from : null,
        }
  const read = { made, put, called }
  return untouched(read) ? NOT_ARRANGED : read
}
