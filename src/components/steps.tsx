import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { Step } from "@/lib/steps"

/** A line of the steps, whichever one: a tag is as tall as it gets. */
const LINE = "flex h-5 items-center gap-2 text-xs text-muted-foreground"
/** Words for what is still going on: a light passes along them, over and over. */
const LIVE = "shimmer shimmer-color-foreground"

/** A step in a line: the kind of thing it was, as a tag, and what it was done to. */
function StepLine({
  step,
  live = false,
}: {
  step: Step
  /** it is the one Claude is on, and the line is there to say so */
  live?: boolean
}) {
  return (
    <>
      <Badge
        variant="secondary"
        className={
          // a step that failed is one to notice, not an alarm: Claude tries another way
          step.state === "failed"
            ? "bg-attention/10 text-attention dark:bg-attention/20"
            : "text-foreground/80"
        }
      >
        {/* a step done to nothing in particular has only its name to light */}
        <span className={cn(live && !step.detail && LIVE)}>{step.name}</span>
      </Badge>
      <span
        className={cn(
          "min-w-0 truncate font-mono",
          live ? LIVE : step.state === "running" && "text-foreground"
        )}
        title={step.detail}
      >
        {step.detail}
      </span>
    </>
  )
}

/**
 * What Claude did between saying things, as one line. While it is at it, the line is
 * the step it is on; afterwards, how many there were. It opens into all of them.
 */
export function Steps({
  steps,
  working,
}: {
  steps: Step[]
  /** Claude is still on the turn these are the latest of, and may add to them */
  working: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const current =
    steps.findLast((step) => step.state === "running") ?? steps.at(-1)
  if (!current) return null
  const busy = working || current.state === "running"

  // one step is the whole of it: there is nothing to open
  if (steps.length === 1)
    return (
      <div className={LINE}>
        <StepLine step={current} live={busy} />
      </div>
    )

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          LINE,
          "group/steps max-w-full rounded-md text-left outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        {busy && !open ? (
          // each step comes up from under the one before it
          <span
            key={current.id}
            className="flex min-w-0 animate-in items-center gap-2 duration-200 fade-in slide-in-from-bottom-1"
          >
            <StepLine step={current} live />
          </span>
        ) : (
          <span className={cn(busy && LIVE)}>{steps.length} steps</span>
        )}
        <ChevronDownIcon className="size-3.5 shrink-0 opacity-60 transition-transform group-data-panel-open/steps:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        <ol className="mt-1.5 ml-0.5 flex flex-col gap-1.5 border-l pl-3">
          {steps.map((step) => (
            <li key={step.id} className={LINE}>
              <StepLine step={step} />
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}
