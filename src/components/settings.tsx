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
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { SETTLE_DAYS } from "@/lib/conversations"
import { MAC } from "@/lib/platform"
import { TURN_SPEED, usePreferences } from "@/lib/preferences"
import { useStore } from "@/lib/store"

const SECTIONS = [
  { id: "general", label: "General", icon: SlidersHorizontalIcon },
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "navigation", label: "Navigation", icon: Rotate3dIcon },
  { id: "shortcuts", label: "Shortcuts", icon: KeyboardIcon },
  { id: "claude", label: "Claude", icon: SparklesIcon },
  { id: "about", label: "About", icon: InfoIcon },
] as const satisfies { id: string; label: string; icon: LucideIcon }[]

type SectionId = (typeof SECTIONS)[number]["id"]

/** A run of settings that belong together, under a heading. */
function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border/60 rounded-2xl bg-card ring-1 ring-foreground/10">
        {children}
      </div>
    </section>
  )
}

/** One setting: what it is and what it does on the left, the control on the right. */
function Row({
  title,
  detail,
  children,
}: {
  title: string
  detail?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {detail && (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  )
}

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

function General() {
  const access = useStore((state) => state.access)
  const setAccess = useStore((state) => state.setAccess)
  const settleDays = usePreferences((state) => state.settleDays)
  const change = usePreferences((state) => state.change)
  const [settings, setSettings] = React.useState<AppSettings | null>(null)
  React.useEffect(() => {
    void window.cad.settings.get().then(setSettings)
  }, [])

  return (
    <>
      <Group title="New projects">
        <Row
          title="Projects folder"
          detail={
            <>
              Where a new project&rsquo;s folder is made when you name one. A
              folder you open or drop on the window stays where it is.
              <span className="mt-1 block font-mono text-xs break-all">
                {settings?.projectsFolder ?? " "}
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
          detail="When CAD files are opened, Claude looks over the model made of them: it is shown pictures of it, says what it takes the thing to be, and names and groups the parts. Off, the parts keep the names and groups the files gave them."
        >
          <Choice
            label="Have Claude look over opened files"
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
          detail="Supervised: Claude asks before it changes a file or runs anything. Edits: it edits the project's files freely and asks before anything else, such as running the build. Auto: it does what is routine and asks about the rest. Full: it never asks."
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
          detail="A conversation left alone for this long goes under its project's card, and the card offers a new one. None is deleted: they stay under the card until the project is removed."
        >
          <Days
            label="Days before a conversation settles"
            value={settleDays}
            onChange={(days) => change({ settleDays: days })}
          />
        </Row>
      </Group>
    </>
  )
}

function Appearance() {
  const { theme, setTheme } = useTheme()
  return (
    <Group title="Theme">
      <Row
        title="Colours"
        detail="System follows the Mac's light or dark setting."
      >
        <Choice
          label="Theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Row>
    </Group>
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
        detail="Fingers on a trackpad turn the model and a mouse wheel zooms. Both arrive as the same scroll, so Automatic tells them apart by how it moves. If it gets yours wrong, say which it is."
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
        detail="How far the model turns for the same movement of the hand."
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
const KEYS: { title: string; rows: [string, string[]][] }[] = [
  {
    title: "Views",
    rows: [
      ["The view a model opens with", [CMD, "1"]],
      ["Front, back", [CMD, "2", "3"]],
      ["Top, bottom", [CMD, "4", "5"]],
      ["Right, left", [CMD, "6", "7"]],
    ],
  },
  {
    title: "The model",
    rows: [
      ["Shading: solid, glass, wireframe or outline", ["Z"]],
      ["Section", ["S"]],
      ["Cut across an axis, while sectioned", ["X", "Y", "Z"]],
      ["Explode", ["E"]],
      ["Show what is picked out on its own, close to", ["I"]],
      ["Hide what is picked out, or bring back what is hidden", ["H"]],
      ["Parts", ["P"]],
      ["Grid: the ground and the world's axes", [SHIFT, "G"]],
      ["Search: find parts and groups by name", [CMD, "F"]],
      [
        "Put away the search or the list, then leave the last thing gone into",
        ["Esc"],
      ],
    ],
  },
  {
    title: "The app",
    rows: [
      ["Conversation", [CMD, "B"]],
      ["Settings", [CMD, ","]],
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
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </Row>
          ))}
        </Group>
      ))}
      <p className="px-1 text-sm text-muted-foreground">
        With a trackpad: two fingers turn the model, a pinch zooms, and Shift
        with two fingers pans. With a mouse: drag with the right button to turn,
        the wheel zooms, and Shift with that drag pans.
      </p>
      <p className="px-1 text-sm text-muted-foreground">
        A click picks a part out, or the whole of the object it belongs to: the
        parts of a group that touch one another, such as a circuit board and
        what is on it. A click with {SHIFT} held picks out the one part: on its
        own, or added to what is picked out, or taken back out of it. A second
        click, or a click with {CMD} held, picks out the one part and nothing
        else. With {SHIFT} held, a second click straight after the first adds
        the whole of the part's object instead. A drag draws a box that picks
        out several: from left to right the parts wholly inside it, from right
        to left every part it touches, and an object goes whole with any part of
        it; with {SHIFT} held it adds to what is picked out. Parts picked out
        together show through whatever is in front of them.
      </p>
    </>
  )
}

function Claude() {
  const claude = useStore((state) => state.claude)
  return (
    <Group title="Claude Code">
      <Row
        title={
          !claude
            ? "Looking for Claude Code…"
            : claude.path
              ? `Claude Code${claude.version ? ` ${claude.version}` : ""}`
              : "Claude Code was not found"
        }
        detail={
          claude?.path ? (
            <span className="font-mono text-xs break-all">{claude.path}</span>
          ) : (
            "Install Claude Code and sign in to it, then start Enclose again."
          )
        }
      />
      <Row
        title="Signing in"
        detail="Enclose has no login of its own and keeps no credentials. It works through the Claude Code on this Mac, with the account that is signed in there. To sign in or change account, do it in Claude Code."
      />
    </Group>
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
    </Group>
  )
}

const PAGES: Record<SectionId, () => React.ReactNode> = {
  general: General,
  appearance: Appearance,
  navigation: Navigation,
  shortcuts: Shortcuts,
  claude: Claude,
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
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-8 pt-4 pb-16">
            <Page />
          </div>
        </div>
      </main>
    </div>
  )
}
