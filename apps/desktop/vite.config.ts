import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// (with its ending: this file is read as it is, by whatever loads the settings)
import { contentPolicy } from "./shared/content-policy.ts"

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")
) as { version: string }

/**
 * Writes the window's policy into the page that is built: it is loaded from disk, where
 * there is no server to send one. (While the app is worked on, the server below sends it.)
 */
const policed = (): Plugin => ({
  name: "content-policy",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: contentPolicy(),
      },
      injectTo: "head-prepend",
    },
  ],
})

// The window. In production it is loaded from disk by Electron, hence the relative base.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), policed()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@shared": resolve(import.meta.dirname, "./shared"),
    },
  },
  // what the settings page says the app's version is
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5321,
    host: "127.0.0.1",
    // with everything it serves, a worker's script too: a worker goes by its own
    headers: { "Content-Security-Policy": contentPolicy(true) },
  },
  // the window is loaded from disk, not over a network: one large file is fine
  build: { chunkSizeWarningLimit: 4000 },
})
