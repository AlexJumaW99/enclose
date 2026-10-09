import * as React from "react"
import { cn } from "cn"
import {
  ArrowLeftIcon,
  InfoIcon,
  KeyboardIcon,
  PaletteIcon,
  Rotate3dIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react"

import type { Settings as AppSettings } from "@shared/api"
import { Miniature } from "@/components/miniature"
import { Providers } from "@/components/providers"
import { Group, Row } from "@/components/setting"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { SETTLE_DAYS } from "@/lib/conversations"
import { ACCESS_WORDS } from "@/lib/manner"
import { MAC } from "@/lib/platform"
import { TURN_SPEED, usePreferences } from "@/lib/preferences"
import { useStore } from "@/lib/store"

const SECTIONS = [
  { id: "general", label: "General", icon: SlidersHorizontalIcon },
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "navigation", label: "Navigation", icon: Rotate3dIcon },
  { id: "shortcuts", label: "Shortcuts", icon: KeyboardIcon },
  { id: "providers", label: "Providers", icon: SparklesIcon },
  { id: "about", label: "About", icon: InfoIcon },
] as const satisfies { id: string; label: string; icon: LucideIcon }[]

type SectionId = (typeof SECTIONS)[number]["id"]

/** A choice of one out of a few, all of them in view. */
function Choice<Value extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: Value
  onChange: (value: Value) => void
  options: { value: Value; label: string }[]
  label: string
}) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      // one is always chosen: pressing the chosen one again changes nothing
      onValueChange={(chosen) => {
        const next = chosen.find((item) => item !== value) as Value | undefined
        if (next) onChange(next)
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          // the chosen one is lit the way a button that is on is
          className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/85 aria-pressed:hover:text-primary-foreground"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** A whole number of days, typed in. What is typed counts as soon as it is one. */
function Days({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (days: number) => void
  label: string
}) {
  const [typed, setTyped] = React.useState(String(value))
  return (
    <>
      <Input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={SETTLE_DAYS.min}
        max={SETTLE_DAYS.max}
        step={1}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value)
          const days = Number(event.target.value)
          if (
            Number.isInteger(days) &&
            days >= SETTLE_DAYS.min &&
            days <= SETTLE_DAYS.max
          )
            onChange(days)
        }}
        // what was left half-typed gives way to what stands
        onBlur={() => setTyped(String(value))}
        className="h-8 w-16 text-right tabular-nums"
      />
      <span className="text-sm text-muted-foreground">
        {value === 1 ? "day" : "days"}
      </span>
    </>
  )
}

/** How much room a folder takes, as it is said to someone: "294 MB", "1.2 GB". */
function roomOf(bytes: number): string {
  if (!bytes) return "Empty"
  if (bytes < 999_500) return `${Math.max(1, Math.round(bytes / 1000))} KB`
  if (bytes < 999_500_000) return `${Math.round(bytes / 1_000_000)} MB`
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

function General() {
  const access = useStore((state) => state.access)
  const setAccess = useStore((state) => state.setAccess)
  const settleDays = usePreferences((state) => state.settleDays)
  const units = usePreferences((state) => state.units)
  const change = usePreferences((state) => state.change)
  const [settings, setSettings] = React.useState<AppSettings | null>(null)
  React.useEffect(() => {
    void window.cad.settings.get().then(setSettings)
  }, [])
  // the room the projects folder takes, and which folder that was measured for
  const [measured, setMeasured] = React.useState<{
    folder: string
    bytes: number
  } | null>(null)
  const folder = settings?.projectsFolder
  React.useEffect(() => {
    if (!folder) return
    let stale = false
    void window.cad.settings.projectsFolderSize().then((bytes) => {
      if (!stale) setMeasured({ folder, bytes })
    })
    return () => {
      stale = true
    }
  }, [folder])
  const size = measured && measured.folder === folder ? measured.bytes : null

  return (
    <>
      <Group title="New projects">
        <Row
          title="Projects folder"
          detail={
            <>
              Where new projects are saved.
              <span className="mt-1 block text-xs">
                <span className="font-mono break-all">{folder ?? " "}</span>
                {size !== null && ` · ${roomOf(size)}`}
              </span>
            </>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void window.cad.settings.revealProjectsFolder()}
          >
            Show
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void window.cad.settings.chooseProjectsFolder().then(setSettings)
            }
          >
            Change…
          </Button>
        </Row>
        <Row
          title="Opened files"
          detail="Names and groups the parts of CAD files you open."
        >
          <Choice
            label="Look over opened files"
            value={settings?.lookOver === false ? "off" : "on"}
            onChange={(value) =>
              void window.cad.settings
                .setLookOver(value === "on")
                .then(setSettings)
            }
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
        </Row>
      </Group>
      <Group title="Conversations">
        <Row
          title="Permissions"
          // the one that is chosen, in the words the message box has for it
          detail={`${ACCESS_WORDS[access].detail}.`}
        >
          <Choice
            label="Permissions"
            value={access}
            onChange={setAccess}
            options={[
              { value: "supervised", label: "Supervised" },
              { value: "edits", label: "Edits" },
              { value: "auto", label: "Auto" },
              { value: "full", label: "Full" },
            ]}
          />
        </Row>
        <Row
          title="Earlier conversations"
          detail="Conversations idle this long are tucked under their project's card."
        >
          <Days
            label="Days before a conversation settles"
            value={settleDays}
            onChange={(days) => change({ settleDays: days })}
          />
        </Row>
      </Group>
      <Group title="Blueprints">
        <Row title="Units" detail="The unit dimensions are shown in.">
          <Choice
            label="Units"
            value={units}
            onChange={(value) => change({ units: value })}
            options={[
              { value: "mm", label: "mm" },
              { value: "in", label: "in" },
            ]}
          />
        </Row>
      </Group>
    </>
  )
}

/** The themes there are, in the order they are offered. */
const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const

function Appearance() {
  const { theme, setTheme } = useTheme()
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm text-muted-foreground">Theme</h2>
      <div className="grid grid-cols-3 gap-3">
        {THEMES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            className="group flex flex-col gap-2 rounded-2xl bg-card p-1.5 pb-2.5 ring-1 ring-foreground/10 outline-none hover:ring-foreground/25 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-primary"
          >
            {/* the window as the theme draws it, its corners following the card's */}
            <span className="block overflow-hidden rounded-[0.75rem] ring-1 ring-foreground/10">
              <Miniature theme={value} />
            </span>
            <span className="text-sm text-muted-foreground group-aria-pressed:text-foreground">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Navigation() {
  const scrolling = usePreferences((state) => state.scrolling)
  const turnSpeed = usePreferences((state) => state.turnSpeed)
  const change = usePreferences((state) => state.change)
  return (
    <Group title="Moving around the model">
      <Row
        title="Scrolling"
        detail="Scrolling turns the model on a trackpad and zooms with a mouse wheel."
      >
        <Choice
          label="Scrolling"
          value={scrolling}
          onChange={(value) => change({ scrolling: value })}
          options={[
            { value: "auto", label: "Automatic" },
            { value: "trackpad", label: "Trackpad" },
            { value: "wheel", label: "Mouse" },
          ]}
        />
      </Row>
      <Row
        title="Turning speed"
        detail="How far the model turns as you scroll or drag."
      >
        <span className="w-10 text-right text-sm text-muted-foreground tabular-nums">
          {Math.round(turnSpeed * 100)}%
        </span>
        {/* the slider is as wide as what holds it, which has to say how wide that is */}
        <div className="w-40">
          <Slider
            aria-label="Turning speed"
            min={TURN_SPEED.min}
            max={TURN_SPEED.max}
            step={0.05}
            value={[turnSpeed]}
            onValueChange={(value) =>
              change({ turnSpeed: Array.isArray(value) ? value[0] : value })
            }
          />
        </div>
      </Row>
    </Group>
  )
}

const CMD = MAC ? "⌘" : "Ctrl"
const SHIFT = MAC ? "⇧" : "Shift"
/** Stands between two ways of doing the same thing: a word, where the rest are keys. */
const OR = "or"
const KEYS: { title: string; rows: [string, string[]][] }[] = [
  {
    title: "Views",
    rows: [
      ["Home", [CMD, "1"]],
      ["Front, back", [CMD, "2", "3"]],
      ["Top, bottom", [CMD, "4", "5"]],
      ["Right, left", [CMD, "6", "7"]],
      ["Focus on the selection", ["Space"]],
    ],
  },
  {
    title: "The model",
    rows: [
      ["Shading", ["Z"]],
      ["Parts", ["P"]],
      ["Group the selection", [CMD, "G"]],
      ["Ungroup", [SHIFT, CMD, "G"]],
      ["Grid", [SHIFT, "G"]],
      ["Section", ["S"]],
      ["Section axis", ["X", "Y", "Z"]],
      ["Explode", ["E"]],
      ["Reference", [CMD, "/"]],
      ["Isolate the selection", ["I"]],
      ["Hide the selection, or show everything", ["H"]],
      ["Blueprint", ["B"]],
      ["Search", [CMD, "F"]],
      ["Tools", ["T"]],
      ["Undo", [CMD, "Z"]],
      ["Redo", [SHIFT, CMD, "Z"]],
      ["Close, or step back", ["Esc"]],
    ],
  },
  {
    title: "The app",
    rows: [
      ["Conversation", [CMD, "B"]],
      ["Settings", [CMD, ","]],
    ],
  },
  {
    title: "Trackpad",
    rows: [
      ["Turn", ["Two fingers"]],
      ["Zoom", ["Pinch"]],
      ["Pan", [SHIFT, "Two fingers"]],
    ],
  },
  {
    title: "Mouse",
    rows: [
      ["Turn", ["Right drag"]],
      ["Zoom", ["Wheel"]],
      ["Pan", [SHIFT, "Right drag"]],
    ],
  },
  {
    title: "Selecting",
    rows: [
      ["Select a part, or the object it belongs to", ["Click"]],
      ["Select a single part", ["Double click", OR, CMD, "Click"]],
      ["Add or remove a part", [SHIFT, "Click"]],
      ["Add a whole object", [SHIFT, "Double click"]],
      ["Select everything inside a box", ["Drag right"]],
      ["Select everything a box touches", ["Drag left"]],
      ["Add to the selection", [SHIFT, "Drag"]],
    ],
  },
]

function Shortcuts() {
  return (
    <>
      {KEYS.map((group) => (
        <Group key={group.title} title={group.title}>
          {group.rows.map(([what, keys]) => (
            <Row key={what} title={what}>
              {keys.map((key) =>
                key === OR ? (
                  <span key={key} className="text-xs text-muted-foreground">
                    {key}
                  </span>
                ) : (
                  <Kbd key={key}>{key}</Kbd>
                )
              )}
            </Row>
          ))}
        </Group>
      ))}
    </>
  )
}

function About() {
  return (
    <Group title="Enclose">
      <Row title="Version" detail={__APP_VERSION__} />
      <Row title="Website">
        <a
          href="https://enclose.dev"
          target="_blank"
          rel="noreferrer"
          className="text-sm underline underline-offset-4"
        >
          enclose.dev
        </a>
      </Row>
      <Row title="Fork it and collaborate">
        <a
          href="https://github.com/glauberxyz/enclose"
          target="_blank"
          rel="noreferrer"
          className="text-sm underline underline-offset-4"
        >
          github.com/glauberxyz/enclose
        </a>
      </Row>
    </Group>
  )
}

const PAGES: Record<SectionId, () => React.ReactNode> = {
  general: General,
  appearance: Appearance,
  navigation: Navigation,
  shortcuts: Shortcuts,
  providers: Providers,
  about: About,
}

/**
 * The settings, over the whole window: the sections down the left, and the one that is
 * open beside them. Esc, or Back, returns to the model.
 */
export function Settings() {
  const close = useStore((state) => state.setSettingsOpen)
  const [open, setOpen] = React.useState<SectionId>("general")
  const Page = PAGES[open]
  const section = SECTIONS.find((item) => item.id === open)

  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // before anything under the settings hears it
      event.stopPropagation()
      event.preventDefault()
      close(false)
    }
    window.addEventListener("keydown", key, true)
    return () => window.removeEventListener("keydown", key, true)
  }, [close])

  return (
    <div className="fixed inset-0 z-40 flex bg-background text-foreground">
      <nav className="flex w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar">
        {/* room for the window's traffic lights, and something to drag it by */}
        <div className="drag flex h-12 shrink-0 items-center pl-22 text-sm font-medium">
          Enclose
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-2">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={open === id}
              onClick={() => setOpen(id)}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                open === id
                  ? "bg-sidebar-accent font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-muted-foreground"
            onClick={() => close(false)}
          >
            <ArrowLeftIcon />
            Back
            <Kbd className="ml-auto">Esc</Kbd>
          </Button>
        </div>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="drag flex h-12 shrink-0 items-center gap-2 px-6 text-sm">
          <span className="text-muted-foreground">Settings</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{section?.label}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              "mx-auto flex w-full flex-col gap-8 px-8 pt-4",
              // the providers are a list with what is open of it beside: wider than a
              // column of settings, and as tall as the window, scrolling within itself
              open === "providers" ? "h-full max-w-5xl pb-8" : "max-w-2xl pb-16"
            )}
          >
            <Page />
          </div>
        </div>
      </main>
    </div>
  )
}
