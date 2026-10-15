import * as React from "react"

import { useStore } from "./store"

/**
 * Whether a key is not the view's to act on: it is on its way into some text, it is a
 * menu's own, or the settings are over the view.
 */
export const spokenFor = (target: EventTarget | null) =>
  useStore.getState().settingsOpen ||
  (target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, [role=menu]") !== null))

// True from a press of Tab until the next press of the pointer: for as long as it is,
// whatever has the keys was gone to with them.
let tabbed = false
window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Tab") tabbed = true
  },
  true
)
window.addEventListener("pointerdown", () => (tabbed = false), true)

/**
 * Whether Space is not the view's either: something has taken it already, or it is on
 * its way to press a button or the like that was gone to with Tab. A button that has the
 * keys only for having been pressed with the mouse is not pressed again by it.
 */
export const spaceTaken = (event: KeyboardEvent) =>
  event.defaultPrevented || (tabbed && event.target !== document.body)

/**
 * Whether Control is held down, by itself or with others: what shows what the app keeps
 * out of sight until it is asked for. Let go of, or the window left, and it is not.
 */
export function useControlHeld(): boolean {
  const [held, setHeld] = React.useState(false)
  React.useEffect(() => {
    const key = (event: KeyboardEvent) => setHeld(event.ctrlKey)
    const gone = () => setHeld(false)
    window.addEventListener("keydown", key, true)
    window.addEventListener("keyup", key, true)
    window.addEventListener("blur", gone)
    return () => {
      window.removeEventListener("keydown", key, true)
      window.removeEventListener("keyup", key, true)
      window.removeEventListener("blur", gone)
    }
  }, [])
  return held
}
