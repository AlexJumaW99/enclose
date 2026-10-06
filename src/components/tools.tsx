import * as React from "react"
import { cn } from "cn"
import {
  FlipHorizontal2Icon,
  LayersIcon,
  MessageSquareIcon,
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
import { Kbd } from "@/components/ui/kbd"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MAC } from "@/lib/platform"
import { SPREAD, useStore, type DisplayMode } from "@/lib/store"
import type { LoadedModel } from "./viewport/load"
import { sectionFacing } from "./viewport/section-planes"

/** What every button floating over the view is: a frosted circle of its own. */
const ROUND =
  "glass size-9 bg-background/60 px-0 shadow-sm ring-1 ring-foreground/10"

/** Buttons that belong together, one under the other. */
function Stack({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("pointer-events-auto flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

type Side = React.ComponentProps<typeof TooltipContent>["side"]

// The tooltips here are names, with nothing in them to reach for: they go as soon as the
// pointer leaves their button, so one never lies over the button beside it.

/** A button that does one thing, named by its tooltip. */
function Press({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(ROUND, className)}
            onClick={onClick}
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

/** A button that is either on or off, named by its tooltip. */
function Switch({
  label,
  shortcut,
  side = "left",
  on,
  onChange,
  children,
}: {
  label: string
  /** the key that does the same, shown beside the name */
  shortcut?: string
  /** where the tooltip goes, when something else has the left */
  side?: Side
  on: boolean
  onChange: (on: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <Toggle
            pressed={on}
            onPressedChange={onChange}
            aria-keyshortcuts={shortcut
              ?.replace("⌘", "Meta+")
              .replace("Ctrl ", "Control+")}
            className={cn(
              ROUND,
              "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/85 aria-pressed:hover:text-primary-foreground"
            )}
          />
        }
      >
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      {/* a little room on the right, or the arrow bites into the key */}
      <TooltipContent side={side} className="has-data-[slot=kbd]:pr-2.5">
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
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
  const { section } = view
  const setView = useStore((state) => state.setView)
  const threadOpen = useStore((state) => state.threadOpen)
  const setThreadOpen = useStore((state) => state.setThreadOpen)
  const layersOpen = useStore((state) => state.layersOpen)
  const setLayersOpen = useStore((state) => state.setLayersOpen)

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-15">
      <Stack className="absolute top-3 right-3">
        <Switch
          label="Conversation"
          shortcut={MAC ? "⌘B" : "Ctrl B"}
          on={threadOpen}
          onChange={setThreadOpen}
        >
          <MessageSquareIcon />
        </Switch>
        {loaded && loaded.model.downloads.length > 0 && (
          <DownloadMenu
            downloads={loaded.model.downloads}
            projectId={projectId}
            className={ROUND}
          />
        )}
      </Stack>

      {/* how the model is looked at: a little air between the kinds of control */}
      {loaded && (
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col gap-4">
          <Stack>
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
          </Stack>
          <Stack>
            <div className="relative">
              {/* while the model is cut open: which half of it to show, alongside */}
              {section && (
                <Press
                  label="Show the other side"
                  onClick={() =>
                    setView({
                      section: { ...section, flipped: !section.flipped },
                    })
                  }
                  className="absolute top-0 right-full mr-1.5"
                >
                  <FlipHorizontal2Icon />
                </Press>
              )}
              <Switch
                label="Section"
                shortcut="S"
                // its neighbour has the left
                side={section ? "top" : "left"}
                on={section !== null}
                onChange={(on) =>
                  setView({ section: on ? sectionFacing(loaded.box) : null })
                }
              >
                <SectionIcon />
              </Switch>
            </div>
            <Switch
              label="Explode"
              shortcut="E"
              on={view.exploded}
              onChange={(exploded) => setView({ exploded, spread: SPREAD.min })}
            >
              <UnfoldVerticalIcon />
            </Switch>
          </Stack>
          <Stack>
            <Switch label="Layers" on={layersOpen} onChange={setLayersOpen}>
              <LayersIcon />
            </Switch>
          </Stack>
        </div>
      )}
    </div>
  )
}
