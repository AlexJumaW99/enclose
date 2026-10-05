import { cn } from "cn"
import { ChevronRightIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useStore } from "@/lib/store"
import type { LoadedModel } from "./viewport/load"

function Eye({
  label,
  hidden,
  onToggle,
}: {
  label: string
  hidden: boolean
  onToggle: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-pressed={!hidden}
      aria-label={`${hidden ? "Show" : "Hide"} ${label}`}
      className={cn("shrink-0", hidden && "text-muted-foreground/60")}
      onClick={onToggle}
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </Button>
  )
}

/**
 * What the model is made of, as a list: each layer and the parts in it, with an eye to
 * switch each one off. Pointing at a row lights the part up in the view; clicking picks it.
 */
export function LayersPanel({
  loaded,
  className,
}: {
  loaded: LoadedModel
  className?: string
}) {
  const view = useStore((state) => state.view)
  const setView = useStore((state) => state.setView)
  const selectedId = useStore((state) => state.selection?.part.id ?? null)
  const hoveredId = useStore((state) => state.hoveredId)
  const select = useStore((state) => state.select)
  const hover = useStore((state) => state.hover)
  const setLayersOpen = useStore((state) => state.setLayersOpen)
  const { model } = loaded

  /** Switch these parts off, or back on if they are all off already. */
  const toggle = (ids: string[]) => {
    const allOff = ids.every((id) => view.hidden[id])
    const hidden = { ...view.hidden }
    for (const id of ids) {
      if (allOff) delete hidden[id]
      else hidden[id] = true
    }
    setView({ hidden })
  }

  return (
    <div
      className={cn(
        "glass pointer-events-auto flex w-64 flex-col rounded-2xl bg-background/70 shadow-lg ring-1 ring-foreground/10",
        className
      )}
    >
      <div className="flex items-center justify-between py-1.5 pr-1.5 pl-3.5">
        <h2 className="text-sm font-medium">Layers</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setLayersOpen(false)}
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <div
        className="flex min-h-0 [scrollbar-width:thin] flex-col gap-px overflow-y-auto p-1.5 pt-0"
        onPointerLeave={() => hover(null)}
      >
        {model.layers.map((layer) => {
          const parts = model.parts.filter((p) => p.layer === layer.id)
          if (parts.length === 0) return null
          const ids = parts.map((p) => p.id)
          const off = ids.every((id) => view.hidden[id])
          return (
            <Collapsible key={layer.id} defaultOpen>
              <div className="flex h-8 items-center gap-0.5 rounded-lg pr-1 text-sm font-medium">
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="group/trigger flex h-full min-w-0 flex-1 items-center gap-1 rounded-lg pl-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  }
                >
                  <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-90" />
                  <span
                    className={cn(
                      "truncate",
                      off && "text-muted-foreground/60"
                    )}
                  >
                    {layer.label}
                  </span>
                </CollapsibleTrigger>
                <Eye
                  label={layer.label}
                  hidden={off}
                  onToggle={() => toggle(ids)}
                />
              </div>
              <CollapsibleContent className="flex flex-col gap-px">
                {parts.map((part) => {
                  const hidden = Boolean(view.hidden[part.id])
                  return (
                    <div
                      key={part.id}
                      className={cn(
                        "flex h-8 items-center gap-0.5 rounded-lg pr-1 text-sm",
                        selectedId === part.id
                          ? "bg-muted"
                          : hoveredId === part.id && "bg-muted/50"
                      )}
                      onPointerEnter={() => hover(hidden ? null : part.id)}
                    >
                      <button
                        type="button"
                        className={cn(
                          "h-full min-w-0 flex-1 truncate rounded-lg pl-6 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                          hidden && "text-muted-foreground/60"
                        )}
                        onClick={() =>
                          select({
                            part: {
                              id: part.id,
                              label: part.label,
                              point: null,
                              normal: null,
                              face: null,
                            },
                            at: null,
                          })
                        }
                      >
                        {part.label}
                      </button>
                      <Eye
                        label={part.label}
                        hidden={hidden}
                        onToggle={() => toggle([part.id])}
                      />
                    </div>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
        {model.keepouts.length > 0 && (
          <div className="flex h-8 items-center gap-0.5 rounded-lg pr-1 text-sm font-medium">
            <span
              className={cn(
                "min-w-0 flex-1 truncate pl-5.5",
                !view.keepouts && "text-muted-foreground/60"
              )}
            >
              {model.keepoutsLabel}
            </span>
            <Eye
              label={model.keepoutsLabel}
              hidden={!view.keepouts}
              onToggle={() => setView({ keepouts: !view.keepouts })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
