// What the window may load, and where from: its content security policy. The window is
// the app's own page and nothing else, so it loads from the app itself, from what it
// makes in memory (blob:, data:) and from a project's folder by the app's own scheme,
// and from nowhere on a network.
//
// A project's tools are what this is for (src/lib/custom-tools/runner.ts). A tool is code
// that came with a project's folder, and is run without being read. The worker it runs in
// has this policy too, so a tool cannot `import` a module from somewhere else, nor make
// one up to run with `eval`: the ways to the network it would have left, once the
// worker's own are taken from it.
// (with its ending, as vite.config.ts names this file: both are read as they are)
import { MODEL_SCHEME } from "./api.ts"

/**
 * The policy, as the one line it is given in. The built window gets it written into its
 * page (vite.config.ts), which is loaded from disk, where no server sends one. `dev` is
 * for the window as it is served while the app is worked on: that server writes a script
 * into the page, and talks to it over a socket to load what has changed.
 */
export function contentPolicy(dev = false): string {
  const project = `${MODEL_SCHEME}:`
  return [
    "default-src 'none'",
    `script-src 'self' blob:${dev ? " 'unsafe-inline'" : ""}`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${project}`,
    "font-src 'self' data:",
    `connect-src 'self' data: blob: ${project}${dev ? " ws://127.0.0.1:*" : ""}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")
}
