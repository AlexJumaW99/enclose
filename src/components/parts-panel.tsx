import * as React from "react"
import { cn } from "cn"
import { ChevronRightIcon, EyeOffIcon, SquareDashedIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useStore, type Only } from "@/lib/store"
import type { LoadedModel } from "./viewport/load"

/** What the list can pick out: one thing, by its id. */
type Listed = Extract<Only, { id: string }>

const same = (a: Only | null, b: Listed) =>
  a !== null && "id" in a && a.kind === b.kind && a.id === b.id
/** Stable when it is not several parts that are shown on their own. */
const NONE: string[] = []

/** A row that is picked out is lit the way a button that is on is. */
const ROW =
  "flex w-full min-w-0 items-center rounded-lg text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const PICKED = "bg-primary text-primary-foreground"

// What the small pictures stand on: a mid grey, the same whatever the theme and whether
// or not the row is picked, since parts come both paler and darker than any row.
const TILE =
  "size-7 shrink-0 overflow-hidden rounded-md bg-neutral-600 ring-1 ring-black/20"

/** The small picture a part is known by; an empty tile until it has been drawn. */
function Thumb({ url, dim = false }: { url?: string; dim?: boolean }) {
  return (
    <span className={cn(TILE, dim && "opacity-45")}>
      {url && <img src={url} alt="" draggable={false} className="size-full" />}
    </span>
  )
}

/** On a part that is out of sight, or a group that all is: why it is dim in the list. */
const HIDDEN = "ml-auto size-3.5 shrink-0 text-muted-foreground"

/**
 * What the model is made of, as a list: its parts, under the groups the model puts them
 * in. Picking a part or a group shows it on its own in the view, and picking it again
 * brings the rest back. Esc or a press anywhere else puts the list away; what was picked
 * stays picked.
 *
 * A part that was put out of sight in the view (H) is dim here, and so is a group all
 * of whose parts were. Picking one of those brings it back, and does no more than that.
 */
export function PartsPanel({
  loaded,
  thumbs,
  className,
}: {
  loaded: LoadedModel
  /** the pictures of the parts, by part id, as far as they have been drawn */
  thumbs: Record<string, string>
  className?: string
}) {
  const only = useStore((state) => state.view.only)
  const hidden = useStore((state) => state.view.hidden)
  const setView = useStore((state) => state.setView)
  const hoveredId = useStore((state) => state.hoveredId)
  const hover = useStore((state) => state.hover)
  const setPartsOpen = useStore((state) => state.setPartsOpen)
  const panel = React.useRef<HTMLDivElement>(null)
  const { model } = loaded

  const pick = (what: Listed) =>
    setView({ only: same(only, what) ? null : what })
  /** Bring back parts that were put out of sight. */
  const show = (ids: string[]) =>
    setView({ hidden: hidden.filter((id) => !ids.includes(id)) })
  // several picked out together in the view, and shown on their own, are each lit here
  const among = only?.kind === "parts" ? only.ids : NONE

  React.useEffect(() => {
    const away = (event: PointerEvent) => {
      const on = event.target as Element | null
      if (!on || panel.current?.contains(on)) return
      // the button that brought the list up also puts it away: that press is its own
      if (on.closest("[data-opens=parts]")) return
      setPartsOpen(false)
    }
    document.addEventListener("pointerdown", away, true)
    return () => document.removeEventListener("pointerdown", away, true)
  }, [setPartsOpen])

  return (
    <div
      ref={panel}
      role="listbox"
      aria-label="Parts"
      className={cn(
        "glass pointer-events-auto flex w-64 flex-col rounded-2xl bg-background/70 shadow-lg ring-1 ring-foreground/10",
        className
      )}
    >
      <div
        className="flex min-h-0 [scrollbar-width:thin] flex-col gap-px overflow-y-auto p-1.5"
        onPointerLeave={() => hover(null)}
      >
        {model.groups.map((group) => {
          const parts = model.parts.filter((part) => part.group === group.id)
          if (parts.length === 0) return null
          const whole: Listed = { kind: "group", id: group.id }
          const picked = same(only, whole)
          const gone = parts.every((part) => hidden.includes(part.id))
          return (
            <Collapsible key={group.id} defaultOpen>
              <div
                className={cn(
                  "flex h-8 items-center rounded-lg font-medium",
                  picked && PICKED
                )}
              >
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Fold ${group.label}`}
                      className="group/fold flex size-7 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  }
                >
                  <ChevronRightIcon className="size-3.5 opacity-60 transition-transform group-data-panel-open/fold:rotate-90" />
                </CollapsibleTrigger>
                <button
                  type="button"
                  role="option"
                  aria-selected={picked}
                  title={gone ? "Hidden: click to show it again" : undefined}
                  className={cn(ROW, "h-full gap-2 pr-2")}
                  onClick={() =>
                    gone ? show(parts.map((part) => part.id)) : pick(whole)
                  }
                >
                  <span className={cn("truncate", gone && "opacity-45")}>
                    {group.label}
                  </span>
                  {gone && <EyeOffIcon className={HIDDEN} />}
                </button>
              </div>
              <CollapsibleContent className="flex flex-col gap-px pt-px">
                {parts.map((part) => {
                  const one: Listed = { kind: "part", id: part.id }
                  const lit = same(only, one) || among.includes(part.id)
                  const out = hidden.includes(part.id)
                  return (
                    <button
                      key={part.id}
                      type="button"
                      role="option"
                      aria-selected={lit}
                      title={out ? "Hidden: click to show it again" : undefined}
                      className={cn(
                        ROW,
                        "h-9 gap-2 pr-2 pl-1",
                        lit
                          ? PICKED
                          : // in a group that is picked, its parts show that they are in
                            picked
                            ? "bg-foreground/10"
                            : hoveredId === part.id && "bg-muted/60"
                      )}
                      onPointerEnter={() => hover(part.id)}
                      onClick={() => (out ? show([part.id]) : pick(one))}
                    >
                      <Thumb url={thumbs[part.id]} dim={out} />
                      <span className={cn("truncate", out && "opacity-45")}>
                        {part.label}
                      </span>
                      {out && <EyeOffIcon className={HIDDEN} />}
                    </button>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
        {/* not parts, but space the parts have to leave: listed with them all the same */}
        {model.keepouts.length > 0 &&
          (() => {
            const all: Listed = { kind: "keepouts", id: "keepouts" }
            const lit = same(only, all)
            return (
              <button
                type="button"
                role="option"
                aria-selected={lit}
                className={cn(ROW, "h-9 gap-2 pr-2 pl-1", lit && PICKED)}
                onPointerEnter={() => hover(null)}
                onClick={() => pick(all)}
              >
                <span
                  className={cn(
                    TILE,
                    "flex items-center justify-center text-neutral-200 [&_svg]:size-4"
                  )}
                >
                  <SquareDashedIcon />
                </span>
                <span className="truncate font-medium">
                  {model.keepoutsLabel}
                </span>
              </button>
            )
          })()}
      </div>
    </div>
  )
}
