import * as React from "react"
import { DownloadIcon } from "lucide-react"

import { Composer } from "@/components/composer"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover"
import type { Model } from "@/lib/model"
import { useStore } from "@/lib/store"

/** The STEP file of one part, if the model hands one out. */
function downloadFor(model: Model, partId: string, label: string) {
  return (
    model.downloads.find((d) => d.part === partId) ??
    model.downloads.find(
      (d) => d.kind === "part" && d.label.toLowerCase() === label.toLowerCase()
    )
  )
}

/**
 * Click a part and this opens beside the click: say what should change about it, and the
 * message goes to Claude with the part and the exact point attached.
 */
export function PartPrompt({
  model,
  projectId,
}: {
  model: Model
  projectId: string
}) {
  const selection = useStore((state) => state.selection)
  const prompting = useStore((state) => state.prompting)
  const closePrompt = useStore((state) => state.closePrompt)

  // the popover hangs off the point that was clicked rather than off an element
  const anchor = React.useMemo(() => {
    if (!selection) return null
    const { x, y } = selection
    return {
      getBoundingClientRect: () =>
        DOMRect.fromRect({ x, y, width: 0, height: 0 }),
    }
  }, [selection])

  if (!selection || !anchor) return null
  const { part } = selection
  const download = downloadFor(model, part.id, part.label)

  return (
    <Popover open={prompting} onOpenChange={(open) => !open && closePrompt()}>
      <PopoverContent
        anchor={anchor}
        side="right"
        align="start"
        sideOffset={14}
        className="w-80 gap-3"
      >
        <PopoverHeader>
          <PopoverTitle>{part.label}</PopoverTitle>
          {part.point && (
            <PopoverDescription className="font-mono text-xs tabular-nums">
              {part.point.map((n) => n.toFixed(1)).join("  ")} mm
            </PopoverDescription>
          )}
        </PopoverHeader>
        <Composer
          part={part}
          placeholder="What should change here?"
          autoFocus
        />
        {download && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              void window.cad.model.saveCopy(
                projectId,
                download.file,
                download.name
              )
            }
          >
            <DownloadIcon data-icon="inline-start" />
            Download STEP
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
