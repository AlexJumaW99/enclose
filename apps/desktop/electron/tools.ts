// The app's own tools: what an agent sees the model with, and the one thing it changes a
// model with on looking it over. Claude Code is handed them in-process, through its SDK.
// Codex and Grok cannot be: they are told an address on this machine instead, where the
// same tools answer as MCP servers over HTTP for as long as a turn lasts.
import { randomBytes } from "node:crypto"
import http from "node:http"
import type { AddressInfo } from "node:net"

import { z } from "zod"

import type { ViewportAsked } from "../shared/api"
import { ASSEMBLY_FOLDER, type GuideGiven } from "../shared/assembly-format"
import type { Arrangement } from "./imports"

/** What a tool gives back: words, or a picture. */
export type ToolResult = {
  content: (
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  )[]
  isError?: boolean
}

/** One of the app's tools, as any agent is given it. */
export type AppTool = {
  name: string
  description: string
  /** what it takes, field by field; nothing, for a tool that takes nothing */
  shape: z.ZodRawShape
  run: (given: never) => Promise<ToolResult>
}

/** A tool, with what it is run with checked against what it says it takes. */
function appTool<Shape extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: Shape,
  run: (given: z.infer<z.ZodObject<Shape>>) => Promise<ToolResult>
): AppTool {
  return { name, description, shape, run: run as AppTool["run"] }
}

const words = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
})
const failed = (error: unknown): ToolResult => ({
  ...words(error instanceof Error ? error.message : String(error)),
  isError: true,
})
const told = (value: unknown) => words(JSON.stringify(value, null, 1))

/** What each set of tools is called, as the server an agent finds them under. */
export const VIEWPORT = "viewport"
export const MODEL = "model"
export const ASSEMBLY = "assembly"

/**
 * The tools an agent sees what the user sees with. `ask` puts a question to the window.
 * With `trying`, it has the two as well that a project's own tools are tried with: the
 * ones made for the user to work the model with (see shared/tool-format.ts).
 */
export function viewportTools(
  ask: (asked: ViewportAsked) => Promise<unknown>,
  trying = false
): AppTool[] {
  return [
    ...seeing((kind) => ask({ kind })),
    ...(trying ? tryingTools(ask) : []),
  ]
}

/** What a project's own tools are tried with: how they stand, and a hand on a control. */
function tryingTools(
  ask: (asked: ViewportAsked) => Promise<unknown>
): AppTool[] {
  return [
    appTool(
      "tools",
      "The project's own tools (the files in tools/), as the app has them loaded right now: for each its name, every control with its current value, and its error if it failed to load or run. Opens the Tools panel in the view if it is not open. Call it after writing or changing a tool, to see that it loaded.",
      {},
      async () => ask({ kind: "tools" }).then(told, failed)
    ),
    appTool(
      "tool",
      "Work one control of one of the project's own tools, as the user's hand would: set its value, or press one of its buttons. The model in the view moves as the tool has it. Returns that tool as it stands once what it set moving has come to rest (or after six seconds, if it has not); take a screenshot afterwards to see the model.",
      {
        tool: z.string().describe('The tool, by its file\'s name: "clock".'),
        control: z.string().describe("The control, by its key in controls."),
        value: z
          .union([
            z.number(),
            z.boolean(),
            z.string(),
            z.tuple([z.number(), z.number()]),
          ])
          .optional()
          .describe(
            "What to set it to: a number for a slider, [x, y] for a pad, true or false for a toggle, an option's id for a choice or a list, a colour's name for a palette."
          ),
        press: z
          .string()
          .optional()
          .describe("For buttons: the id of the one to press."),
      },
      async (use) => ask({ kind: "tool", use }).then(told, failed)
    ),
  ]
}

function seeing(
  ask: (kind: "screenshot" | "selection" | "parts") => Promise<unknown>
): AppTool[] {
  return [
    appTool(
      "screenshot",
      "The 3D viewport exactly as the user sees it right now, as an image: same camera, same exploded/section/see-through settings.",
      {},
      async () => {
        try {
          const shot = (await ask("screenshot")) as {
            data: string
            mimeType: string
          }
          return {
            content: [
              { type: "image", data: shot.data, mimeType: shot.mimeType },
            ],
          }
        } catch (error) {
          return failed(error)
        }
      }
    ),
    appTool(
      "selection",
      "The part the user has selected in the viewport, with the point they clicked (model coordinates, mm). Where they selected a whole object and not one part, piece gives what the app calls it and the ids of all its parts, and the rest is where on it they clicked. Null if nothing is selected.",
      {},
      async () => ask("selection").then(told, failed)
    ),
    appTool(
      "parts",
      "Every part of the model on screen: id, label, the group it is listed under (its id, and groupLabel for what it goes by), bounding box in model coordinates (mm), and whether it is currently shown. byHand marks a part the user has put in another group than the manifest has it in, by hand in the app: that is the group given here.",
      {},
      async () => ask("parts").then(told, failed)
    ),
  ]
}

/**
 * On a model's being looked over, the one thing an agent can change it with: the names
 * and groups of its parts, which `arrange` writes down and builds. `scenes` are the
 * reference scenes the app has, by what each is known by, for it to say which suits.
 */
export function modelTools(
  arrange: (given: Arrangement) => Promise<string>,
  scenes: string[] = []
): AppTool[] {
  return [
    appTool(
      "arrange",
      "Name and group the parts of the model that has just been made of the user's CAD files. Writes the names and groups into the project's model.py and builds it again; the view then shows the model so. Call it once, with every part.",
      {
        what: z
          .string()
          .describe(
            'What the thing is, in a few plain words: "a planetary clock movement".'
          ),
        reference: z
          .string()
          .optional()
          .describe(
            `Which of the app's reference scenes the thing is best seen in, by where it is used${scenes.length > 0 ? `: ${scenes.join(" or ")}` : ""}.`
          ),
        groups: z
          .array(
            z.object({
              name: z.string().describe("Short and plain."),
              outside: z
                .boolean()
                .optional()
                .describe(
                  "True if the parts in it enclose the rest: the app can then show what is inside through them."
                ),
            })
          )
          .describe("In the order the list of parts is to show them."),
        parts: z
          .array(
            z.object({
              id: z.string().describe("As in the list you were given."),
              name: z.string().describe("What the part is to go by."),
              group: z.string().describe("The name of one of the groups."),
            })
          )
          .describe("Every part of the model."),
      },
      async (given) => arrange(given).then(words, failed)
    ),
  ]
}

/**
 * What an agent writes an assembly guide with (see shared/assembly-format.ts). `write`
 * checks what it gives against the model and files it, and says in a line what came of
 * it: or rejects, in words the guide can be mended by.
 */
export function assemblyTools(
  write: (given: GuideGiven) => Promise<string>
): AppTool[] {
  const three = z.array(z.number()).length(3)
  return [
    appTool(
      "guide",
      `Write an assembly guide for the model: how the thing is put together, a step at a time. The app checks it against the model's parts, files it in ${ASSEMBLY_FOLDER}/ as the next version of the guide to that thing, and shows its cover in the Assembly view; the user opens it there as a page that shows the model's own parts going on step by step. Give the whole guide each time. Called again in the same turn, it takes the place of what the turn wrote before.`,
      {
        title: z
          .string()
          .describe(
            'What the guide is to putting together: the thing, as the model is called ("Counter stool"), or for a guide to part of it, that part ("Footrest").'
          ),
        summary: z
          .string()
          .optional()
          .describe(
            "A line or two for the top of the guide: what is being put together, and anything to know before starting."
          ),
        needs: z
          .array(z.string())
          .optional()
          .describe(
            'What is needed that is no part of the model, each in a few words: "4 mm hex key", "Wood glue".'
          ),
        already: z
          .array(z.string())
          .optional()
          .describe(
            "For a guide to part of the model: the ids of the parts that are there before the first step, which the guide's parts are fitted to. They are shown from the start, and no step puts them on."
          ),
        steps: z
          .array(
            z.object({
              title: z
                .string()
                .describe('What is done, in a few words: "Fit the seat".'),
              text: z
                .string()
                .describe(
                  "How, said to the person doing it: which way round, what it goes into, what holds it, how tight. Two to four plain sentences."
                ),
              parts: z
                .array(z.string())
                .describe(
                  "The ids of the parts that go on in this step. A part goes on in one step only; a step that only turns the thing over or checks it has none."
                ),
              from: three
                .optional()
                .describe(
                  "Where these parts come from, as [x, y, z] in mm from where they end up, in the model's frame (Z up): [0, 0, 60] has them come down from 60 mm above. Give the way they really go on, clear of what is already there: it is the same for every part of the step. Leave it out only where the parts of a step go on from different sides, as four bolts through four legs do: each then comes in its own way from outside."
                ),
              view: three
                .optional()
                .describe(
                  "Where the step is best seen from: the way from the model to the eye, [x, y, z] in the model's frame. [1, -1, 0.8] is from the front right, a little above; [0, 0, -1] from underneath. Left out, the view stays as it was."
                ),
              tip: z
                .string()
                .optional()
                .describe(
                  "Something to take care over in this step, in a sentence, where there is anything."
                ),
            })
          )
          .describe("In the order they are done."),
      },
      async (given) => write(given).then(words, failed)
    ),
  ]
}

// --- the same tools, over HTTP --------------------------------------------------------

/** The versions of MCP this answers to, the one it would sooner speak first. */
const VERSIONS = ["2025-06-18", "2025-11-25", "2025-03-26", "2024-11-05"]
/** The most that is read of one request, in bytes: far more than any call to these is. */
const MOST = 4_000_000

type Message = {
  id?: number | string | null
  method?: string
  params?: {
    protocolVersion?: unknown
    name?: unknown
    arguments?: unknown
  } | null
}

/** What a tool says it takes, as MCP wants it said. */
function schemaOf(shape: z.ZodRawShape) {
  const schema: Record<string, unknown> = {
    ...z.toJSONSchema(z.object(shape)),
  }
  // which draft it is written in is no part of what a tool takes
  delete schema.$schema
  return schema
}

/**
 * The answer to one message put to a set of tools, as an MCP server gives it: nothing,
 * to one that wants no answer.
 */
export async function answerTo(
  name: string,
  tools: AppTool[],
  message: Message
): Promise<Record<string, unknown> | null> {
  const { id, method, params } = message
  if (id === undefined || id === null || typeof method !== "string") return null
  const result = (value: unknown) => ({ jsonrpc: "2.0", id, result: value })
  const error = (code: number, text: string) => ({
    jsonrpc: "2.0",
    id,
    error: { code, message: text },
  })
  switch (method) {
    case "initialize": {
      const wanted = params?.protocolVersion
      return result({
        protocolVersion:
          VERSIONS.find((version) => version === wanted) ?? VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name, version: "0.1.0" },
      })
    }
    case "ping":
      return result({})
    case "tools/list":
      return result({
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: schemaOf(tool.shape),
        })),
      })
    case "tools/call": {
      const tool = tools.find((one) => one.name === params?.name)
      if (!tool) return error(-32602, `Unknown tool: ${String(params?.name)}`)
      const given = z.object(tool.shape).safeParse(params?.arguments ?? {})
      if (!given.success)
        return result(
          failed(
            `What was given is not what ${tool.name} takes:\n${z.prettifyError(given.error)}`
          )
        )
      return result(await tool.run(given.data as never).catch(failed))
    }
  }
  return error(-32601, `Method not found: ${method}`)
}

/** Tools being served: where each set is, and what stops serving them. */
export type Serving = { urls: Record<string, string>; stop: () => void }

/**
 * Serves sets of tools over HTTP, to this machine only, each for as long as it is wanted.
 * Where a set is, is known only to whoever was told: the address has a key in it that is
 * made for the occasion and gone with it.
 */
export class ToolServer {
  private server: http.Server | null = null
  private port: Promise<number> | null = null
  private served = new Map<string, Record<string, AppTool[]>>()

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
    // /<key>/<set>
    const [, key, name] = (request.url ?? "").split("?")[0].split("/")
    const tools = this.served.get(key ?? "")?.[name ?? ""]
    // a page in a browser has no business here, whatever it was told
    const origin = request.headers.origin
    if (!tools || (origin !== undefined && origin !== "null")) {
      response.writeHead(tools ? 403 : 404).end()
      return
    }
    // there is nothing it has to say unasked, and nothing kept between one call and the next
    if (request.method !== "POST") {
      response.writeHead(405, { allow: "POST" }).end()
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request as AsyncIterable<Buffer>) {
      size += chunk.length
      if (size > MOST) {
        response.writeHead(413).end()
        return
      }
      chunks.push(chunk)
    }
    let asked: unknown
    try {
      asked = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    } catch {
      response.writeHead(400).end()
      return
    }
    const several = Array.isArray(asked)
    const answers = (
      await Promise.all(
        (several ? (asked as Message[]) : [asked as Message]).map((message) =>
          answerTo(name, tools, message ?? {})
        )
      )
    ).filter((answer) => answer !== null)
    // nothing in it wanted an answer
    if (answers.length === 0) {
      response.writeHead(202).end()
      return
    }
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(several ? answers : answers[0]))
  }

  /** Serve these sets of tools, each under its name, until told to stop. */
  async serve(sets: Record<string, AppTool[]>): Promise<Serving> {
    const port = await this.listen()
    const key = randomBytes(24).toString("base64url")
    this.served.set(key, sets)
    return {
      urls: Object.fromEntries(
        Object.keys(sets).map((name) => [
          name,
          `http://127.0.0.1:${port}/${key}/${name}`,
        ])
      ),
      stop: () => {
        this.served.delete(key)
      },
    }
  }

  close() {
    this.served.clear()
    this.server?.close()
    this.server = null
    this.port = null
  }
}
