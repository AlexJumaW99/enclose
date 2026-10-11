// What a file the app saves is called: its own name, and before that the day it is
// saved on, where the settings ask for it. So that a folder of files had from a project
// over the weeks lists them in the order they were had, and tells this week's from last.
import { usePreferences } from "@/lib/preferences"

/** A name with a day before it, as the year, the month and the day: 2026_10_11_name. */
export function dated(name: string, on: Date = new Date()): string {
  const two = (number: number) => String(number).padStart(2, "0")
  return `${on.getFullYear()}_${two(on.getMonth() + 1)}_${two(on.getDate())}_${name}`
}

/**
 * What a file, or a folder or an archive of files, is saved as today: what is in a folder
 * or an archive keeps its own name, having the day on what it is in.
 */
export const savedAs = (name: string): string =>
  usePreferences.getState().datedFiles ? dated(name) : name
