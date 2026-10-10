import { writeFileSync } from "node:fs"
import { defineConfig } from "vite"

// The benchmark renders a model that was exported somewhere else, read in place.
// MODEL_DIR is a folder holding report.json plus the *.glb and *.edges.bin it names:
//   MODEL_DIR=/path/to/model npm run dev
const MODEL_DIR = process.env.MODEL_DIR
if (!MODEL_DIR) throw new Error("Set MODEL_DIR to the folder of the model to draw")

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
