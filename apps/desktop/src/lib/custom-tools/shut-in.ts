// What a project's tool is shut in from. A tool is code that came with a project's
// folder and is run without being read (see runner.ts): the worker it runs in has ways
// out of it that a tool has no call for, and they are taken away before the tool is
// read.
//
// A worker keeps most of them not on itself but further up its line: `fetch` is its
// kind's, and its kind's kind's. Something put over one of those on the worker itself
// would hide it and no more, and the thing would still be there for whoever went up the
// line to ask. So each is taken away wherever along the line it is kept, and so that it
// cannot be put back.

/**
 * What a worker is given that a tool has no call for. Ways to the network; storage
 * that outlasts the tool, which another project's tool would find; other workers,
 * which would come with all of these afresh; and the user's screen.
 */
export const WAYS_OUT = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebSocketStream",
  "WebTransport",
  "EventSource",
  "importScripts",
  // (a font is fetched from wherever it is said to be)
  "FontFace",
  "fonts",
  "indexedDB",
  "caches",
  "BroadcastChannel",
  "Worker",
  "SharedWorker",
  // a notice from the system, in the app's name, saying whatever the tool has it say
  "Notification",
]

/** And what it is given by way of its `navigator`: the network again, storage, and devices. */
export const WAYS_OUT_BESIDES = [
  "sendBeacon",
  "serviceWorker",
  "storage",
  "storageBuckets",
  "locks",
  "usb",
  "hid",
  "serial",
  "bluetooth",
]

/** Take something away from wherever along a thing's line it is kept, for good. */
function takeAway(from: object, name: string) {
  for (
    let at: object | null = from;
    at !== null;
    at = Object.getPrototypeOf(at) as object | null
  ) {
    if (!Object.hasOwn(at, name)) continue
    try {
      Object.defineProperty(at, name, {
        value: undefined,
        writable: false,
        configurable: false,
      })
    } catch {
      // not to be taken away: nothing a tool is told of
    }
  }
}

/**
 * Shut a tool in: take the ways out away from a worker (`scope`), and from what it has
 * as its `navigator`.
 */
export function shutIn(scope: object) {
  for (const name of WAYS_OUT) takeAway(scope, name)
  const { navigator } = scope as { navigator?: unknown }
  if (typeof navigator === "object" && navigator !== null)
    for (const name of WAYS_OUT_BESIDES) takeAway(navigator, name)
}
