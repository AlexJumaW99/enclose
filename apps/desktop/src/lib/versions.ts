// What is done to a model by hand, where each conversation has the project its own way.
//
// The colours given to parts, and how they are put into groups, are the window's to
// keep, by project: they are not in the project's folder. So when the folder becomes
// another conversation's (see electron/versions.ts), what was done by hand is put aside
// for the conversation that is left, and what was put aside for the one turned to is
// had back. A conversation that begins from where another had got to begins with what
// that one had done by hand as well.

import type { Turned } from "@shared/api"

/** What is put aside for a conversation is kept under, among what is kept by project. */
export const asideFor = (projectId: string, conversationId: string) =>
  `${projectId}/${conversationId}`

/**
 * Something kept by project, as it is once a project's folder has become another
 * conversation's. What the project had is put aside for the one it was; and where the
 * folder was put as the other had left it, and something was put aside for that one
 * then (`left`), the project has that. With `none`, a project that had nothing has that
 * much put aside for it: it is how it is known later that anything was.
 */
export function carried<T>(
  all: Record<string, T>,
  projectId: string,
  { from, to, restored }: Turned,
  left: boolean,
  none?: T
): Record<string, T> {
  const next = { ...all }
  const put = (key: string, value: T | undefined) => {
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  if (from !== null) put(asideFor(projectId, from), all[projectId] ?? none)
  if (restored && left) put(projectId, all[asideFor(projectId, to)])
  return next
}
