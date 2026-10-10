import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")
) as { version: string }

// The window. In production it is loaded from disk by Electron, hence the relative base.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@shared": resolve(import.meta.dirname, "./shared"),
    },
  },
  // what the settings page says the app's version is
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5321, host: "127.0.0.1" },
  // the window is loaded from disk, not over a network: one large file is fine
  build: { chunkSizeWarningLimit: 4000 },
})
