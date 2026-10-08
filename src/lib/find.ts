// Looking for parts of the model by name, from the view: what a name that is being
// typed could be, among the parts and the groups they are in.

import { matching } from "@/lib/mentions"
import type { Model } from "@/lib/model"

/** Something found by name: a part, or a group of them. */
export type Found = {
  kind: "part" | "group"
  id: string
  label: string
  /** the parts it is, by id: the one, or all those of the group */
  parts: string[]
}

/** What looking for a name comes to. */
export type Finds = {
  /** what goes by it, the nearest to it first: and of those as near, groups before parts */
  things: Found[]
  /** every part that is, or is of a group that is, by id, in the order the model has them */
  parts: string[]
}

/** Stable while nothing is found, or nothing has been typed to find. */
const NOTHING: Finds = { things: [], parts: [] }

/**
 * The parts and groups of a model that a name could be, as far as it has been typed. A
 * thing is found by what it is called, and by its id, which is what Claude calls it. A
 * group with nothing in it is not there to be found.
 */
export function lookFor(
  model: Pick<Model, "parts" | "groups">,
  name: string
): Finds {
  const wanted = name.trim()
  if (!wanted) return NOTHING
  const groups = model.groups.flatMap((group) => {
    const parts = model.parts
      .filter((part) => part.group === group.id)
      .map((part) => part.id)
    return parts.length > 0
      ? [{ kind: "group" as const, id: group.id, label: group.label, parts }]
      : []
  })
  const parts = model.parts.map((part) => ({
    kind: "part" as const,
    id: part.id,
    label: part.label,
    parts: [part.id],
  }))
  const things = matching(
    [...groups, ...parts].map((thing) => ({
      thing,
      name: thing.label,
      also: thing.id,
    })),
    wanted
  ).map(({ thing }): Found => thing)
  if (things.length === 0) return NOTHING
  const lit = new Set(things.flatMap((thing) => thing.parts))
  return {
    things,
    parts: model.parts
      .filter((part) => lit.has(part.id))
      .map((part) => part.id),
  }
}

/** How much was found, in a few words: "2 groups, 5 parts". */
export function howMany(things: Found[]): string {
  const count = (kind: Found["kind"]) => {
    const many = things.filter((thing) => thing.kind === kind).length
    return many > 0 ? [`${many} ${kind}${many === 1 ? "" : "s"}`] : []
  }
  return [...count("group"), ...count("part")].join(", ")
}
