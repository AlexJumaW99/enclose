// Runs the production build (`npm run build` first). Goes through Node rather than
// calling Electron directly so the environment is cleaned the same way as in the dev loop.
import { spawn } from "node:child_process"

import { namedElectron } from "./electron-name.mjs"

// A terminal inside an Electron-based editor can carry this, and it would make our
// Electron start as plain Node instead of as an app.
const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env

spawn(namedElectron(), [".", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
}).once("exit", (code) => process.exit(code ?? 0))
