// How the Electron side is bundled, shared by the dev loop and the production build.

/** The app's own process. Packages stay external: they are loaded from node_modules. */
export const main = {
  entryPoints: ["electron/main.ts"],
  outfile: "dist-electron/main.js",
  platform: "node",
  format: "esm",
  target: "node22",
  bundle: true,
  packages: "external",
  sourcemap: true,
  logLevel: "warning",
}

/** The preload runs sandboxed, where only CommonJS and the `electron` module are allowed. */
export const preload = {
  entryPoints: ["electron/preload.ts"],
  outfile: "dist-electron/preload.cjs",
  platform: "node",
  format: "cjs",
  target: "node22",
  bundle: true,
  external: ["electron"],
  sourcemap: true,
  logLevel: "warning",
}
