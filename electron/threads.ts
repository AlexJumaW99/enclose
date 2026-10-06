// One conversation with Claude per project. Each message starts the user's own Claude
// Code in the project folder, resuming the conversation, and turns what it reports into
// the items the window shows.
import fs from "node:fs"
import path from "node:path"

import {
  createSdkMcpServer,
  query,
  tool,
  type CanUseTool,
  type PermissionResult,
  type SDKMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk"

import type {
  Access,
  ClaudeStatus,
  PartRef,
  PermissionAnswer,
  ThreadItem,
  ThreadSummary,
  ViewportRequest,
} from "../shared/api"
import { MANIFEST_FORMAT } from "../shared/manifest-format"
import { claudeEnv } from "./claude"
import type { Projects } from "./projects"

type Run = {
  abort: AbortController
  /** ends the turn's input, which lets Claude Code exit */
  finish: () => void
  /** questions waiting on the user, by item id */
  pending: Map<string, (answer: PermissionAnswer) => void>
}

type Thread = { items: ThreadItem[]; run: Run | null; since: number | null }

export type ThreadsDeps = {
  dir: string
  projects: Projects
  claude: () => ClaudeStatus
  /** where the app keeps the exporter a project copies to write its model */
  kit: string
  /** a project's folder was renamed, from this path to that */
  onRenamed: (from: string, to: string) => void
  /** ask the window something about the viewport it is showing */
  viewport: (
    projectId: string,
    kind: ViewportRequest["kind"]
  ) => Promise<unknown>
  onItem: (projectId: string, item: ThreadItem) => void
  onReset: (projectId: string) => void
  /** a thread's status or last message changed: the sidebar needs redrawing */
  onSummary: () => void
}

const VIEWPORT_TOOLS = ["screenshot", "selection", "parts"].map(
  (t) => `mcp__viewport__${t}`
)
// there are three of them and they are the point of the app: no need to search for them
const UP_FRONT = { alwaysLoad: true }

function field(input: unknown, key: string): string {
  const value = (input as Record<string, unknown> | null)?.[key]
  return typeof value === "string" ? value : ""
}

/** A tool call in a few words: what kind of thing, and on what. */
function describeTool(name: string, input: unknown, root: string) {
  const file = (key: string) => {
    const full = field(input, key)
    return full.startsWith(root + path.sep) ? full.slice(root.length + 1) : full
  }
  switch (name) {
    case "Bash":
      return { name: "Run", detail: field(input, "command") }
    case "Read":
      return { name: "Read", detail: file("file_path") }
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return {
        name: "Edit",
        detail: file("file_path") || file("notebook_path"),
      }
    case "Write":
      return { name: "Write", detail: file("file_path") }
    case "Glob":
    case "Grep":
      return { name: "Search", detail: field(input, "pattern") }
    case "WebFetch":
      return { name: "Fetch", detail: field(input, "url") }
    case "WebSearch":
      return { name: "Web search", detail: field(input, "query") }
    case "ToolSearch":
      return {
        name: "Find tool",
        detail: field(input, "query").replace(/^select:/, ""),
      }
    case "Agent":
    case "Task":
      return { name: "Subagent", detail: field(input, "description") }
    case "mcp__viewport__screenshot":
      return { name: "Look", detail: "at the viewport" }
    case "mcp__viewport__selection":
      return { name: "Check", detail: "what is selected" }
    case "mcp__viewport__parts":
      return { name: "List", detail: "the parts on screen" }
  }
  const first = Object.values((input ?? {}) as Record<string, unknown>).find(
    (v) => typeof v === "string"
  )
  return {
    name: name.replace(/^mcp__/, "").replaceAll("__", " "),
    detail: typeof first === "string" ? first : "",
  }
}

/** The question put to the user when Claude needs a yes before using a tool. */
function question(toolName: string): string {
  switch (toolName) {
    case "Bash":
      return "Run this command?"
    case "Edit":
    case "MultiEdit":
    case "Write":
    case "NotebookEdit":
      return "Change this file?"
    case "Read":
      return "Read this file?"
    case "WebFetch":
      return "Fetch this page?"
    case "WebSearch":
      return "Search the web for this?"
  }
  return `Let Claude use ${toolName.replace(/^mcp__/, "").replaceAll("__", " ")}?`
}

/** What Claude is told about where it is, on top of Claude Code's own instructions. */
function guide(
  root: string,
  manifest: string | null,
  build: string | null,
  kit: string,
  /** what the project goes by, when that is not its folder's name */
  called: string | null,
  /** that name is only a stand-in, until the model gives the project one */
  standIn: boolean
): string {
  const lines = [
    "You are running inside Enclose, a desktop app for designing physical things in code. The user is looking at a 3D view of this project's model while they talk to you, and can click a part to ask about it.",
    "",
    ...(called && !standIn
      ? [
          `- This project is called "${called}". That is its name; the folder's is only where it is kept.`,
        ]
      : []),
    ...(standIn
      ? [
          `- This project has no name of its own yet: "${called}" is a stand-in the app made up. Give the model a title of two or three plain words that says what the thing is (the first argument of enclose.Model). The project takes that name once the model is built, and its folder is renamed to match after you finish, so do not write the folder's path into any file.`,
        ]
      : []),
    "- Keep to the model and the project. Say nothing about tools, connectors or settings of the user's that are no part of this app (an MCP server that wants signing in to, say) unless they ask.",
    "- A message may begin with a <selection> block: the part the user clicked and the point they clicked on it, in the model's own coordinates (mm, Z up).",
    "- You can see what they see. mcp__viewport__screenshot returns the current view as an image, mcp__viewport__parts lists the parts with their groups and sizes, mcp__viewport__selection returns the current selection.",
    "- The model is made of parts. Each separate component is one part: a thing that is made, bought or fitted on its own, such as a lid, a board or a screw. Whatever the user asks you to add as a thing of its own is a part of its own. The app lists the parts under groups, and the user can pick one part or one group to look at alone.",
    "- Grouping the parts is your job, not the user's. Whenever you add, split, merge or remove parts, put each one in the group a person would look for it in, by what it belongs to or what it does (the enclosure, the electronics, the fasteners), and add a group when none fits. Keep group and part labels short and plain. Do this without being asked and without asking. Regroup only when the user asks for a different arrangement, or when the model has changed so much that the old one no longer makes sense; if the user arranges the groups themselves, keep to their arrangement.",
  ]
  if (manifest) {
    lines.push(
      `- What is on screen comes from the manifest at ${path.relative(root, manifest)} and the files beside it. They are build output: never edit them by hand. Change the source that generates them and run the build again; the view reloads by itself when the manifest is rewritten.`,
      build
        ? `- The build command is: ${build}`
        : "- Find how the model is built from the project's README or scripts before changing geometry.",
      "- If the project has an enclose.py, that is the app's exporter, copied in: read its docstring for how parts and groups are declared, and do not edit it.",
      '- The groups are what the manifest says they are: its "groups" list, and the "group" each part names. Like the rest of the manifest they are written by the build.',
      "- After a change to geometry: rebuild, take a screenshot, and check the result yourself before you report it."
    )
  } else {
    lines.push(
      "- This folder has no model the app can show yet. When the user asks for something to be made, set the project up yourself, in this way, without asking them how:",
      `  1. Copy the app's exporter into the folder as enclose.py: cp "${kit}" enclose.py. Leave the copy as it is. Its docstring shows how it is used.`,
      "  2. Write model.py. Build each part with build123d, in millimetres with Z up, each part where it sits in the assembly, and hand the parts to enclose.Model as the docstring shows: one part for each separate component, in groups. If the folder already holds CAD files (STEP), start from them: build123d's import_step reads them.",
      '  3. Find a Python that has build123d: try python3 -c "import build123d". If it has not, make a virtual environment in the folder (python3 -m venv .venv, then .venv/bin/pip install build123d; or uv if it is installed) and use that one.',
      '  4. Write enclose.json at the top of the folder, naming the model and the build command: { "model": "build/enclose.model.json", "build": "python3 model.py" }, with the Python you found. Paths in it are relative to the folder, never absolute.',
      "  5. Run the build. The model shows in the app by itself once build/enclose.model.json is written. Then take a screenshot and check the result before you report it.",
      "- Keep the folder plain: model.py, enclose.py, enclose.json, and build/, which is output and never edited by hand (if the folder is a git repository, ignore build/ and .venv/).",
      "- Start with the simplest thing that is what they asked for, show it, and say in a sentence or two what you assumed (sizes, wall thickness) so that they can correct it.",
      "",
      "A project that cannot use build123d can write the model's files some other way, as long as they come out in this format:",
      "",
      MANIFEST_FORMAT
    )
  }
  return lines.join("\n")
}

function withSelection(text: string, part: PartRef | null): string {
  if (!part) return text
  const at = (v: number[] | null) =>
    v ? v.map((n) => n.toFixed(2)).join(", ") : "unknown"
  return [
    "<selection>",
    `part: ${part.label} (id "${part.id}")`,
    `point clicked (x, y, z mm): ${at(part.point)}`,
    `surface normal there: ${at(part.normal)}`,
    part.face === null ? null : `face index: ${part.face}`,
    "</selection>",
    "",
    text,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

function firstLine(text: string): string {
  const line = text.trim().split("\n")[0] ?? ""
  return line.length > 140 ? `${line.slice(0, 140)}…` : line
}

/**
 * An item as it should read once nothing is running any more. The app can be closed in
 * the middle of a turn; what was in flight then did not finish, and must not come back
 * looking as if it were still going.
 */
function settled(item: ThreadItem): ThreadItem {
  if (item.kind === "tool" && item.state === "running")
    return { ...item, state: "failed" }
  if (item.kind === "permission" && item.state === "pending")
    return { ...item, state: "denied" }
  if (item.kind === "assistant" && item.streaming)
    return { ...item, streaming: false }
  return item
}

export class Threads {
  private readonly deps: ThreadsDeps
  private threads = new Map<string, Thread>()
  private saving = new Map<string, NodeJS.Timeout>()
  private counter = 0

  constructor(deps: ThreadsDeps) {
    this.deps = deps
  }

  private file(projectId: string) {
    return path.join(this.deps.dir, `${projectId}.json`)
  }

  private thread(projectId: string): Thread {
    let thread = this.threads.get(projectId)
    if (!thread) {
      let items: ThreadItem[] = []
      try {
        items = (
          JSON.parse(
            fs.readFileSync(this.file(projectId), "utf8")
          ) as ThreadItem[]
        ).map(settled)
      } catch {
        // no conversation yet
      }
      thread = { items, run: null, since: null }
      this.threads.set(projectId, thread)
    }
    return thread
  }

  private write(projectId: string) {
    clearTimeout(this.saving.get(projectId))
    this.saving.delete(projectId)
    const thread = this.threads.get(projectId)
    if (!thread) return
    fs.mkdirSync(this.deps.dir, { recursive: true })
    fs.writeFileSync(this.file(projectId), JSON.stringify(thread.items))
  }

  /** Add an item, or replace the one with the same id. */
  private put(projectId: string, item: ThreadItem) {
    const thread = this.thread(projectId)
    const index = thread.items.findIndex((i) => i.id === item.id)
    if (index < 0) thread.items.push(item)
    else thread.items[index] = item
    this.deps.onItem(projectId, item)
    if (!this.saving.has(projectId)) {
      this.saving.set(
        projectId,
        setTimeout(() => this.write(projectId), 800)
      )
    }
  }

  private notice(projectId: string, tone: "error" | "info", text: string) {
    this.put(projectId, {
      kind: "notice",
      id: `note-${++this.counter}-${Date.now()}`,
      at: Date.now(),
      tone,
      text,
    })
  }

  items(projectId: string): ThreadItem[] {
    return this.thread(projectId).items
  }

  summary(projectId: string): ThreadSummary {
    const thread = this.thread(projectId)
    const last = thread.items.findLast(
      (i) => i.kind === "user" || i.kind === "assistant"
    )
    return {
      status: !thread.run
        ? "idle"
        : thread.run.pending.size > 0
          ? "asking"
          : "working",
      since: thread.since,
      lastMessage: last && "text" in last ? firstLine(last.text) : null,
      updatedAt: thread.items.at(-1)?.at ?? null,
    }
  }

  answer(projectId: string, permissionId: string, answer: PermissionAnswer) {
    this.thread(projectId).run?.pending.get(permissionId)?.(answer)
  }

  stop(projectId: string) {
    this.thread(projectId).run?.abort.abort()
  }

  reset(projectId: string) {
    this.stop(projectId)
    this.threads.set(projectId, { items: [], run: null, since: null })
    this.deps.projects.setSession(projectId, null)
    this.write(projectId)
    this.deps.onReset(projectId)
    this.deps.onSummary()
  }

  async send(
    projectId: string,
    text: string,
    part: PartRef | null,
    access: Access
  ) {
    const project = this.deps.projects.get(projectId)
    const thread = this.thread(projectId)
    if (!project || thread.run) return

    const now = Date.now()
    this.put(projectId, {
      kind: "user",
      id: `user-${now}`,
      at: now,
      text,
      part,
    })

    const abort = new AbortController()
    let finish = () => {}
    const finished = new Promise<void>((resolve) => (finish = resolve))
    const run: Run = { abort, finish, pending: new Map() }
    thread.run = run
    thread.since = now
    this.deps.onSummary()

    // Keep the input open until the turn is over: approvals and viewport tools are
    // answered over the same channel the message went in on.
    const prompt = withSelection(text, part)
    async function* input(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: "user",
        message: { role: "user", content: prompt },
        parent_tool_use_id: null,
      }
      await finished
    }

    const canUseTool: CanUseTool = (toolName, toolInput, options) =>
      new Promise<PermissionResult>((resolve) => {
        const id = `ask-${++this.counter}-${Date.now()}`
        const shown = describeTool(toolName, toolInput, project.path)
        const item = {
          kind: "permission" as const,
          id,
          at: Date.now(),
          title: options.title ?? question(toolName),
          detail: shown.detail,
          canAlways: Boolean(options.suggestions?.length),
        }
        const settle = (answer: PermissionAnswer) => {
          if (!run.pending.delete(id)) return
          this.put(projectId, {
            ...item,
            state: answer === "deny" ? "denied" : "allowed",
          })
          this.deps.onSummary()
          resolve(
            answer === "deny"
              ? { behavior: "deny", message: "The user declined this." }
              : {
                  behavior: "allow",
                  updatedInput: toolInput,
                  ...(answer === "always"
                    ? { updatedPermissions: options.suggestions }
                    : {}),
                }
          )
        }
        run.pending.set(id, settle)
        options.signal.addEventListener("abort", () => settle("deny"), {
          once: true,
        })
        this.put(projectId, { ...item, state: "pending" })
        this.deps.onSummary()
      })

    const ask = (kind: ViewportRequest["kind"]) =>
      this.deps.viewport(projectId, kind)
    const text_ = (value: unknown) => ({
      content: [
        { type: "text" as const, text: JSON.stringify(value, null, 1) },
      ],
    })
    const failed = (error: unknown) => ({
      content: [
        {
          type: "text" as const,
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    })
    const viewport = createSdkMcpServer({
      name: "viewport",
      version: "0.1.0",
      tools: [
        tool(
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
                  {
                    type: "image" as const,
                    data: shot.data,
                    mimeType: shot.mimeType,
                  },
                ],
              }
            } catch (error) {
              return failed(error)
            }
          },
          UP_FRONT
        ),
        tool(
          "selection",
          "The part the user has selected in the viewport, with the point they clicked (model coordinates, mm). Null if nothing is selected.",
          {},
          async () => ask("selection").then(text_, failed),
          UP_FRONT
        ),
        tool(
          "parts",
          "Every part of the model on screen: id, label, the group it is listed under, bounding box in model coordinates (mm), and whether it is currently shown.",
          {},
          async () => ask("parts").then(text_, failed),
          UP_FRONT
        ),
      ],
    })

    // text that arrived piece by piece, so the whole message that follows is not shown twice
    const streamed = new Set<string>()
    let messageId: string | null = null
    const tools = new Map<string, Extract<ThreadItem, { kind: "tool" }>>()
    const live = new Map<string, Extract<ThreadItem, { kind: "assistant" }>>()

    const handle = (message: SDKMessage) => {
      if (message.type === "system" && message.subtype === "init") {
        this.deps.projects.setSession(projectId, message.session_id)
        return
      }
      if (message.type === "stream_event") {
        if (message.parent_tool_use_id) return
        const event = message.event
        if (event.type === "message_start") {
          messageId = event.message.id
        } else if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          messageId
        ) {
          streamed.add(messageId)
          const id = `${messageId}:${event.index}`
          const item = live.get(id) ?? {
            kind: "assistant",
            id,
            at: Date.now(),
            text: "",
            streaming: true,
          }
          item.text += event.delta.text
          live.set(id, item)
          this.put(projectId, { ...item })
        } else if (event.type === "content_block_stop" && messageId) {
          const id = `${messageId}:${event.index}`
          const item = live.get(id)
          if (item) {
            live.delete(id)
            this.put(projectId, { ...item, streaming: false })
            this.deps.onSummary()
          }
        }
        return
      }
      if (message.type === "assistant") {
        if (message.parent_tool_use_id) return
        if (message.error)
          this.notice(
            projectId,
            "error",
            `Claude could not answer: ${message.error.replaceAll("_", " ")}.`
          )
        message.message.content.forEach((block, index) => {
          if (
            block.type === "text" &&
            block.text.trim() &&
            !streamed.has(message.message.id)
          ) {
            this.put(projectId, {
              kind: "assistant",
              id: `${message.message.id}:${index}:whole`,
              at: Date.now(),
              text: block.text,
              streaming: false,
            })
            this.deps.onSummary()
          } else if (block.type === "tool_use") {
            const item = {
              kind: "tool" as const,
              id: block.id,
              at: Date.now(),
              ...describeTool(block.name, block.input, project.path),
              state: "running" as const,
            }
            tools.set(block.id, item)
            this.put(projectId, item)
          }
        })
        return
      }
      if (message.type === "user") {
        const content = message.message.content
        if (typeof content === "string") return
        for (const block of content) {
          if (block.type !== "tool_result") continue
          const item = tools.get(block.tool_use_id)
          if (!item) continue
          tools.delete(block.tool_use_id)
          this.put(projectId, {
            ...item,
            state: block.is_error ? "failed" : "done",
          })
        }
        // What Claude just did may have written the model for the first time, or moved
        // it: look again now, so the view has it before Claude asks to see it.
        this.deps.projects.refresh(projectId)
        this.deps.onSummary()
        return
      }
      if (message.type === "result") {
        this.deps.projects.setSession(projectId, message.session_id)
        if (message.subtype !== "success") {
          this.notice(
            projectId,
            "error",
            message.errors.join("\n") ||
              `Stopped: ${message.subtype.replaceAll("_", " ")}.`
          )
        } else if (message.is_error) {
          this.notice(
            projectId,
            "error",
            message.result || "Claude Code reported an error."
          )
        }
        finish()
      }
    }

    const claude = this.deps.claude()
    let stderr = ""
    try {
      const session = query({
        prompt: input(),
        options: {
          cwd: project.path,
          resume: project.sessionId ?? undefined,
          pathToClaudeCodeExecutable: claude.path ?? undefined,
          env: claudeEnv(),
          abortController: abort,
          includePartialMessages: true,
          settingSources: ["user", "project", "local"],
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: guide(
              project.path,
              project.manifest,
              project.build,
              this.deps.kit,
              project.name ?? null,
              project.standIn === true
            ),
          },
          mcpServers: { viewport },
          allowedTools: VIEWPORT_TOOLS,
          // it would need its own form here; until then Claude asks in plain text
          disallowedTools: ["AskUserQuestion"],
          ...(access === "full"
            ? {
                permissionMode: "bypassPermissions" as const,
                allowDangerouslySkipPermissions: true,
              }
            : { permissionMode: "acceptEdits" as const, canUseTool }),
          stderr: (data) => {
            stderr = (stderr + data).slice(-2000)
          },
        },
      })
      for await (const message of session) handle(message)
    } catch (error) {
      if (abort.signal.aborted) {
        this.notice(projectId, "info", "Stopped.")
      } else {
        const reason = error instanceof Error ? error.message : String(error)
        this.notice(
          projectId,
          "error",
          [reason, stderr.trim()].filter(Boolean).join("\n")
        )
      }
    } finally {
      finish()
      for (const settle of [...run.pending.values()]) settle("deny")
      for (const item of live.values())
        this.put(projectId, { ...item, streaming: false })
      for (const item of tools.values())
        this.put(projectId, { ...item, state: "failed" })
      thread.run = null
      thread.since = null
      this.write(projectId)
      // Claude may have created, moved or rebuilt the model
      this.deps.projects.refresh(projectId)
      // and with nothing at work in the folder any more, a project that has just been
      // given its shape can take its name
      this.deps.projects.christen(projectId, this.deps.onRenamed)
      this.deps.onSummary()
    }
  }

  close() {
    for (const [projectId, thread] of this.threads) {
      thread.run?.abort.abort()
      if (this.saving.has(projectId)) this.write(projectId)
    }
  }
}
