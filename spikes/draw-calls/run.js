// Runs the benchmark page in the installed Chrome, headless but on the real GPU, and
// prints what it measured. Start the page first: `npm run dev`.
//   node run.js                 glass shells, as in the viewer's default view
//   node run.js "shell=solid"   any query the page understands
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const URL = `http://127.0.0.1:5311/?report&${process.argv[2] ?? ""}`
const RESULT = "result.json"
const TIMEOUT_S = 300

rmSync(RESULT, { force: true })
const profile = mkdtempSync(join(tmpdir(), "draw-calls-"))
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--use-angle=metal",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--window-size=1700,1900",
    URL,
  ],
  { stdio: "ignore" }
)

try {
  for (let waited = 0; !existsSync(RESULT); waited += 0.5) {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited (${chrome.exitCode}) before finishing`)
    if (waited > TIMEOUT_S) throw new Error(`no result after ${TIMEOUT_S} s; see the dev server's [bench] lines`)
    await new Promise((r) => setTimeout(r, 500))
  }
  const bench = JSON.parse(readFileSync(RESULT, "utf8"))
  if (bench.error) throw new Error(bench.error)

  console.log(`GPU     ${bench.gpu}`)
  console.log(`Canvas  ${bench.size}`)
  console.log(`Load    ${(bench.loadMs / 1000).toFixed(1)} s for every model file, from localhost\n`)
  console.table(
    Object.fromEntries(
      bench.results.map((r) => [
        r.label,
        {
          "draw calls": r.drawCalls,
          triangles: r.triangles,
          "ms/frame": +r.medianMs.toFixed(1),
          "worst ms": +r.worstMs.toFixed(1),
          fps: Math.round(1000 / r.medianMs),
          "build ms": Math.round(r.buildMs),
        },
      ])
    )
  )

  mkdirSync("shots", { recursive: true })
  for (const [id, dataUrl] of Object.entries(bench.shots))
    writeFileSync(join("shots", `${id}.jpg`), Buffer.from(dataUrl.split(",")[1], "base64"))
  console.log("\nA frame of each variant is in shots/")
} finally {
  // Chrome keeps writing to its profile until it is gone, so wait before deleting it
  const gone = new Promise((resolve) => chrome.once("exit", resolve))
  if (chrome.exitCode === null) chrome.kill()
  else chrome.emit("exit")
  await gone
  rmSync(RESULT, { force: true })
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}
