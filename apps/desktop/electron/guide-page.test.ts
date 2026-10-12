import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { fileGuide, guideOf } from "./assembly"
import {
  archived,
  archiveName,
  filesFor,
  GuideServer,
  pageOf,
  toldOf,
} from "./guide-page"

let root: string
const write = (file: string, content: string | Buffer) => {
  const full = path.join(root, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

const MANIFEST = {
  title: "Desk lamp",
  groups: [{ id: "base", label: "Base" }],
  parts: [
    {
      id: "base",
      label: "Base plate",
      group: "base",
      file: "base.glb",
      edges: "base.edges.bin",
    },
    { id: "weight", label: "Weight", group: "base", file: "weight.glb" },
    { id: "shade", label: "Shade", group: "base", file: "shade.glb" },
  ],
  downloads: [{ file: "step/base.step", name: "base.step" }],
}
const LOOKS = { colours: { weight: "blue" } }

beforeEach(() => {
  root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "enclose-test-"))
  )
  write("build/enclose.model.json", JSON.stringify(MANIFEST))
  write("build/base.glb", Buffer.from("base"))
  write("build/base.edges.bin", Buffer.from("edges"))
  write("build/weight.glb", Buffer.from("weight"))
  write("build/shade.glb", Buffer.from("shade"))
  write("page/page.js", "/* the page */")
  write("page/page.css", "/* its styles */")
  fileGuide(
    root,
    {
      title: 'Lamp <base> & "weight"',
      steps: [
        { title: "Start with the base", text: "Lay it down.", parts: ["base"] },
        { title: "Drop in the weight", text: "Flat up.", parts: ["weight"] },
      ],
    },
    ["base", "weight", "shade"],
    null,
    Date.UTC(2026, 9, 12)
  )
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const guide = () => guideOf(root, "lamp-base-weight-v1")!

describe("what a guide's page is told", () => {
  it("is the guide, and of the model only the parts it shows", () => {
    const told = toldOf(guide(), MANIFEST, LOOKS)
    expect(told.startsWith("window.ENCLOSE_GUIDE = ")).toBe(true)
    const {
      guide: read,
      model,
      looks,
    } = JSON.parse(told.slice("window.ENCLOSE_GUIDE = ".length))
    expect(read.steps).toHaveLength(2)
    expect(model.parts.map((part: { id: string }) => part.id)).toEqual([
      "base",
      "weight",
    ])
    expect(model.groups).toEqual(MANIFEST.groups)
    // the files a model hands out, as CAD, are no part of a guide
    expect(model.downloads).toBeUndefined()
    expect(looks).toEqual(LOOKS)
  })

  it("loads the files of those parts, and no others", () => {
    expect(filesFor(MANIFEST, guide())).toEqual([
      "base.glb",
      "base.edges.bin",
      "weight.glb",
    ])
  })
})

describe("pageOf", () => {
  it("is called by what the guide is to, with nothing in that taken for markup", () => {
    const page = pageOf(guide(), false)
    expect(page).toContain(
      "<title>Lamp &lt;base&gt; &amp; &quot;weight&quot; · Assembly Guide</title>"
    )
    expect(page).toContain('<script src="guide.js"></script>')
    expect(page).toContain('<script src="page.js"></script>')
    // served, it asks for the model's files: none are handed to it
    expect(page).not.toContain("model.js")
  })

  it("is handed the model's files where it goes into an archive", () => {
    const page = pageOf(guide(), true)
    expect(page.indexOf("model.js")).toBeGreaterThan(page.indexOf("guide.js"))
    expect(page.indexOf("page.js")).toBeGreaterThan(page.indexOf("model.js"))
  })
})

describe("archived", () => {
  it("is the page and the parts the guide shows, in a folder called as the archive is", async () => {
    const files = await archived(
      guide(),
      MANIFEST,
      path.join(root, "build"),
      LOOKS,
      path.join(root, "page")
    )
    expect(archiveName(guide())).toBe("lamp-base-weight-assembly-guide-v1")
    expect(files.map((file) => file.name)).toEqual(
      [
        "index.html",
        "page.js",
        "page.css",
        "guide.js",
        "model.js",
        "README.txt",
      ].map((name) => `lamp-base-weight-assembly-guide-v1/${name}`)
    )
    const handed = files[4].data.toString()
    expect(handed.startsWith("window.ENCLOSE_FILES = ")).toBe(true)
    const model = JSON.parse(handed.slice("window.ENCLOSE_FILES = ".length))
    expect(Object.keys(model)).toEqual([
      "base.glb",
      "base.edges.bin",
      "weight.glb",
    ])
    expect(Buffer.from(model["weight.glb"], "base64").toString()).toBe("weight")
  })

  it("takes nothing from outside the model's folder", async () => {
    const outside = {
      ...MANIFEST,
      parts: [{ ...MANIFEST.parts[0], file: "../page/page.js" }],
    }
    await expect(
      archived(
        guide(),
        outside,
        path.join(root, "build"),
        LOOKS,
        path.join(root, "page")
      )
    ).rejects.toThrow("is not in the model's folder")
  })
})

describe("GuideServer", () => {
  let server: GuideServer
  beforeEach(() => {
    server = new GuideServer(path.join(root, "page"), (id) =>
      id === "abc123"
        ? { root, manifest: path.join(root, "build/enclose.model.json") }
        : null
    )
  })
  afterEach(() => server.close())

  it("serves a guide's page, what it is told and the parts it shows", async () => {
    const address = await server.address("abc123", "lamp-base-weight-v1", LOOKS)
    expect(address).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/[\w-]{20,}\/abc123\/lamp-base-weight-v1\/$/
    )
    const page = await fetch(address)
    expect(page.status).toBe(200)
    expect(page.headers.get("content-type")).toContain("text/html")
    expect(page.headers.get("content-security-policy")).toContain(
      "script-src 'self'"
    )
    expect(await page.text()).toContain("· Assembly Guide</title>")
    expect(await (await fetch(`${address}page.js`)).text()).toBe(
      "/* the page */"
    )
    const told = await (await fetch(`${address}guide.js`)).text()
    expect(told).toContain('"colours":{"weight":"blue"}')
    const part = await fetch(`${address}model/weight.glb`)
    expect(part.headers.get("content-type")).toBe("model/gltf-binary")
    expect(await part.text()).toBe("weight")
  })

  it("serves nothing else: not another part, another file, or to another key", async () => {
    const address = await server.address("abc123", "lamp-base-weight-v1", LOOKS)
    const status = async (url: string) => (await fetch(url)).status
    // a part of the model that the guide does not show
    expect(await status(`${address}model/shade.glb`)).toBe(404)
    expect(await status(`${address}model/enclose.model.json`)).toBe(404)
    expect(await status(`${address}model/..%2F..%2Fpage%2Fpage.js`)).toBe(404)
    expect(await status(`${address}nothing.js`)).toBe(404)
    expect(await status(address.replace("lamp-base-weight-v1", "other"))).toBe(
      404
    )
    expect(await status(address.replace("abc123", "zzz999"))).toBe(404)
    expect(await status(address.replace(/\/[\w-]{20,}\//, "/wrong/"))).toBe(404)
    expect((await fetch(address, { method: "POST" })).status).toBe(405)
  })
})
