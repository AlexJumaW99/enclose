// The app's own reference scenes are drawn in code, the way a project's model is: each
// by a reference.py in kit/scenes/<name>/, which writes the meshes and the manifest the
// app shows into reference/ beside it. This runs them all. It wants a Python that has
// build123d, and is only needed when one of them has been changed: what they write is
// kept with the app.
//   npm run scenes
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

const KIT = resolve(import.meta.dirname, "../../../kit")
const SCENES = join(KIT, "scenes")
const python = process.env.PYTHON ?? "python3"

for (const name of readdirSync(SCENES).sort()) {
  const script = join(SCENES, name, "reference.py")
  if (!existsSync(script)) continue
  const run = spawnSync(python, [script], {
    stdio: "inherit",
    // a project has the exporter beside its script: here it is two folders up
    env: { ...process.env, PYTHONPATH: KIT, PYTHONDONTWRITEBYTECODE: "1" },
  })
  if (run.status !== 0) process.exit(run.status ?? 1)
}
