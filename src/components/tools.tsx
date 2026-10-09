import * as React from "react"
import { cn } from "cn"
import {
  FlipHorizontal2Icon,
  BoxesIcon,
  DownloadIcon,
  DraftingCompassIcon,
  Grid3x3Icon,
  MessageSquareIcon,
  RotateCcwIcon,
  SearchIcon,
  UnfoldVerticalIcon,
} from "lucide-react"

import { ReferenceIcon, SectionIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { oneFile, sizeOf } from "@/lib/model"
import { MAC } from "@/lib/platform"
import { SPREAD, useStore } from "@/lib/store"
import type { LoadedModel } from "./viewport/load"
import { sectionFacing } from "./viewport/section-planes"

/** What every button floating over the view is: a frosted circle of its own. */
const ROUND =
  "glass size-9 bg-background/60 px-0 shadow-sm ring-1 ring-foreground/10"

/**
 * How far the two buttons that stand beside the Section's while the model is cut open
 * reach from it, in px: each as wide as a button, with the room kept between buttons,
 * and a little more for a name to stand clear of them.
 */
const BESIDE = 2 * 36 + 2 * 6 + 4

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
  detail,
  side = "left",
  onClick,
  className,
  children,
}: {
  label: string
  /** something more about it, said more quietly beside the name */
  detail?: string
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
      <TooltipContent side={side}>
        {label}
        {detail && <span className="tabular-nums opacity-60">{detail}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

/** A button that is either on or off, named by its tooltip. */
export function Switch({
  label,
  opens,
  shortcut,
  side = "left",
  away,
  on,
  onChange,
  disabled,
  className,
  children,
}: {
  label: string
  className?: string
  /** there is nothing for it to do, as things are: it is there, and is not to be pressed */
  disabled?: boolean
  /** what the button brings up, for that thing to know its own button by */
  opens?: string
  /** the key that does the same, shown beside the name */
  shortcut?: string
  /** where the tooltip goes, when something else has the left */
  side?: Side
  /** how far from the button it goes, in px, when something stands between */
  away?: number
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
            disabled={disabled}
            data-opens={opens}
            aria-keyshortcuts={shortcut
              ?.replace("⌘", "Meta+")
              .replace("Ctrl ", "Control+")
              .replace(/⇧|Shift /, "Shift+")}
            className={cn(
              ROUND,
              "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/85 aria-pressed:hover:text-primary-foreground",
              className
            )}
          />
        }
      >
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      {/* a little room on the right, or the arrow bites into the key */}
      <TooltipContent
        side={side}
        sideOffset={away}
        className="has-data-[slot=kbd]:pr-2.5"
      >
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The buttons down the right-hand edge. At the top, what leaves the view: the
 * conversation, and the model as a file. In the middle, how the model is looked at.
 *
 * While it is the model's blueprint that is looked at, the ones that are only for the
 * view of the model itself, the cut, the ground and what the model is set in, are there
 * and not to be pressed.
 */
export function Tools({
  loaded,
  projectId,
  locked = false,
}: {
  loaded: LoadedModel | null
  projectId: string
  /** the view is not the hand's to change for now: how it is looked at is put away */
  locked?: boolean
}) {
  const view = useStore((state) => state.view)
  const { blueprint } = view
  // a blueprint is of the model whole: the cut is the view's, and comes back with it
  const section = blueprint ? null : view.section
  const setView = useStore((state) => state.setView)
  const cutOpen = useStore((state) => state.cutOpen)
  const threadOpen = useStore((state) => state.threadOpen)
  const setThreadOpen = useStore((state) => state.setThreadOpen)
  const partsOpen = useStore((state) => state.partsOpen)
  const setPartsOpen = useStore((state) => state.setPartsOpen)
  const referenceOpen = useStore((state) => state.referenceOpen)
  const setReferenceOpen = useStore((state) => state.setReferenceOpen)
  const finding = useStore((state) => state.finding !== null)
  const find = useStore((state) => state.find)
  const whole = loaded ? oneFile(loaded.model.downloads) : null

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
        {/* the whole model in one file, saved at a press: one part of it, or the
            parts of one group, are had from the list of parts */}
        {whole && (
          <Press
            label="Download STEP"
            detail={sizeOf(whole.bytes)}
            onClick={() =>
              void window.cad.model.saveCopy(projectId, whole.file, whole.name)
            }
          >
            <DownloadIcon />
          </Press>
        )}
      </Stack>

      {/* how the model is looked at */}
      {loaded && !locked && (
        <Stack className="absolute top-1/2 right-3 -translate-y-1/2">
          {/* lit while the list is up, and while not all of the model is showing:
              something picked in the list is all that is, or parts are out of sight.
              Pressing it brings the list back, to pick again or to bring them back */}
          <Switch
            label="Parts"
            shortcut="P"
            opens="parts"
            on={partsOpen || view.only !== null || view.hidden.length > 0}
            onChange={() => setPartsOpen(!partsOpen)}
          >
            <BoxesIcon />
          </Switch>
          {/* not the model but what it stands in: the ground, and the world's axes */}
          <Switch
            label="Grid"
            shortcut={MAC ? "⇧G" : "Shift G"}
            on={view.grid}
            disabled={blueprint}
            onChange={(grid) => setView({ grid })}
          >
            <Grid3x3Icon />
          </Switch>
          <div className="relative">
            {/* while the model is cut open, alongside: the cut put back to where it
                starts from, and which half of the model to show */}
            {section && (
              <div className="absolute top-0 right-full mr-1.5 flex gap-1.5">
                <Press
                  label="Reset cut"
                  side="top"
                  onClick={() =>
                    setView({ section: sectionFacing(loaded.box) })
                  }
                >
                  <RotateCcwIcon />
                </Press>
                <Press
                  label="Invert side"
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
              // its neighbours have the left: its name is on the far side of them
              away={section ? BESIDE : undefined}
              on={section !== null}
              disabled={blueprint}
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
          {/* things of a known size for the model to be seen beside: the button brings
              up the scenes there are, and is lit while the list is up and while the
              model is set in one. (The key sets it in whichever suits it, at once.)
              There is none for the cube that stands in for a model */}
          {!loaded.standIn && (
            <Switch
              label="Reference"
              shortcut={MAC ? "⌘/" : "Ctrl /"}
              opens="reference"
              on={referenceOpen || (view.reference !== null && !blueprint)}
              disabled={blueprint}
              onChange={() => setReferenceOpen(!referenceOpen)}
            >
              <ReferenceIcon />
            </Switch>
          )}
          {/* the model drawn flat, from each of its sides and from its corners, on
              sheets that take the view's place: there is nothing to draw of the cube
              that stands in for one */}
          {!loaded.standIn && (
            <Switch
              label="Blueprint"
              shortcut="B"
              on={blueprint}
              onChange={(blueprint) => setView({ blueprint })}
            >
              <DraftingCompassIcon />
            </Switch>
          )}
          {/* parts and groups looked for by name, in a box at the top of the view: not
              in the cube that stands in for a model, which has none to find */}
          {!loaded.standIn && (
            <Switch
              label="Search"
              shortcut={MAC ? "⌘F" : "Ctrl F"}
              on={finding}
              onChange={(on) => find(on ? "" : null)}
            >
              <SearchIcon />
            </Switch>
          )}
        </Stack>
      )}
    </div>
  )
}
