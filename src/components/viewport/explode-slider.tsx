import { Slider } from "@base-ui/react/slider"
import { cn } from "cn"

import { SPREAD, useStore } from "@/lib/store"

/**
 * Shown while the model is exploded: drag to pull the parts further apart than the
 * model's own distances, which is where it starts.
 */
export function ExplodeSlider({ className }: { className?: string }) {
  const spread = useStore((state) => state.view.spread)
  const setView = useStore((state) => state.setView)
  return (
    <Slider.Root
      // The scale runs from zero so that the filled part has some length even at the
      // start; the value itself never goes below the model's own distances.
      min={0}
      max={SPREAD.max}
      step={0.05}
      value={spread}
      onValueChange={(value) =>
        setView({ spread: Math.max(SPREAD.min, value as number) })
      }
      thumbAlignment="edge"
      className={cn(
        "glass pointer-events-auto w-64 rounded-full bg-background/60 p-1 shadow-sm ring-1 ring-foreground/10",
        className
      )}
    >
      <Slider.Control className="relative flex h-8 w-full cursor-ew-resize touch-none items-center select-none">
        <Slider.Track className="relative h-full w-full rounded-full">
          <Slider.Indicator className="h-full rounded-full bg-foreground" />
        </Slider.Track>
        {/* the grip sits just inside the end of the filled part */}
        <Slider.Thumb
          aria-label="How far apart the parts are pulled"
          className="size-0 outline-none"
        >
          <span className="absolute top-1/2 right-2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-background/45" />
        </Slider.Thumb>
      </Slider.Control>
    </Slider.Root>
  )
}
