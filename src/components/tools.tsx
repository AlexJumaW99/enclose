import * as React from "react"
import { cn } from "cn"
import {
  LayersIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  UnfoldVerticalIcon,
} from "lucide-react"

import { DownloadMenu } from "@/components/download-menu"
import {
  GlassIcon,
  SectionIcon,
  SolidIcon,
  WireframeIcon,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { nearestAxis } from "@/lib/orient"
import { SPREAD, useStore, type DisplayMode } from "@/lib/store"
import { bridge } from "./viewport/bridge"
import type { LoadedModel } from "./viewport/load"
import { sectionAcross } from "./viewport/section-planes"

/** A column of buttons that belong together, floating over the view. */
function Stack({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "glass pointer-events-auto flex flex-col gap-0.5 rounded-full bg-background/60 p-1 shadow-sm ring-1 ring-foreground/10",
        className
      )}
      {...props}
    />
  )
}

const Rule = () => <Separator className="mx-auto my-0.5 data-horizontal:w-5" />

/** A button that is either on or off, named by its tooltip. */
function Switch({
  label,
  on,
  onChange,
  children,
}: {
  label: string
  on: boolean
  onChange: (on: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            pressed={on}
            onPressedChange={onChange}
            className="size-9 px-0"
          />
        }
      >
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}

const MODES: { mode: DisplayMode; label: string; icon: React.ReactNode }[] = [
  { mode: "solid", label: "Solid", icon: <SolidIcon /> },
  { mode: "glass", label: "Glass: see inside", icon: <GlassIcon /> },
  { mode: "wireframe", label: "Wireframe", icon: <WireframeIcon /> },
]

/**
 * The buttons down the right-hand edge. At the top, what leaves the view: the
 * conversation and the downloads. In the middle, how the model is looked at.
 */
export function Tools({
  loaded,
  projectId,
}: {
  loaded: LoadedModel | null
  projectId: string
}) {
  const view = useStore((state) => state.view)
  const setView = useStore((state) => state.setView)
  const goHome = useStore((state) => state.goHome)
  const threadOpen = useStore((state) => state.threadOpen)
  const setThreadOpen = useStore((state) => state.setThreadOpen)
  const layersOpen = useStore((state) => state.layersOpen)
  const setLayersOpen = useStore((state) => state.setLayersOpen)

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-17">
      <Stack className="absolute top-3 right-3">
        <Switch label="Conversation" on={threadOpen} onChange={setThreadOpen}>
          <MessageSquareIcon />
        </Switch>
        {loaded && loaded.model.downloads.length > 0 && (
          <DownloadMenu
            downloads={loaded.model.downloads}
            projectId={projectId}
          />
        )}
      </Stack>

      {loaded && (
        <Stack className="absolute top-1/2 right-3 -translate-y-1/2">
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon" onClick={goHome} />}
            >
              <RotateCcwIcon />
              <span className="sr-only">Reset the view</span>
            </TooltipTrigger>
            <TooltipContent side="left">Reset the view</TooltipContent>
          </Tooltip>
          <Rule />
          {MODES.map(({ mode, label, icon }) => (
            <Switch
              key={mode}
              label={label}
              on={view.mode === mode}
              onChange={() => setView({ mode })}
            >
              {icon}
            </Switch>
          ))}
          <Rule />
          <Switch
            label="Section"
            on={view.section !== null}
            onChange={(on) => {
              if (!on) return setView({ section: null })
              // start with the cut that faces the camera most squarely: it opens the
              // model up towards you
              const { axis } = nearestAxis(bridge.eye?.() ?? [0, -1, 0])
              const middle = loaded.box.getCenter(loaded.box.min.clone())
              setView({ section: sectionAcross(axis, middle.toArray()) })
            }}
          >
            <SectionIcon />
          </Switch>
          <Switch
            label="Explode"
            on={view.exploded}
            onChange={(exploded) => setView({ exploded, spread: SPREAD.min })}
          >
            <UnfoldVerticalIcon />
          </Switch>
          <Rule />
          <Switch label="Layers" on={layersOpen} onChange={setLayersOpen}>
            <LayersIcon />
          </Switch>
        </Stack>
      )}
    </div>
  )
}
