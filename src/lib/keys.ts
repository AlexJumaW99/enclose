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
