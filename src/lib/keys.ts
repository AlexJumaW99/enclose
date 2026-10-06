/** Whether a key pressed here is on its way into some text, or a menu's own. */
export const spokenFor = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest("input, textarea, select, [role=menu]") !== null)
