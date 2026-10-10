/** Whether this is a Mac, where the key for shortcuts is Cmd and elsewhere it is Ctrl. */
export const MAC =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
