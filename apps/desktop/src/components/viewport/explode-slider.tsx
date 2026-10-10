import { Slider } from "@base-ui/react/slider"
import { cn } from "cn"

import { SPREAD, useStore } from "@/lib/store"

/**
 * How far apart the parts of an exploded model are pulled: drag to pull them further
 * than the model's own distances, which is where it starts. It is made to look like the
 * switches it is found beside: as tall as one, with the same thing in it to take hold of.
 */
export function Spread({ className }: { className?: string }) {
  const spread = useStore((state) => state.view.spread)
  const setView = useStore((state) => state.setView)
  return (
    <Slider.Root
      min={SPREAD.min}
      max={SPREAD.max}
      step={0.05}
      value={spread}
      onValueChange={(value) => setView({ spread: value as number })}
      // the handle is all of it inside the track: at either end, it is against the end
      thumbAlignment="edge"
      className={cn("w-28", className)}
    >
      {/* (as much room round the handle, at the ends, as a switch leaves round its own) */}
      <Slider.Control className="flex h-[18.4px] w-full cursor-ew-resize touch-none items-center rounded-full bg-input px-[1.2px] select-none dark:bg-input/80">
        <Slider.Track className="relative h-full w-full">
          <Slider.Thumb
            aria-label="How far apart the parts are pulled"
            className="size-4 rounded-full bg-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-foreground"
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  )
}

/** The same at the foot of the view, by itself, while the model is exploded. */
export function ExplodeSlider() {
  return (
    <div className="glass pointer-events-auto flex h-10 items-center rounded-full bg-background/60 px-3.5 shadow-sm ring-1 ring-foreground/10">
      <Spread className="w-56" />
    </div>
  )
}
