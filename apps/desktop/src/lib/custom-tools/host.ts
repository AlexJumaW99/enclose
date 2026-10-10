// A project's own tools, as the window runs them: each in a worker of its own (see
// runner.ts), told when a frame is to be drawn and heard back from with where the parts
// then are. What the panel shows of them is kept here, and where the view is to draw
// each part.
import * as THREE from "three"
import { create } from "zustand"

import type { ToolSource } from "@shared/api"

import { titled } from "./declare"
import { pose } from "./poses"
import Runner from "./runner?worker&inline"
import type {
  Control,
  FromRunner,
  Looks,
  PartFact,
  ToRunner,
  Value,
} from "./types"

/** One of the project's tools, as the panel shows it: a tab, and the controls under it. */
export type Tool = {
  id: string
  /** where it is written, in the project's folder */
  file: string
  name: string
  controls: Control[]
  /** it has said what it is: until then there is nothing of it to show */
  ready: boolean
  /** what went wrong in it, if something did: it is then at work no longer */
  error: string | null
}

const NO_LOOKS: Looks = { hidden: [], colours: {} }

export const useTools = create<{
  /**
   * Whose tools these are, and as of which writing of them: the project, and the number
   * it gives its tools as they now are. Null while none are running.
   */
  of: string | null
  tools: Tool[]
  /** the tool whose tab is turned to, where one has been */
  tab: string | null
  /** how the tools between them have the parts look, apart from where they are */
  looks: Looks
}>(() => ({ of: null, tools: [], tab: null, looks: NO_LOOKS }))

/** How long a tool is waited for, to say what it is or to draw a frame, in ms. */
const PATIENCE = 3000

type Running = {
  id: string
  worker: Worker
  /** when it was started, and when it was last told to draw and has not yet: the window's clock */
  started: number
  awaiting: number | null
  ready: boolean
  /** how many things have been done to its controls by hand */
  count: number
  /** where it has each part it has moved */
  poses: Map<string, THREE.Matrix4>
  looks: Looks
  /** it has something on its way to where it was sent, as of the frame it last drew */
  settling: boolean
}

/** The tools at work, in the order of their tabs. */
let running: Running[] = []
/** The project they are of. */
let project: string | null = null
let frame: number | null = null

/**
 * What the controls of each tool were last set to, by project and tool: a tool started
 * again, its file having been written or the model built, goes on from there. Kept for
 * as long as the window is up.
 */
const kept = new Map<string, Record<string, Value>>()
/** What each project's tools were last found written as, by tool: to know a new one by. */
const written = new Map<string, Map<string, string>>()

/** Work out where the parts are from what each tool says, one tool after another. */
function compose() {
  const all = new Map<string, THREE.Matrix4>()
  for (const tool of running)
    for (const [id, moved] of tool.poses) {
      const before = all.get(id)
      all.set(id, before ? moved.clone().multiply(before) : moved)
    }
  pose(all)
}

function look() {
  const hidden = new Set<string>()
  let colours: Looks["colours"] = {}
  for (const tool of running) {
    for (const id of tool.looks.hidden) hidden.add(id)
    colours = { ...colours, ...tool.looks.colours }
  }
  const before = useTools.getState().looks
  const looks = { hidden: [...hidden], colours }
  if (JSON.stringify(looks) !== JSON.stringify(before))
    useTools.setState({
      looks: hidden.size + Object.keys(colours).length > 0 ? looks : NO_LOOKS,
    })
}

const change = (id: string, patch: Partial<Tool>) =>
  useTools.setState((state) => ({
    tools: state.tools.map((tool) =>
      tool.id === id ? { ...tool, ...patch } : tool
    ),
  }))

/** Keep what a tool's controls are set to, for it to be started again from. */
function keep(id: string, controls: Control[]) {
  kept.set(
    `${project}/${id}`,
    Object.fromEntries(
      controls.flatMap((control) =>
        // (what a readout says is the tool's own to say again)
        "value" in control && control.kind !== "readout"
          ? [[control.id, control.value]]
          : []
      )
    )
  )
}

/** A tool has come to nothing: it is stopped, and what it did to the model is undone. */
function fail(tool: Running, error: string) {
  tool.worker.terminate()
  tool.ready = false
  tool.awaiting = null
  tool.poses = new Map()
  tool.looks = NO_LOOKS
  change(tool.id, { error, ready: false })
  compose()
  look()
}

function hear(tool: Running, message: FromRunner) {
  // (one that has been stopped may still have had something on its way)
  if (!running.includes(tool)) return
  if (message.type === "failed") return fail(tool, message.message)
  if (message.type === "ready") {
    tool.ready = true
    keep(tool.id, message.controls)
    return change(tool.id, {
      name: message.name,
      controls: message.controls,
      ready: true,
      error: null,
    })
  }
  tool.awaiting = null
  tool.settling = message.settling
  if (message.poses) {
    const { ids, matrices: all } = message.poses
    tool.poses = new Map(
      ids.map((id, index) => [
        id,
        new THREE.Matrix4().fromArray(all, index * 16),
      ])
    )
    compose()
  }
  if (message.looks) {
    tool.looks = message.looks
    look()
  }
  // not what it drew before it had heard of the last thing done to it by hand: the
  // panel already shows that, and is not to be put back
  if (message.controls && message.count >= tool.count) {
    keep(tool.id, message.controls)
    change(tool.id, { controls: message.controls })
  }
}

function tick(now: number) {
  frame = running.length > 0 ? requestAnimationFrame(tick) : null
  for (const tool of running) {
    const waited = now - (tool.awaiting ?? tool.started)
    if (!tool.ready) {
      if (
        waited > PATIENCE &&
        useTools
          .getState()
          .tools.some((one) => one.id === tool.id && !one.error)
      )
        fail(tool, "It did not load in time.")
      continue
    }
    if (tool.awaiting !== null) {
      if (waited > PATIENCE)
        fail(
          tool,
          "It stopped answering: something in it never comes to an end."
        )
      continue
    }
    tool.awaiting = now
    tool.worker.postMessage({ type: "tick", now } satisfies ToRunner)
  }
}

/**
 * Run a project's tools, as they are now written, on its model as it now is: in place
 * of whatever was running. `of` is what tells this writing of them from the next.
 */
export function runTools(
  projectId: string,
  of: string,
  sources: ToolSource[],
  parts: PartFact[]
) {
  const before = project === projectId ? running : []
  for (const tool of running) tool.worker.terminate()
  project = projectId
  const now = performance.now()
  running = sources.map((source) => {
    const worker = new Runner()
    // What it last had the parts at is kept until it says again: a tool started over,
    // its model having been built again, does not let go of the model meanwhile.
    const was = before.find((tool) => tool.id === source.id)
    const tool: Running = {
      id: source.id,
      worker,
      started: now,
      awaiting: null,
      ready: false,
      count: 0,
      poses: was?.poses ?? new Map(),
      looks: was?.looks ?? NO_LOOKS,
      settling: false,
    }
    worker.onmessage = (event: MessageEvent<FromRunner>) =>
      hear(tool, event.data)
    worker.onerror = (event) => {
      event.preventDefault()
      if (running.includes(tool)) fail(tool, event.message || "It failed.")
    }
    worker.postMessage({
      type: "start",
      id: source.id,
      source: source.source,
      parts,
      values: kept.get(`${projectId}/${source.id}`) ?? {},
    } satisfies ToRunner)
    return tool
  })

  // A tool that was not there the last time they were found, or is written otherwise,
  // is the one to turn to: it is what was just made, or changed.
  const last = written.get(projectId)
  const fresh = last
    ? sources.find((source) => last.get(source.id) !== source.source)
    : undefined
  written.set(
    projectId,
    new Map(sources.map((source) => [source.id, source.source]))
  )
  const shown = useTools.getState()
  useTools.setState({
    of,
    tab: fresh?.id ?? shown.tab,
    tools: sources.map((source) => {
      const had = shown.tools.find(
        (tool) => shown.of?.startsWith(`${projectId}:`) && tool.id === source.id
      )
      return {
        id: source.id,
        file: source.file,
        // what it showed stays until it says what it now is: and one that never
        // does goes by what its file is called
        name: had?.name ?? titled(source.id),
        controls: had?.controls ?? [],
        ready: false,
        error: null,
      }
    }),
  })
  compose()
  look()
  if (frame === null && running.length > 0) frame = requestAnimationFrame(tick)
}

/** Stop the tools, and let the model go back to how it is built. */
export function stopTools() {
  for (const tool of running) tool.worker.terminate()
  running = []
  project = null
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  useTools.setState({ of: null, tools: [], looks: NO_LOOKS })
  compose()
}

/**
 * Whether a tool has something on its way to where it was sent: the model is not yet
 * as the tool's controls say it is to be.
 */
export function settling(toolId: string): boolean {
  return running.some((tool) => tool.id === toolId && tool.settling)
}

/** Turn to a tool's tab. */
export function pickTab(id: string) {
  useTools.setState({ tab: id })
}

/** Set one of a tool's controls, by hand. */
export function setControl(toolId: string, controlId: string, value: Value) {
  const tool = running.find((one) => one.id === toolId)
  if (!tool?.ready) return
  tool.count += 1
  tool.worker.postMessage({
    type: "set",
    control: controlId,
    value,
    count: tool.count,
  } satisfies ToRunner)
  // shown at once, as the hand has it: what the tool makes of it follows in a frame
  const shown = useTools.getState().tools.find((one) => one.id === toolId)
  if (!shown) return
  change(toolId, {
    controls: shown.controls.map((control) =>
      control.id === controlId && "value" in control
        ? ({ ...control, value } as Control)
        : control
    ),
  })
}

/** Press one of a row of buttons. */
export function pressControl(
  toolId: string,
  controlId: string,
  option: string
) {
  const tool = running.find((one) => one.id === toolId)
  if (!tool?.ready) return
  tool.count += 1
  tool.worker.postMessage({
    type: "press",
    control: controlId,
    option,
    count: tool.count,
  } satisfies ToRunner)
}

// lets a script see the tools when the app is being checked without a person at it
if (import.meta.env.DEV) Object.assign(window, { __tools: useTools })
