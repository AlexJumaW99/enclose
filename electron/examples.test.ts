import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ownExporter, startFrom } from "./examples"

let root: string
const write = (file: string, content = "") => {
  const full = path.join(root, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
  return full
}
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8")

const SCRIPT = [
  "import os",
  "import sys",
  "",
  "# the app's exporter",
  "sys.dont_write_bytecode = True",
  'sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))',
  "from enclose import Model  # noqa: E402",
  "",
].join("\n")

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cad-ai-test-")))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("ownExporter", () => {
  it("takes out the line that points at the app's exporter", () => {
    const own = ownExporter(SCRIPT)
    expect(own).not.toContain("sys.path")
    expect(own).toContain("sys.dont_write_bytecode = True\nfrom enclose import")
  })

  it("leaves a script that has no such line as it is", () => {
    const plain = "from enclose import Model\n"
    expect(ownExporter(plain)).toBe(plain)
  })
})

describe("startFrom", () => {
  const made = new Date(2026, 9, 9, 12, 30)
  const start = () =>
    startFrom(
      path.join(root, "app/examples/clock"),
      "Clock movement",
      path.join(root, "projects"),
      path.join(root, "app/kit/enclose.py"),
      made
    )

  beforeEach(() => {
    write("app/kit/enclose.py", "# exporter\n")
    write("app/examples/clock/model.py", SCRIPT)
    write("app/examples/clock/enclose.json", "{}")
    write("app/examples/clock/tools/clock.js", "// tool\n")
    write("app/examples/clock/build/enclose.model.json", "{}")
    write("app/examples/clock/build/step/base.step", "step")
    write("app/examples/clock/__pycache__/model.pyc", "x")
    write("app/examples/clock/.DS_Store", "x")
  })

  it("copies the example into a new project's folder, exporter and all", () => {
    const dir = start()
    expect(dir).toBe(path.join(root, "projects/2026-10-09-1230-clock-movement"))
    const at = path.relative(root, dir)
    expect(read(`${at}/tools/clock.js`)).toBe("// tool\n")
    expect(read(`${at}/build/step/base.step`)).toBe("step")
    expect(read(`${at}/enclose.py`)).toBe("# exporter\n")
    expect(read(`${at}/model.py`)).not.toContain("sys.path")
    expect(fs.existsSync(path.join(dir, "__pycache__"))).toBe(false)
    expect(fs.existsSync(path.join(dir, ".DS_Store"))).toBe(false)
  })

  it("leaves the example as it was", () => {
    start()
    expect(read("app/examples/clock/model.py")).toBe(SCRIPT)
    expect(
      fs.existsSync(path.join(root, "app/examples/clock/enclose.py"))
    ).toBe(false)
  })

  it("makes another project the second time", () => {
    expect(start()).not.toBe(start())
  })

  it("leaves no folder behind when the example is not there", () => {
    fs.rmSync(path.join(root, "app/examples"), { recursive: true })
    expect(start).toThrow()
    expect(fs.readdirSync(path.join(root, "projects"))).toEqual([])
  })
})
