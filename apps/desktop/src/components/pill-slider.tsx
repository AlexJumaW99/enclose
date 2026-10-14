import { Slider } from "@base-ui/react/slider"
import { cn } from "cn"

/**
 * A slider made to look like the app's switches: as tall as one, with the same thing in
 * it to take hold of, and no fill behind that. How far apart an exploded model's parts
 * are pulled is set with one, and so are the speeds in the settings.
 */
export function PillSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  className,
}: {
  /** what it sets, for whoever cannot see it */
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  className?: string
}) {
  return (
    <Slider.Root
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={(next) => onChange(next as number)}
      // the handle is all of it inside the track: at either end, it is against the end
      thumbAlignment="edge"
      className={cn("w-28", className)}
    >
      {/* (as much room round the handle, at the ends, as a switch leaves round its own) */}
      <Slider.Control className="flex h-[18.4px] w-full cursor-ew-resize touch-none items-center rounded-full bg-input px-[1.2px] select-none dark:bg-input/80">
        <Slider.Track className="relative h-full w-full">
          <Slider.Thumb
            aria-label={label}
            className="size-4 rounded-full bg-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-foreground"
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  )
}
