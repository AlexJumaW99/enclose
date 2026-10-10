// Production build: the window into dist/, the Electron side into dist-electron/.
// `npm start` then runs the result.
import { build as bundle } from "esbuild"
import { build as buildWindow } from "vite"

import { main, preload } from "./electron-build.mjs"

await buildWindow()
await Promise.all([bundle(main), bundle(preload)])
