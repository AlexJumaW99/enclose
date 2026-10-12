// A guide as a page: what an assembly guide is handed out as (see assembly.ts).
//
// The page is the app's own (src/guide) and the same for every guide: what differs is
// what it is told, which is the guide and the parts of the model that it shows. Opened
// from the app it is served from this machine, with the parts read from where the
// model's build left them, so nothing is copied for it. Taken away, it is an archive
// with the page and those parts in it: that opens from a folder as it is, with no
// server, and can be put on a site.
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import type { AddressInfo } from "node:net"
import path from "node:path"

import type { Looks } from "../shared/api"
import { fileNameOf, partsIn, type Guide } from "../shared/assembly-format"
import { counted, guideOf } from "./assembly"
import { resolveInside } from "./projects"
import type { Zipped } from "./zip"

/** What the page of a guide is made of: the app's own two files, built from src/guide. */
export const PAGE = { script: "page.js", styles: "page.css" }
/** What the page is told, each a file it loads before its own script. */
const TOLD = { guide: "guide.js", files: "model.js" }
/** Where the page asks for the model's files, when they are not handed to it. */
const MODEL = "model/"

type Json = Record<string, unknown>

/** The parts of a manifest, as far as they are objects that name a file. */
function partsOf(manifest: unknown): Json[] {
  const parts = (manifest as { parts?: unknown } | null)?.parts
  return (Array.isArray(parts) ? parts : []).filter(
    (part): part is Json =>
      typeof part === "object" &&
      part !== null &&
      typeof (part as Json).id === "string" &&
      typeof (part as Json).file === "string"
  )
}

/**
 * A model's manifest with only the parts a guide shows in it, and nothing but what
 * draws them: the files it hands out, as CAD, are no part of a guide.
 */
function shownOf(manifest: unknown, guide: Guide): Json {
  const shown = new Set(partsIn(guide))
  const rest = { ...((manifest ?? {}) as Json) }
  delete rest.downloads
  delete rest.keepouts
  return {
    ...rest,
    parts: partsOf(manifest).filter((part) => shown.has(part.id as string)),
  }
}

/** The files of a model that a guide's page loads, as its manifest names them. */
export function filesFor(manifest: unknown, guide: Guide): string[] {
  const shown = new Set(partsIn(guide))
  return [
    ...new Set(
      partsOf(manifest)
        .filter((part) => shown.has(part.id as string))
        .flatMap((part) => [
          part.file as string,
          ...(typeof part.edges === "string" ? [part.edges] : []),
        ])
    ),
  ]
}

/** What the page is told of a guide: the guide, the model it is of, and how its parts are drawn. */
export function toldOf(guide: Guide, manifest: unknown, looks: Looks): string {
  const told = { guide, model: shownOf(manifest, guide), looks }
  return `window.ENCLOSE_GUIDE = ${JSON.stringify(told)}\n`
}

/** The model's files as the page is handed them in an archive: each by name, in base64. */
export function handedOver(files: { name: string; data: Buffer }[]): string {
  const each = files.map(
    ({ name, data }) => `${JSON.stringify(name)}:"${data.toString("base64")}"`
  )
  return `window.ENCLOSE_FILES = {${each.join(",")}}\n`
}

const escaped = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/**
 * The page of a guide. It is the same page for every guide, but for what it is called:
 * the rest it is told by the files it loads. `handed` is the page as it goes into an
 * archive, where the model's files are handed to it and not asked for: a page opened
 * from a folder cannot ask for a file.
 */
export function pageOf(guide: Guide, handed: boolean): string {
  const about =
    guide.summary ??
    `How to put ${guide.title} together, in ${counted(guide.steps.length, "step")}.`
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <meta name="color-scheme" content="dark" />',
    `    <title>${escaped(guide.title)} · Assembly Guide</title>`,
    `    <meta name="description" content="${escaped(about)}" />`,
    // (it has no picture of its own for a tab, and is not to be asked for one)
    '    <link rel="icon" href="data:," />',
    `    <link rel="stylesheet" href="${PAGE.styles}" />`,
    "  </head>",
    "  <body>",
    "    <noscript>This guide shows the model in 3D, and needs JavaScript for it.</noscript>",
    `    <script src="${TOLD.guide}"></script>`,
    ...(handed ? [`    <script src="${TOLD.files}"></script>`] : []),
    `    <script src="${PAGE.script}"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n")
}

/** What goes with an archive for whoever opens it: what it is, and what to do with it. */
const readMe = (guide: Guide) =>
  [
    `${guide.title}: assembly guide, version ${guide.version}`,
    "",
    "Open index.html in a browser to read it. It needs nothing else: the model is in the",
    "folder with it.",
    "",
    "To share it, send this folder, or the archive it came in. To put it on a site,",
    "upload the folder as it is: index.html is the page.",
    "",
  ].join("\n")

/** What an archive of a guide is called, and the folder in it, without an ending. */
export const archiveName = (guide: Guide) =>
  `${fileNameOf(guide.title)}-assembly-guide-v${guide.version}`

/**
 * A guide as the files of an archive: the page, what it is told, and the parts of the
 * model it shows, read from `from`, the folder the model's manifest is in. They are in
 * one folder, called as the archive is. `page` is where the app's page is built to.
 */
export async function archived(
  guide: Guide,
  manifest: unknown,
  from: string,
  looks: Looks,
  page: string
): Promise<Zipped[]> {
  const files = await Promise.all(
    filesFor(manifest, guide).map(async (name) => {
      const file = resolveInside(from, name)
      if (!file) throw new Error(`"${name}" is not in the model's folder.`)
      return { name, data: await fs.promises.readFile(file) }
    })
  )
  const folder = archiveName(guide)
  const own = await Promise.all(
    Object.values(PAGE).map(async (name) => ({
      name,
      data: await fs.promises.readFile(path.join(page, name)),
    }))
  )
  return [
    { name: "index.html", data: Buffer.from(pageOf(guide, true)) },
    ...own,
    { name: TOLD.guide, data: Buffer.from(toldOf(guide, manifest, looks)) },
    { name: TOLD.files, data: Buffer.from(handedOver(files)) },
    { name: "README.txt", data: Buffer.from(readMe(guide)) },
  ].map(({ name, data }) => ({ name: `${folder}/${name}`, data }))
}

// --- the page, served from this machine -------------------------------------------------

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".bin": "application/octet-stream",
}

/**
 * What the page may load, when it is served: itself, and nothing from anywhere else.
 * What a guide says was written by an agent, and is shown as words and never run.
 */
const POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

/** What a guide is served from: where it is, and the model it is of. */
export type Served = {
  /** the project's folder */
  root: string
  /** where the model's manifest is, in it or wherever it is */
  manifest: string
}

/**
 * Serves guides as pages, to this machine only, for as long as the app is open. Where
 * they are is known only to whoever the app opened a browser for: the address has a key
 * in it that is made when the app starts, and gone when it quits.
 */
export class GuideServer {
  private server: http.Server | null = null
  private port: Promise<number> | null = null
  private readonly key = randomBytes(18).toString("base64url")
  /** how each project's parts are drawn, as the window last said, by project */
  private looks = new Map<string, Looks>()
  private readonly page: string
  private readonly project: (id: string) => Served | null

  /**
   * `page` is where the app's page is built to; `project` says where a project is, and
   * its model, by the project's id.
   */
  constructor(page: string, project: (id: string) => Served | null) {
    this.page = page
    this.project = project
  }

  private listen(): Promise<number> {
    this.port ??= new Promise<number>((resolve, reject) => {
      const server = http.createServer((request, response) => {
        void this.handle(request, response).catch(() => {
          if (!response.headersSent) response.writeHead(500)
          response.end()
        })
      })
      server.once("error", reject)
      server.listen(0, "127.0.0.1", () => {
        this.server = server
        resolve((server.address() as AddressInfo).port)
      })
    })
    return this.port
  }

  private async handle(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) {
    const send = (status: number, type?: string, body?: Buffer | string) =>
      response
        .writeHead(status, {
          ...(type ? { "content-type": type } : {}),
          "cache-control": "no-store",
          "content-security-policy": POLICY,
          "x-content-type-options": "nosniff",
        })
        .end(body)
    if (request.method !== "GET" && request.method !== "HEAD") return send(405)
    // /<key>/<project>/<guide>/<file>
    const [, key, projectId, guideId, ...rest] = decodeURIComponent(
      (request.url ?? "").split("?")[0]
    ).split("/")
    const served = key === this.key ? this.project(projectId ?? "") : null
    const guide = served && guideOf(served.root, guideId ?? "")
    if (!served || !guide) return send(404)
    const name = rest.join("/") || "index.html"
    const type = MIME[path.extname(name).toLowerCase()] ?? MIME[".bin"]
    if (name === "index.html") return send(200, type, pageOf(guide, false))
    if (Object.values(PAGE).includes(name))
      return send(
        200,
        type,
        await fs.promises.readFile(path.join(this.page, name))
      )
    const manifest: unknown = JSON.parse(
      await fs.promises.readFile(served.manifest, "utf8")
    )
    if (name === TOLD.guide)
      return send(
        200,
        type,
        toldOf(guide, manifest, this.looks.get(projectId) ?? { colours: {} })
      )
    // of the model's files, the ones the guide shows and no others
    const wanted = name.startsWith(MODEL) ? name.slice(MODEL.length) : null
    const file =
      wanted !== null && filesFor(manifest, guide).includes(wanted)
        ? resolveInside(path.dirname(served.manifest), wanted)
        : null
    if (!file) return send(404)
    try {
      send(200, type, await fs.promises.readFile(file))
    } catch {
      send(404)
    }
  }

  /** Where a project's guide is served, for a browser to be opened at. */
  async address(
    projectId: string,
    guideId: string,
    looks: Looks
  ): Promise<string> {
    this.looks.set(projectId, looks)
    const port = await this.listen()
    return `http://127.0.0.1:${port}/${this.key}/${projectId}/${guideId}/`
  }

  close() {
    this.server?.close()
    this.server = null
    this.port = null
  }
}
