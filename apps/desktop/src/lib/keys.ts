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
