// A project's own tools, as an agent has them: how they stand, and a hand on one of
// their controls. It is how whoever wrote a tool finds out whether it loaded, and sees
// what it does to the model, without the user having to try it for them.
import type { ToolUse } from "@shared/api"
import { useStore } from "@/lib/store"

import { fitted } from "./declare"
import { pickTab, pressControl, setControl, useTools } from "./host"

/** How long the tools are waited for to be loaded as they are now written, in ms. */
const LOADED_WITHIN = 8000
/** How many frames a tool is given to make something of what was done to it. */
const FRAMES = 3

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** The project's tools as they stand, once they are loaded as now written. */
async function loaded(projectId: string) {
  const store = useStore.getState()
  const project = store.projects.find((one) => one.id === projectId)
  if (!project || project.tools === null)
    throw new Error(
      "This project has no tools: there is no .js file in tools/ at the top of it."
    )
  // they are brought up, which sets them to work: for the user to see, as well
  store.setToolsOpen(true)
  const of = `${projectId}:${project.tools}`
  const settled = () => {
    const state = useTools.getState()
    return (
      state.of === of &&
      state.tools.every((tool) => tool.ready || tool.error !== null)
    )
  }
  const until = performance.now() + LOADED_WITHIN
  while (!settled()) {
    if (performance.now() > until)
      throw new Error(
        "The tools did not load. They run on the model in the view: is one on screen?"
      )
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return useTools.getState().tools
}

const described = (
  tool: ReturnType<typeof useTools.getState>["tools"][number]
) =>
  tool.error !== null
    ? { tool: tool.id, file: tool.file, error: tool.error }
    : {
        tool: tool.id,
        file: tool.file,
        name: tool.name,
        controls: tool.controls,
      }

/** What an agent is told when it asks how the project's tools stand. */
export async function toolsAsked(projectId: string) {
  return (await loaded(projectId)).map(described)
}

/** Have a tool's control set, or its button pressed, and say how the tool then stands. */
export async function toolUsed(projectId: string, use: ToolUse) {
  const tools = await loaded(projectId)
  const tool = tools.find((one) => one.id === use.tool)
  if (!tool)
    throw new Error(
      `There is no tool "${use.tool}". The tools are ${tools.map((one) => one.id).join(", ")}.`
    )
  if (tool.error !== null)
    throw new Error(`The tool is not running: ${tool.error}`)
  const control = tool.controls.find((one) => one.id === use.control)
  if (!control)
    throw new Error(
      `${tool.id} has no control "${use.control}". Its controls are ${tool.controls.map((one) => one.id).join(", ")}.`
    )
  pickTab(tool.id)
  if (control.kind === "buttons") {
    const option = control.options.find((one) => one.id === use.press)
    if (!option)
      throw new Error(
        `${use.control} is a row of buttons: press one of ${control.options.map((one) => one.id).join(", ")}.`
      )
    pressControl(tool.id, control.id, option.id)
  } else {
    const value = fitted(control, use.value)
    if (value === undefined)
      throw new Error(
        `${use.control} is a ${control.kind}: it cannot be set to ${JSON.stringify(use.value)}.`
      )
    setControl(tool.id, control.id, value)
  }
  for (let frame = 0; frame < FRAMES; frame++) await nextFrame()
  const now = useTools.getState().tools.find((one) => one.id === tool.id)
  return now ? described(now) : null
}
