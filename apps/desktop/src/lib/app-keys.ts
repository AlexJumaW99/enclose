// The keys that are the app's own, and not the view's: each held with Cmd, or with
// Ctrl off a Mac. Which of them a press is, is worked out here; what comes of it, which
// goes by what is open, is App.tsx's.

/**
 * What a key asks of the app: its settings; a new project; a file or folder to open as
 * one, or off a Mac one or the other, which is all a picker there takes; the
 * conversation; or the view given the window to itself.
 */
export type AppKey =
  | "settings"
  | "new"
  | "open"
  | "open-file"
  | "open-folder"
  | "conversation"
  | "bare"

type Pressed = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>

/** Which of the app's keys a press is, on a Mac or off one: null if it is none of them. */
export function appKey(event: Pressed, mac: boolean): AppKey | null {
  // Ctrl+B on a Mac is a key for moving through text: left to do that
  const held = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey
  if (!held || event.altKey) return null
  const letter = event.key.toLowerCase()
  // A Mac's picker takes files and folders alike. No other system's does: there
  // Ctrl+O asks for files, and with Shift, the one key here it goes with, a folder.
  const folder = !mac && event.shiftKey && letter === "o"
  if (event.shiftKey && !folder) return null
  if (event.key === ",") return "settings"
  if (event.key === ".") return "bare"
  if (letter === "n") return "new"
  if (letter === "o") return mac ? "open" : folder ? "open-folder" : "open-file"
  if (letter === "b") return "conversation"
  return null
}
