import * as React from "react"
import { BoxIcon, TriangleAlertIcon } from "lucide-react"

import type { Project } from "@shared/api"
import { LayersPanel } from "@/components/layers-panel"
import { PartPrompt } from "@/components/part-prompt"
import { Tools } from "@/components/tools"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { readModel } from "@/lib/model"
import { useStore } from "@/lib/store"
import { AxisGizmo } from "./axis-gizmo"
import { bridge } from "./bridge"
import { ExplodeSlider } from "./explode-slider"
import { disposeModel, loadModel, type LoadedModel } from "./load"
import { appearance, Scene } from "./scene"
import { SectionPlanes } from "./section-planes"

type Loading =
  | { status: "loading"; done: number; total: number }
  | { status: "error"; message: string }
  | { status: "ready" }

/**
 * The project's model, loaded. While a rebuilt model is coming in, the previous one stays
 * on screen, so a rebuild swaps the picture rather than blanking it.
 */
function useLoadedModel(project: Project) {
  const [loaded, setLoaded] = React.useState<LoadedModel | null>(null)
  const [state, setState] = React.useState<Loading>({
    status: "loading",
    done: 0,
    total: 0,
  })

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setState({ status: "loading", done: 0, total: 0 })
      const source = await window.cad.model.read(project.id)
      if (!source) throw new Error("The model's manifest could not be read.")
      const model = readModel(source.manifest)
      const next = await loadModel(
        model,
        source.baseUrl,
        project.revision,
        (done, total) => {
          if (!cancelled) setState({ status: "loading", done, total })
        }
      )
      if (cancelled) return disposeModel(next)
      setLoaded(next)
      setState({ status: "ready" })
    }
    run().catch((error: unknown) => {
      if (!cancelled)
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        })
    })
    return () => {
      cancelled = true
    }
  }, [project.id, project.revision])

  // free the previous model's meshes once it is off screen
  React.useEffect(
    () => () => {
      if (loaded) disposeModel(loaded)
    },
    [loaded]
  )

  return { loaded, state }
}

function Model({ project }: { project: Project }) {
  const { loaded, state } = useLoadedModel(project)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const hoveredId = useStore((s) => s.hoveredId)
  const hover = useStore((s) => s.hover)
  const homeRequests = useStore((s) => s.homeRequests)
  const layersOpen = useStore((s) => s.layersOpen)

  // what Claude gets when it asks which parts are on screen
  React.useEffect(() => {
    if (!loaded) return
    bridge.parts = () =>
      loaded.parts.map((part) => {
        const box = part.box.clone().applyMatrix4(part.home)
        const round = (n: number) => Math.round(n * 100) / 100
        return {
          id: part.part.id,
          label: part.part.label,
          layer: part.part.layer,
          min: box.min.toArray().map(round),
          max: box.max.toArray().map(round),
          faces: part.faces,
          shown: appearance(part, loaded, useStore.getState().view).shown,
        }
      })
    return () => {
      bridge.parts = null
    }
  }, [loaded])

  // the section's handle was dragged in the view: the cut moves, the side shown stays
  const moveSection = React.useCallback(
    (moved: Parameters<React.ComponentProps<typeof Scene>["onSection"]>[0]) => {
      const { section } = useStore.getState().view
      if (section) setView({ section: { ...section, ...moved } })
    },
    [setView]
  )

  const middle = React.useMemo(
    () => loaded?.box.getCenter(loaded.box.min.clone()).toArray() ?? null,
    [loaded]
  )

  return (
    <>
      {loaded && (
        <Scene
          loaded={loaded}
          view={view}
          selectedId={selection?.part.id ?? null}
          hoveredId={hoveredId}
          homeKey={`${project.id}:${homeRequests}`}
          onPick={select}
          onHover={hover}
          onSection={moveSection}
        />
      )}

      {state.status === "loading" && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm ring-1 ring-foreground/10">
            <Spinner className="size-3" />
            {state.total > 0
              ? `Loading ${state.done} of ${state.total} parts`
              : "Loading the model"}
          </div>
        </div>
      )}
      {state.status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Alert variant="destructive" className="max-w-md">
            <TriangleAlertIcon />
            <AlertTitle>The model could not be shown</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        </div>
      )}

      <Tools loaded={loaded} projectId={project.id} />
      {loaded && layersOpen && (
        <LayersPanel
          loaded={loaded}
          className="absolute top-1/2 right-17 max-h-[70%] -translate-y-1/2"
        />
      )}
      {loaded && view.exploded && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <ExplodeSlider />
        </div>
      )}
      {loaded && middle && (
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-end gap-1">
          <SectionPlanes middle={middle} />
          <AxisGizmo />
        </div>
      )}
      {loaded && <PartPrompt model={loaded.model} projectId={project.id} />}
    </>
  )
}

/** The middle of the window: the open project's model, or what to do about not having one. */
export function Viewport({ project }: { project: Project | null }) {
  const addProject = useStore((s) => s.addProject)
  const setThreadOpen = useStore((s) => s.setThreadOpen)
  const threadOpen = useStore((s) => s.threadOpen)

  if (!project) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BoxIcon />
          </EmptyMedia>
          <EmptyTitle>Add a project folder</EmptyTitle>
          <EmptyDescription>
            A project is a folder with the source of a CAD model. Add one to see
            the model and work on it with Claude.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => void addProject()}>Add a folder</Button>
        </EmptyContent>
      </Empty>
    )
  }
  if (!project.manifest) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BoxIcon />
          </EmptyMedia>
          <EmptyTitle>No model in this folder yet</EmptyTitle>
          <EmptyDescription>
            This app shows the model a project builds. Ask Claude to set one up
            here, for example from a STEP file in the folder, and it will appear
            as soon as it is built.
          </EmptyDescription>
        </EmptyHeader>
        {!threadOpen && (
          <EmptyContent>
            <Button onClick={() => setThreadOpen(true)}>Ask Claude</Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }
  // keyed by project, so one project's model never lingers under another's name
  return <Model key={project.id} project={project} />
}
