import { FlipHorizontal2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useStore, type Axis, type ShellMode } from "@/lib/store"
import type { LoadedModel } from "./viewport/load"

const one = (value: number | readonly number[]) =>
  (Array.isArray(value) ? value[0] : value) as number

/** How the model is looked at: what is see-through, pulled apart, cut open or switched off. */
export function Toolbar({ loaded }: { loaded: LoadedModel }) {
  const view = useStore((state) => state.view)
  const setView = useStore((state) => state.setView)
  const { model, box } = loaded

  const shells = model.layers.filter((l) => l.control === "shell")
  const toggles = model.layers.filter((l) => l.control === "toggle")
  const explodes = model.parts.some((p) => p.explode.some((n) => n !== 0))
  const range: Record<Axis, [number, number]> = {
    x: [box.min.x, box.max.x],
    y: [box.min.y, box.max.y],
    z: [box.min.z, box.max.z],
  }
  const [low, high] = range[view.clip?.axis ?? "x"]

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-3 rounded-3xl bg-background px-5 py-3 shadow-sm ring-1 ring-foreground/10">
      {shells.length > 0 && (
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel>{shells[0].label}</FieldLabel>
          <ToggleGroup
            value={[view.shell]}
            onValueChange={(v) => v[0] && setView({ shell: v[0] as ShellMode })}
            variant="outline"
            size="sm"
            spacing={0}
          >
            <ToggleGroupItem value="solid">Solid</ToggleGroupItem>
            <ToggleGroupItem value="glass">Glass</ToggleGroupItem>
            <ToggleGroupItem value="hidden">Hidden</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      )}
      {explodes && (
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="explode">Explode</FieldLabel>
          <Slider
            id="explode"
            className="w-20 data-horizontal:w-20"
            min={0}
            max={1}
            step={0.01}
            value={[view.explode]}
            onValueChange={(v) => setView({ explode: one(v) })}
          />
        </Field>
      )}
      <Field orientation="horizontal" className="w-auto">
        <FieldLabel>Section</FieldLabel>
        <ToggleGroup
          value={[view.clip?.axis ?? "off"]}
          onValueChange={(v) => {
            const axis = v[0]
            if (!axis || axis === "off") return setView({ clip: null })
            const [min, max] = range[axis as Axis]
            setView({
              clip: { axis: axis as Axis, at: (min + max) / 2, side: -1 },
            })
          }}
          variant="outline"
          size="sm"
          spacing={0}
        >
          <ToggleGroupItem value="off">Off</ToggleGroupItem>
          <ToggleGroupItem value="x">X</ToggleGroupItem>
          <ToggleGroupItem value="y">Y</ToggleGroupItem>
          <ToggleGroupItem value="z">Z</ToggleGroupItem>
        </ToggleGroup>
        <Slider
          className="w-20 data-horizontal:w-20"
          aria-label="Section position"
          disabled={!view.clip}
          min={low}
          max={high}
          step={(high - low) / 200 || 1}
          value={[view.clip?.at ?? (low + high) / 2]}
          onValueChange={(v) =>
            view.clip && setView({ clip: { ...view.clip, at: one(v) } })
          }
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!view.clip}
                onClick={() =>
                  view.clip &&
                  setView({
                    clip: { ...view.clip, side: view.clip.side === 1 ? -1 : 1 },
                  })
                }
              />
            }
          >
            <FlipHorizontal2Icon />
            <span className="sr-only">Flip the section</span>
          </TooltipTrigger>
          <TooltipContent>Show the other side</TooltipContent>
        </Tooltip>
      </Field>
      {model.keepouts.length > 0 && (
        <Field orientation="horizontal" className="w-auto">
          <Switch
            id="keepouts"
            checked={view.keepouts}
            onCheckedChange={(keepouts) => setView({ keepouts })}
          />
          <FieldLabel htmlFor="keepouts">{model.keepoutsLabel}</FieldLabel>
        </Field>
      )}
      {toggles.map((layer) => (
        <Field key={layer.id} orientation="horizontal" className="w-auto">
          <Switch
            id={`layer-${layer.id}`}
            checked={!view.off[layer.id]}
            onCheckedChange={(on) =>
              setView({ off: { ...view.off, [layer.id]: !on } })
            }
          />
          <FieldLabel htmlFor={`layer-${layer.id}`}>{layer.label}</FieldLabel>
        </Field>
      ))}
    </div>
  )
}
