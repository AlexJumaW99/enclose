// At the foot of a blueprint: how its sheets show the model. Pulled apart or put
// together; and saying how big it is, or not. Beside each, while it is on, is what goes
// with it: how far apart the parts are pulled, and what the sizes are said in.
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ExplodeSlider } from "@/components/viewport/explode-slider"
import { usePreferences, type Unit } from "@/lib/preferences"
import { SPREAD, useStore } from "@/lib/store"

/** What a length can be said in, in the order they are offered. */
const UNITS: Unit[] = ["mm", "in"]

/** What each of these is, as the one at the foot of the view while Claude looks a model over is. */
const BAR =
  "glass animate-in bg-background/60 shadow-md ring-1 ring-foreground/10 duration-200 select-none fade-in"

export function Options() {
  const exploded = useStore((state) => state.view.exploded)
  const dimensions = useStore((state) => state.view.dimensions)
  const setView = useStore((state) => state.setView)
  const units = usePreferences((state) => state.units)
  const change = usePreferences((state) => state.change)
  return (
    <div className="pointer-events-auto relative">
      {/* What goes with either switch is beside the bar, and not in it: to the left of
          it for the one, to the right for the other. So the switches stay where they
          are under the pointer, whatever is on. */}
      {exploded && (
        <ExplodeSlider
          className={`${BAR} absolute inset-y-0 right-full mr-2 w-40 slide-in-from-right-1`}
        />
      )}
      <div
        className={`${BAR} flex h-10 items-center gap-5 rounded-full pr-3.5 pl-5 text-sm font-medium slide-in-from-bottom-2`}
      >
        {/* the words are as much the switch as the switch is */}
        <label className="flex items-center gap-3">
          Exploded
          <Switch
            checked={exploded}
            // pulled apart afresh, it is by the model's own distances
            onCheckedChange={(exploded) =>
              setView({ exploded, spread: SPREAD.min })
            }
          />
        </label>
        <label className="flex items-center gap-3">
          Dimensions
          <Switch
            checked={dimensions}
            onCheckedChange={(dimensions) => setView({ dimensions })}
          />
        </label>
      </div>
      {dimensions && (
        <ToggleGroup
          aria-label="Units"
          spacing={0.5}
          value={[units]}
          // one is always chosen: pressing the chosen one again changes nothing
          onValueChange={(chosen) => {
            const next = chosen.find((unit) => unit !== units) as
              Unit | undefined
            if (next) change({ units: next })
          }}
          className={`${BAR} absolute inset-y-0 left-full ml-2 rounded-full p-1 slide-in-from-left-1`}
        >
          {UNITS.map((unit) => (
            <ToggleGroupItem
              key={unit}
              value={unit}
              size="sm"
              // the chosen one is lit the way a button that is on is
              className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/85 aria-pressed:hover:text-primary-foreground"
            >
              {unit}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  )
}
