// The dev loop: Vite serves the window with hot reload, esbuild rebuilds the Electron
// side on save, and Electron is restarted whenever that side changes.
//   npm run dev                 open the app
//   npm run dev -- <folder>     ...with that folder added as a project
import { spawn } from "node:child_process"

import electron from "electron"
import { context } from "esbuild"
import { createServer } from "vite"

import { main, preload } from "./electron-build.mjs"

const server = await createServer()
await server.listen()
const url = server.resolvedUrls.local[0]

let app = null
let restarting = false

// A terminal inside an Electron-based editor can carry this, and it would make our
// Electron start as plain Node instead of as an app.
const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env

function start() {
  app = spawn(electron, [".", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...env, VITE_DEV_SERVER_URL: url },
  })
  app.once("exit", (code) => {
    if (restarting) return
    // the window was closed, or a one-shot run (--capture) finished: the session is over
    void server.close().then(() => process.exit(code ?? 0))
  })
}

function restart() {
  if (!app) return start()
  restarting = true
  app.once("exit", () => {
    restarting = false
    start()
  })
  app.kill()
}

// both bundles report in after every build; start once both are there, restart after that
let built = 0
const relaunch = {
  name: "relaunch",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return
      if (++built >= 2) restart()
    })
  },
}

for (const options of [main, preload]) {
  const bundle = await context({ ...options, plugins: [relaunch] })
  await bundle.watch()
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restarting = true
    app?.kill()
    void server.close().then(() => process.exit(0))
  })
}
