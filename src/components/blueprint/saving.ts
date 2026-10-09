// What the bars at the foot of a blueprint can have done with the sheets over them. The
// sheets are the ones that know how: they put it here while it can be done, and the bars
// find it here.
import { create } from "zustand"

export const useSaving = create<{
  /**
   * Save every sheet, each as a file, together in a folder: null while some of them are
   * not drawn yet, or are being drawn again.
   */
  all: (() => void) | null
}>()(() => ({ all: null }))
