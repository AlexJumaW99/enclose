import * as React from "react"
import { cn } from "cn"
import { PlusIcon, RefreshCwIcon, StarIcon, XIcon } from "lucide-react"

import type {
  EnvVar,
  ModelChoice,
  Provider,
  ProviderId,
  ProviderSettings,
} from "@shared/api"
import { ProviderIcon } from "@/components/icons"
import { Group, Row } from "@/components/setting"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  listedModels,
  PROVIDER_WORDS,
  standing,
  usable,
  type Standing,
} from "@/lib/providers"
import { changeProvider, checkProviders, useStore } from "@/lib/store"
import { ago, useNow } from "@/lib/time"

/**
 * Where each keeps its settings and its sign-in, for the ones that can be told to keep
 * them elsewhere: by the variable it reads that from, which is what it is known as.
 */
const HOME: Partial<
  Record<ProviderId, { title: string; placeholder: string }>
> = {
  claude: { title: "CLAUDE_CONFIG_DIR path", placeholder: "~/.claude" },
  codex: { title: "CODEX_HOME path", placeholder: "~/.codex" },
}

/** What more one might be started with, for the box that asks. */
const ARGS: Partial<Record<ProviderId, string>> = { claude: "e.g. --chrome" }

/** The mark of something wanting a look: nothing, where nothing does. */
function Dot({ tone }: { tone: Standing["tone"] }) {
  if (tone !== "warn" && tone !== "bad") return null
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        tone === "warn" ? "bg-attention" : "bg-destructive"
      )}
    />
  )
}

/** Something typed that counts once it is finished: on Enter, or on leaving the box. */
function Draft({
  value,
  onCommit,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string
  onCommit: (value: string) => void
}) {
  const [typed, setTyped] = React.useState(value)
  // what stands has changed under it: that is what it shows
  const [was, setWas] = React.useState(value)
  if (was !== value) {
    setWas(value)
    setTyped(value)
  }
  return (
    <Input
      value={typed}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={() => {
        if (typed.trim() !== value) onCommit(typed.trim())
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
      }}
      spellCheck={false}
      autoComplete="off"
      className={cn("h-8 w-56 font-mono text-xs md:text-xs", className)}
      {...props}
    />
  )
}

/** One of them in the list: what it is, how it stands, and whether it is in use. */
function Entry({
  provider,
  open,
  onOpen,
}: {
  provider: Provider
  open: boolean
  onOpen: () => void
}) {
  const { name } = PROVIDER_WORDS[provider.id]
  const { tone, headline, detail } = standing(provider)
  const { enabled } = provider.settings
  return (
    <div
      className={cn("flex items-center gap-3 pr-4", open && "bg-foreground/5")}
    >
      <button
        type="button"
        role="tab"
        aria-selected={open}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        {/* its mark stands left of all that is said of it, half way down */}
        <ProviderIcon
          provider={provider.id}
          className={cn("size-4 shrink-0", !enabled && "opacity-50")}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "flex items-baseline gap-2 text-sm font-medium",
              !enabled && "text-muted-foreground"
            )}
          >
            {name}
            {provider.status?.version && (
              <span className="font-mono text-xs font-normal text-muted-foreground">
                v{provider.status.version}
              </span>
            )}
          </span>
          <span className="flex items-baseline gap-1.5 text-sm text-muted-foreground">
            {/* (level with the middle of the first line, where there are two) */}
            <span className="flex h-5 shrink-0 items-center empty:hidden">
              <Dot tone={tone} />
            </span>
            <span className="line-clamp-2">
              {tone === "warn" && detail && headline === "Needs attention"
                ? `${headline} · ${detail}`
                : headline}
            </span>
          </span>
        </span>
      </button>
      <Switch
        aria-label={`Use ${name}`}
        checked={enabled}
        onCheckedChange={(on) =>
          void changeProvider(provider.id, { enabled: on })
        }
      />
    </div>
  )
}

/** What is set in its environment: a name and a value to a line. */
function Variables({ provider }: { provider: Provider }) {
  // what is being written: a line counts once it has a name
  const [rows, setRows] = React.useState<EnvVar[]>(provider.settings.env)
  const keep = (next: EnvVar[]) => {
    const named = next.filter((row) => row.name.trim())
    if (JSON.stringify(named) !== JSON.stringify(provider.settings.env))
      void changeProvider(provider.id, { env: named })
  }
  const write = (index: number, patch: Partial<EnvVar>) =>
    setRows((was) =>
      was.map((row, at) => (at === index ? { ...row, ...patch } : row))
    )
  return (
    <>
      <Row
        title="Variables"
        detail="API keys, base URLs and other settings for this CLI."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRows((was) => [...was, { name: "", value: "" }])}
        >
          <PlusIcon />
          Add variable
        </Button>
      </Row>
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2 px-4 py-2.5">
          <Input
            aria-label="Name"
            placeholder="NAME"
            value={row.name}
            onChange={(event) => write(index, { name: event.target.value })}
            onBlur={() => keep(rows)}
            spellCheck={false}
            autoComplete="off"
            className="h-8 w-52 font-mono text-xs md:text-xs"
          />
          <Input
            aria-label="Value"
            placeholder="Value"
            // a key is not for whoever is looking over a shoulder
            type={
              /key|token|secret|password/i.test(row.name) ? "password" : "text"
            }
            value={row.value}
            onChange={(event) => write(index, { value: event.target.value })}
            onBlur={() => keep(rows)}
            spellCheck={false}
            autoComplete="off"
            className="h-8 flex-1 font-mono text-xs md:text-xs"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${row.name || "this variable"}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              const next = rows.filter((_, at) => at !== index)
              setRows(next)
              keep(next)
            }}
          >
            <XIcon />
          </Button>
        </div>
      ))}
    </>
  )
}

/** Some of its models, under what they have in common. */
function Models_({
  title,
  models,
  provider,
}: {
  title: string
  models: ModelChoice[]
  provider: Provider
}) {
  const { hidden, favorites, custom } = provider.settings
  if (models.length === 0) return null
  const without = (list: string[], id: string) =>
    list.filter((one) => one !== id)
  const change = (patch: Partial<ProviderSettings>) =>
    void changeProvider(provider.id, patch)
  return (
    <div className="flex flex-col">
      <h3 className="pb-1 text-xs text-muted-foreground">{title}</h3>
      {models.map((model) => {
        const id = model.id ?? ""
        const off = hidden.includes(id)
        const favorite = favorites.includes(id)
        return (
          <div key={id} className="flex h-8 items-center gap-2.5">
            <button
              type="button"
              aria-pressed={favorite}
              aria-label={`${favorite ? "Remove" : "Make"} ${model.name} a favorite`}
              onClick={() =>
                change({
                  favorites: favorite
                    ? without(favorites, id)
                    : [...favorites, id],
                })
              }
              className="-m-1 cursor-pointer rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <StarIcon
                size={15}
                absoluteStrokeWidth
                strokeWidth={1}
                className={cn(favorite && "fill-attention text-attention")}
              />
            </button>
            <span
              className={cn(
                "truncate text-sm font-medium",
                off && "text-muted-foreground"
              )}
            >
              {model.name}
            </span>
            {model.name !== id && (
              <span className="truncate font-mono text-xs text-muted-foreground">
                {id}
              </span>
            )}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {model.efforts.length > 0 && "Reasoning"}
            </span>
            {custom.includes(id) && (
              <button
                type="button"
                aria-label={`Remove ${model.name}`}
                onClick={() =>
                  change({
                    custom: without(custom, id),
                    hidden: without(hidden, id),
                    favorites: without(favorites, id),
                  })
                }
                className="-m-1 cursor-pointer rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <XIcon size={15} absoluteStrokeWidth strokeWidth={1} />
              </button>
            )}
            <Switch
              size="sm"
              aria-label={`Show ${model.name} in the composer`}
              checked={!off}
              onCheckedChange={(on) =>
                change({ hidden: on ? without(hidden, id) : [...hidden, id] })
              }
            />
          </div>
        )
      })}
    </div>
  )
}

/** Its models: which are offered where one is chosen, and which come first there. */
function Models({ provider }: { provider: Provider }) {
  const { name, cli } = PROVIDER_WORDS[provider.id]
  const { hidden, favorites, custom } = provider.settings
  const [filter, setFilter] = React.useState("")
  const [adding, setAdding] = React.useState<string | null>(null)
  const all = listedModels(provider)

  if (all.length === 0 && adding === null)
    return (
      <Row
        title={
          !usable(provider)
            ? `${name} is not in use`
            : provider.checking
              ? `Asking ${cli} for its models…`
              : `${cli} has not said what models it has`
        }
        detail={
          usable(provider)
            ? undefined
            : provider.status?.path
              ? "Switch it on to list its models."
              : `Install ${cli} to list its models.`
        }
      >
        {usable(provider) && !provider.checking && (
          <Button variant="outline" size="sm" onClick={() => setAdding("")}>
            <PlusIcon />
            Add custom model
          </Button>
        )}
      </Row>
    )

  const wanted = filter.trim().toLowerCase()
  const found = all.filter(
    (model) =>
      !wanted ||
      model.name.toLowerCase().includes(wanted) ||
      (model.id ?? "").toLowerCase().includes(wanted)
  )
  const off = (model: ModelChoice) => hidden.includes(model.id ?? "")
  const first = (model: ModelChoice) => favorites.includes(model.id ?? "")
  const shown = all.filter((model) => !off(model))
  const add = () => {
    const id = (adding ?? "").trim()
    setAdding(null)
    if (id && !all.some((model) => model.id === id))
      void changeProvider(provider.id, { custom: [...custom, id] })
  }
  const said = [
    `${all.length} ${all.length === 1 ? "model" : "models"}`,
    ...(shown.some(first)
      ? [
          `${shown.filter(first).length} ${shown.filter(first).length === 1 ? "favorite" : "favorites"}`,
        ]
      : []),
    ...(all.length > shown.length
      ? [`${all.length - shown.length} hidden`]
      : []),
  ].join(" · ")

  return (
    <div className="flex flex-col gap-4 px-4 py-3.5">
      <p className="text-sm text-muted-foreground">
        Models switched off are left out of the composer.
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <Input
          aria-label="Filter models"
          placeholder="Filter models"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          spellCheck={false}
          className="h-8 w-48"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void changeProvider(provider.id, {
              hidden:
                shown.length === 0 ? [] : all.map((model) => model.id ?? ""),
            })
          }
        >
          {shown.length === 0 ? "Show all" : "Hide all"}
        </Button>
        <span className="text-sm text-muted-foreground">{said}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setAdding("")}
        >
          <PlusIcon />
          Add custom model
        </Button>
      </div>
      {adding !== null && (
        <div className="flex items-center gap-2">
          <Input
            aria-label="Model"
            placeholder={`A model as ${cli} knows it`}
            autoFocus
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") add()
            }}
            spellCheck={false}
            autoComplete="off"
            className="h-8 flex-1 font-mono text-xs md:text-xs"
          />
          <Button variant="outline" size="sm" onClick={add}>
            Add
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAdding(null)}>
            Cancel
          </Button>
        </div>
      )}
      <Models_
        title="Favorites"
        provider={provider}
        models={found.filter((model) => first(model) && !off(model))}
      />
      <Models_
        title="All"
        provider={provider}
        models={found.filter((model) => !first(model) && !off(model))}
      />
      <Models_
        title="Hidden from the composer"
        provider={provider}
        models={found.filter(off)}
      />
      {found.length === 0 && (
        <p className="text-sm text-muted-foreground">No model matches.</p>
      )}
    </div>
  )
}

/** All there is to say and to choose about one of them. */
function Detail({ provider }: { provider: Provider }) {
  const { name, cli, command } = PROVIDER_WORDS[provider.id]
  const { tone, headline, detail } = standing(provider)
  const { settings, status } = provider
  const home = HOME[provider.id]
  const change = (patch: Partial<ProviderSettings>) =>
    void changeProvider(provider.id, patch)
  return (
    <div className="flex flex-col gap-6 p-5">
      <header className="flex items-center gap-2.5 px-1">
        <ProviderIcon provider={provider.id} className="size-4.5 shrink-0" />
        <h2 className="text-sm font-medium">{name}</h2>
        {status?.version && (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            v{status.version}
          </span>
        )}
      </header>
      <Group>
        <Row
          title={
            <span className="flex items-center gap-1.5">
              <Dot tone={tone} />
              {headline}
            </span>
          }
          detail={detail ?? undefined}
        />
      </Group>
      <Group title="Runtime">
        <Row title="Binary path" detail={`The ${cli} binary to run.`} wrap>
          <Draft
            aria-label="Binary path"
            placeholder={command}
            value={settings.binary}
            onCommit={(binary) => change({ binary })}
          />
        </Row>
        {home && (
          <Row
            title={home.title}
            detail={`Where ${cli} keeps its settings and sign-in.`}
            wrap
          >
            <Draft
              aria-label={home.title}
              placeholder={home.placeholder}
              value={settings.home}
              onCommit={(path) => change({ home: path })}
            />
          </Row>
        )}
        <Row
          title="Launch arguments"
          detail="Extra arguments passed when a session starts."
          wrap
        >
          <Draft
            aria-label="Launch arguments"
            placeholder={ARGS[provider.id]}
            value={settings.args}
            onCommit={(args) => change({ args })}
          />
        </Row>
      </Group>
      <Group title="Environment">
        <Variables provider={provider} />
      </Group>
      <Group title="Models">
        <Models provider={provider} />
      </Group>
    </div>
  )
}

/**
 * The agents a message can be put to: each in a list, with a switch for whether it is in
 * use, and beside the list all there is to choose about the one that is open.
 */
export function Providers() {
  const providers = useStore((state) => state.providers)
  const [open, setOpen] = React.useState<ProviderId>("claude")
  const [asked, setAsked] = React.useState(false)
  const now = useNow(30_000)
  const provider = providers.find((one) => one.id === open)
  const checking = asked || providers.some((one) => one.checking)
  const checked = Math.max(
    0,
    ...providers.map((one) => one.status?.checkedAt ?? 0)
  )
  const since = ago(checked, now)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          disabled={checking}
          onClick={() => {
            setAsked(true)
            void checkProviders().finally(() => setAsked(false))
          }}
        >
          <RefreshCwIcon className={cn(checking && "animate-spin")} />
          {checking
            ? "Checking…"
            : checked === 0
              ? "Check again"
              : `Checked ${since === "now" ? "just now" : `${since} ago`}`}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Providers"
          className="flex w-72 shrink-0 flex-col divide-y divide-border/60 overflow-y-auto border-r border-border/60 last:*:border-b"
        >
          {providers.map((one) => (
            <Entry
              key={one.id}
              provider={one}
              open={one.id === open}
              onOpen={() => setOpen(one.id)}
            />
          ))}
        </div>
        <div role="tabpanel" className="min-w-0 flex-1 overflow-y-auto">
          {/* each has its own boxes, with nothing in them of another's */}
          {provider && <Detail key={provider.id} provider={provider} />}
        </div>
      </div>
    </div>
  )
}
