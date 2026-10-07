import * as React from "react"
import { cn } from "cn"
import {
  BookOpenIcon,
  BotIcon,
  ChevronDownIcon,
  EyeIcon,
  FilePlusIcon,
  FileTextIcon,
  GlobeIcon,
  ListIcon,
  MousePointerClickIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { Step } from "@/lib/steps"
import { duration } from "@/lib/time"

/** A line of the steps, whichever one. */
const LINE = "flex h-5 items-center gap-2 text-xs text-muted-foreground"
/** Words for what is still going on: a light passes along them, over and over. */
const LIVE = "shimmer shimmer-color-foreground"

/** The picture for each kind of step; any other is a tool of some sort. */
const ICONS: Record<string, LucideIcon> = {
  Run: TerminalIcon,
  Read: FileTextIcon,
  Edit: PencilIcon,
  Write: FilePlusIcon,
  Search: SearchIcon,
  Fetch: GlobeIcon,
  "Web search": GlobeIcon,
  "Find tool": WrenchIcon,
  Subagent: BotIcon,
  Skill: BookOpenIcon,
  Look: EyeIcon,
  Check: MousePointerClickIcon,
  List: ListIcon,
}

/** A step in a line: a picture of the kind of thing it was, then what was done, in words. */
function StepLine({
  step,
  live = false,
}: {
  step: Step
  /** it is the one Claude is on, and the line is there to say so */
  live?: boolean
}) {
  const Icon = ICONS[step.name] ?? WrenchIcon
  // a step that failed is one to notice, not an alarm: Claude tries another way
  const failed = step.state === "failed"
  return (
    <>
      <Icon
        className={cn("size-3.5 shrink-0", failed && "text-attention")}
        aria-hidden
      />
      <span className="flex min-w-0 gap-1">
        <span
          className={cn(
            "shrink-0 font-medium",
            failed ? "text-attention" : "text-foreground/80",
            // a step done to nothing in particular has only its name to light
            live && !step.detail && LIVE
          )}
        >
          {step.name}
        </span>
        <span
          className={cn(
            "min-w-0 truncate",
            live ? LIVE : step.state === "running" && "text-foreground"
          )}
          title={step.detail}
        >
          {step.detail}
        </span>
      </span>
    </>
  )
}

/**
 * What Claude did between saying things, as one line. While it is at it, the line is
 * the step it is on; afterwards, how long it was at them. It opens into all of them.
 */
export function Steps({
  steps,
  took,
  working,
}: {
  steps: Step[]
  /** how long Claude was at them, in ms, if they are over and that is known */
  took: number | null
  /** Claude is still on the turn these are the latest of, and may add to them */
  working: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const current =
    steps.findLast((step) => step.state === "running") ?? steps.at(-1)
  if (!current) return null
  const busy = working || current.state === "running"

  // one step with no time to give is the whole of it: there is nothing to open
  if (steps.length === 1 && (busy || took === null))
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
          // each step takes the place of the one before it, with no show made of it
          <span className="flex min-w-0 items-center gap-2">
            <StepLine step={current} live />
          </span>
        ) : busy || took === null ? (
          <span className={cn(busy && LIVE)}>{steps.length} steps</span>
        ) : (
          <span>Worked for {duration(took)}</span>
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
