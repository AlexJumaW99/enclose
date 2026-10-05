import { writeFileSync } from "node:fs"
import { defineConfig } from "vite"

// The benchmark renders another project's exported model, read in place.
// MODEL_DIR is a folder holding report.json plus the *.glb and *.edges.bin it names.
const MODEL_DIR =
  process.env.MODEL_DIR ??
  "/path/to/model"

/** Where the page hands its numbers back when run.js drives it headless (?report). */
function benchSink() {
  return {
    name: "bench-sink",
    configureServer(server) {
      const body = (req) =>
        new Promise((resolve) => {
          let text = ""
          req.on("data", (chunk) => (text += chunk))
          req.on("end", () => resolve(text))
        })
      server.middlewares.use("/__bench/stage", async (req, res) => {
        console.log(`[bench] ${await body(req)}`)
        res.end("ok")
      })
      server.middlewares.use("/__bench/result", async (req, res) => {
        writeFileSync("result.json", await body(req))
        res.end("ok")
      })
    },
  }
}

export default defineConfig({
  plugins: [benchSink()],
  define: { __MODEL_URL__: JSON.stringify(`/@fs${MODEL_DIR}/`) },
  server: { port: 5311, strictPort: true, fs: { allow: [".", MODEL_DIR] } },
})
