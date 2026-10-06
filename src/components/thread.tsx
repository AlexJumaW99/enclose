import * as React from "react"
import {
  BoxIcon,
  PanelRightCloseIcon,
  SquarePenIcon,
  TriangleAlertIcon,
} from "lucide-react"

import type { Project, ThreadItem } from "@shared/api"
import { Composer } from "@/components/composer"
import { Markdown } from "@/components/markdown"
import { Steps } from "@/components/steps"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { inBlocks, type Block } from "@/lib/steps"
import {
  fitThread,
  THREAD_WIDTH,
  useStack,
  useStore,
  VIEW_MIN,
} from "@/lib/store"
import { useNow } from "@/lib/time"

type Of<Kind extends ThreadItem["kind"]> = Extract<ThreadItem, { kind: Kind }>

function UserMessage({ item }: { item: Of<"user"> }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {item.part && (
        <Badge variant="outline">
          <BoxIcon data-icon="inline-start" />
          {item.part.label}
        </Badge>
      )}
      <div className="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">
        {item.text}
      </div>
    </div>
  )
}

function PermissionCard({
  item,
  project,
}: {
  item: Of<"permission">
  project: Project
}) {
  const answer = (choice: "allow" | "always" | "deny") =>
    void window.cad.thread.answer(project.id, item.id, choice)
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-3.5 ring-1 ring-foreground/10">
      <div className="text-sm font-medium">{item.title}</div>
      {item.detail && (
        <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-2.5 font-mono text-xs whitespace-pre-wrap">
          {item.detail}
        </pre>
      )}
      {item.state === "pending" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => answer("allow")}>
            Allow
          </Button>
          {item.canAlways && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => answer("always")}
            >
              Always allow
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => answer("deny")}>
            Deny
          </Button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {item.state === "allowed" ? "Allowed" : "Denied"}
        </div>
      )}
    </div>
  )
}

function Item({
  item,
  project,
}: {
  item: Exclude<Block, { kind: "steps" }>
  project: Project
}) {
  switch (item.kind) {
    case "user":
      return <UserMessage item={item} />
    case "assistant":
      return <Markdown>{item.text}</Markdown>
    case "permission":
      return <PermissionCard item={item} project={project} />
    case "notice":
      return item.tone === "error" ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription className="whitespace-pre-wrap">
            {item.text}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="text-center text-xs text-muted-foreground">
          {item.text}
        </div>
      )
  }
}

/** How far an arrow key moves the conversation's edge, px. */
const NUDGE = 16

/**
 * The edge between the view and the conversation: dragged, it makes the conversation
 * wider or narrower. Double-clicked, it goes back to where it started. The panel it is
 * the edge of is the one it is put in.
 */
function Edge() {
  const width = useStore((state) => state.threadWidth)
  const setWidth = useStore((state) => state.setThreadWidth)
  const [dragging, setDragging] = React.useState(false)
  /** where the drag took hold, how wide the panel was then, and how wide it is now */
  const drag = React.useRef<{ x: number; from: number; to: number } | null>(
    null
  )

  const end = () => {
    const done = drag.current
    drag.current = null
    setDragging(false)
    // a press that went nowhere changes nothing: a narrow window may be showing the
    // panel narrower than it was dragged to, and that is not what was asked for
    if (done && done.to !== done.from) setWidth(done.to)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Width of the conversation"
      aria-valuenow={width}
      aria-valuemin={THREAD_WIDTH.min}
      aria-valuemax={fitThread(Infinity, window.innerWidth)}
      tabIndex={0}
      data-dragging={dragging || undefined}
      // astride the panel's border, and a few pixels either side of it to catch
      className="group/edge no-drag absolute inset-y-0 -left-[5px] z-10 w-[9px] cursor-col-resize touch-none outline-none select-none"
      onPointerDown={(event) => {
        const panel = event.currentTarget.parentElement
        if (event.button !== 0 || !panel) return
        // nothing under the pointer is to be selected on the way
        event.preventDefault()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // not a live pointer
        }
        const from = panel.offsetWidth
        drag.current = { x: event.clientX, from, to: from }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const held = drag.current
        const panel = event.currentTarget.parentElement
        if (!held || !panel) return
        held.to = fitThread(
          held.from + held.x - event.clientX,
          window.innerWidth
        )
        // set on the panel itself, and kept only once let go: drawing the whole
        // conversation again at every pixel on the way would drag behind the hand
        panel.style.width = `${held.to}px`
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => setWidth(THREAD_WIDTH.initial)}
      onKeyDown={(event) => {
        // the edge goes the way the arrow points: to the left is wider
        const by =
          event.key === "ArrowLeft"
            ? NUDGE
            : event.key === "ArrowRight"
              ? -NUDGE
              : 0
        const panel = event.currentTarget.parentElement
        if (!by || !panel) return
        event.preventDefault()
        setWidth(fitThread(panel.offsetWidth + by, window.innerWidth))
      }}
    >
      <div className="mx-auto h-full w-px transition-colors group-hover/edge:bg-foreground/30 group-focus-visible/edge:bg-ring group-data-dragging/edge:bg-foreground/50" />
    </div>
  )
}

/**
 * The conversation with Claude about the open project: the one turned to, of however
 * many it has had, or a new one with nothing said in it yet.
 */
export function Thread({ project }: { project: Project }) {
  // a conversation settles in days: once a minute is often enough to notice
  const { open } = useStack(project, useNow(60_000))
  const items = useStore((state) => (open ? state.items[open.id] : undefined))
  const load = useStore((state) => state.load)
  const openConversation = useStore((state) => state.openConversation)
  const claude = useStore((state) => state.claude)
  const selection = useStore((state) => state.selection)
  const select = useStore((state) => state.select)
  const setThreadOpen = useStore((state) => state.setThreadOpen)
  const width = useStore((state) => state.threadWidth)
  const end = React.useRef<HTMLDivElement>(null)

  const openId = open?.id
  React.useEffect(() => {
    if (openId) load(project.id, openId)
  }, [project.id, openId, load])

  // follow the conversation as it grows
  const last = items?.at(-1)
  const tail = last && "text" in last ? last.text.length : 0
  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [items?.length, tail])

  const blocks = React.useMemo(() => inBlocks(items ?? []), [items])
  const working = open?.status === "working"
  // one thing at a time is done in a project's folder
  const elsewhere = project.conversations.some(
    (c) => c.status !== "idle" && c.id !== openId
  )
  // a stretch of steps says for itself that there is more to come
  const latest = blocks.at(-1)
  const quiet =
    working && latest?.kind !== "assistant" && latest?.kind !== "steps"

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l bg-background"
      // however wide it was dragged, the view keeps its share of a narrower window
      style={{
        width,
        minWidth: THREAD_WIDTH.min,
        maxWidth: `calc(100vw - ${VIEW_MIN}px)`,
      }}
    >
      <Edge />
      <header className="drag flex h-12 shrink-0 items-center justify-between gap-2 pr-2 pl-4">
        <h2 className="truncate text-sm font-medium">{project.name}</h2>
        <div className="no-drag flex items-center">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  // from a new one there is nowhere newer to go
                  disabled={!open}
                  onClick={() => openConversation(project.id, null)}
                />
              }
            >
              <SquarePenIcon />
              <span className="sr-only">New conversation</span>
            </TooltipTrigger>
            <TooltipContent>New conversation</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setThreadOpen(false)}
                />
              }
            >
              <PanelRightCloseIcon />
              <span className="sr-only">Hide the conversation</span>
            </TooltipTrigger>
            <TooltipContent>Hide</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {items?.length ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3.5 px-4 pt-2 pb-4">
            {blocks.map((block) =>
              block.kind === "steps" ? (
                <Steps
                  key={block.id}
                  steps={block.steps}
                  working={working && block === latest}
                />
              ) : (
                <Item key={block.id} item={block} project={project} />
              )
            )}
            {quiet && (
              <div className="flex h-5 items-center text-xs text-muted-foreground">
                <span className="shimmer shimmer-color-foreground">
                  Working
                </span>
              </div>
            )}
            <div ref={end} />
          </div>
        </ScrollArea>
      ) : open ? (
        // what was said in it is on its way
        <div className="flex-1" />
      ) : (
        <Empty className="flex-1">
          {project.manifest ? (
            <EmptyHeader>
              <EmptyTitle>Ask Claude about this model</EmptyTitle>
              <EmptyDescription>
                Describe a change, or click a part in the view and say what it
                should become. Claude edits the project and rebuilds; the view
                updates by itself.
              </EmptyDescription>
            </EmptyHeader>
          ) : (
            <EmptyHeader>
              <EmptyTitle>What do you want to make?</EmptyTitle>
              <EmptyDescription>
                Describe it and Claude builds it in this folder. It takes the
                place of the cube.
              </EmptyDescription>
            </EmptyHeader>
          )}
        </Empty>
      )}

      <div className="flex flex-col gap-2 p-3 pt-0">
        <Composer
          part={selection?.part ?? null}
          onClearPart={() => select(null)}
          placeholder={
            project.manifest
              ? "Message Claude"
              : "A case for a Raspberry Pi Zero, with a lid that screws on…"
          }
          // opened to be written in: by its button, or by Cmd+B
          autoFocus
        />
        <p className="px-1 text-xs text-muted-foreground">
          {elsewhere
            ? "Claude is at work in another of this project's conversations."
            : !claude
              ? "Looking for Claude Code…"
              : claude.path
                ? `Using your Claude Code${claude.version ? ` ${claude.version}` : ""} and its login`
                : "Claude Code was not found on this machine. Install it and sign in there."}
        </p>
      </div>
    </aside>
  )
}
