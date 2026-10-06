import * as React from "react"
import { cn } from "cn"
import {
  FlipHorizontal2Icon,
  BoxesIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  UnfoldVerticalIcon,
} from "lucide-react"

import { DownloadMenu } from "@/components/download-menu"
import { SectionIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MAC } from "@/lib/platform"
import { SPREAD, useStore } from "@/lib/store"
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
  side = "left",
  onClick,
  className,
  children,
}: {
  label: string
  /** where the tooltip goes, when something else has the left */
  side?: Side
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
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** A button that is either on or off, named by its tooltip. */
function Switch({
  label,
  opens,
  shortcut,
  side = "left",
  on,
  onChange,
  children,
}: {
  label: string
  /** what the button brings up, for that thing to know its own button by */
  opens?: string
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
            data-opens={opens}
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
  const cutOpen = useStore((state) => state.cutOpen)
  const threadOpen = useStore((state) => state.threadOpen)
  const setThreadOpen = useStore((state) => state.setThreadOpen)
  const partsOpen = useStore((state) => state.partsOpen)
  const setPartsOpen = useStore((state) => state.setPartsOpen)

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

      {/* how the model is looked at */}
      {loaded && (
        <Stack className="absolute top-1/2 right-3 -translate-y-1/2">
          <div className="relative">
            {/* while the model is cut open, alongside: the cut put back to where it
                starts from, and which half of the model to show */}
            {section && (
              <div className="absolute top-0 right-full mr-1.5 flex gap-1.5">
                <Press
                  label="Start the cut again"
                  side="top"
                  onClick={() =>
                    setView({ section: sectionFacing(loaded.box) })
                  }
                >
                  <RotateCcwIcon />
                </Press>
                <Press
                  label="Show the other side"
                  side="top"
                  onClick={() =>
                    setView({
                      section: { ...section, flipped: !section.flipped },
                    })
                  }
                >
                  <FlipHorizontal2Icon />
                </Press>
              </div>
            )}
            <Switch
              label="Section"
              shortcut="S"
              // its neighbours have the left
              side={section ? "top" : "left"}
              on={section !== null}
              // cut open again, it is as it was left
              onChange={(on) =>
                on
                  ? cutOpen(() => sectionFacing(loaded.box))
                  : setView({ section: null })
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
          {/* lit while the list is up, and while something picked in it is still all
              that is showing: pressing it brings the list back to pick again */}
          <Switch
            label="Parts"
            opens="parts"
            on={partsOpen || view.only !== null}
            onChange={() => setPartsOpen(!partsOpen)}
          >
            <BoxesIcon />
          </Switch>
        </Stack>
      )}
    </div>
  )
}
