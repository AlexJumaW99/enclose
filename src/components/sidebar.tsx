import * as React from "react"
import { cn } from "cn"
import {
  ChevronDownIcon,
  CornerLeftUpIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"

import type { ConversationSummary, Project } from "@shared/api"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useStack, useStore } from "@/lib/store"
import { ago, useNow } from "@/lib/time"

/** What a card is, whether it is a project's or one of its earlier conversations'. */
const CARD =
  "glass pointer-events-auto relative flex w-full flex-col rounded-xl px-3 py-2.5 text-left ring-1 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
/** The card of what is open, and the others. */
const LIT = "bg-sidebar-accent/90 shadow-sm ring-foreground/15"
const UNLIT =
  "bg-sidebar-accent/45 ring-foreground/5 hover:bg-sidebar-accent/65"

/** What a card is written in, and its name: the same size, and heavier. */
const SMALL = "text-[11px] leading-[1.4]"
const NAME = `truncate ${SMALL} font-medium`

/**
 * What there is to say of a conversation besides what was last said in it: that Claude is
 * in the middle of it, or has got to the end of it and it has not been looked at since.
 */
type News = "working" | "asking" | "done" | "failed"

function newsOf(
  conversation: ConversationSummary | null,
  finished: string[]
): News | null {
  if (!conversation) return null
  if (conversation.status !== "idle") return conversation.status
  if (!finished.includes(conversation.id)) return null
  return conversation.failed ? "failed" : "done"
}

/** How each is said on the card it is the news of, and under a card it is under. */
const NEWS: Record<News, { label: string; under: string; className: string }> =
  {
    working: {
      label: "Working",
      under: "Working in an earlier chat",
      // a light passes along it for as long as Claude is at work
      className: "text-attention shimmer",
    },
    asking: {
      label: "Needs you",
      under: "An earlier chat needs you",
      className: "text-attention",
    },
    done: {
      label: "Done",
      under: "An earlier chat is done",
      className: "text-foreground",
    },
    failed: {
      label: "Failed",
      under: "An earlier chat failed",
      className: "text-destructive",
    },
  }

/** Top right of a card: when the conversation on it was last carried on. */
function When({
  conversation,
  now,
}: {
  conversation: ConversationSummary
  now: number
}) {
  const finished = useStore((state) => state.finished)
  // one there is news of says that instead, across the end of the card
  if (newsOf(conversation, finished)) return null
  return (
    <span className={cn(SMALL, "shrink-0 text-muted-foreground tabular-nums")}>
      {ago(conversation.updatedAt, now)}
    </span>
  )
}

/**
 * What a card says under its name: the last of its conversation, in the two lines there
 * is room for.
 */
function Said({
  conversation,
  otherwise,
}: {
  conversation: ConversationSummary | null
  /** what the card says when there is no conversation on it */
  otherwise: string
}) {
  return (
    <span className={cn(SMALL, "line-clamp-2 text-muted-foreground")}>
      {conversation
        ? (conversation.gist ?? conversation.lastMessage)
        : otherwise}
    </span>
  )
}

/**
 * Everything written on a card. While there is news of the card's conversation all of
 * it, the name included, gives way at its far end to the card's saying so, half way up
 * the card: the name is on show elsewhere, and this is the news.
 */
function Written({
  conversation,
  children,
}: {
  conversation: ConversationSummary | null
  children: React.ReactNode
}) {
  const news = newsOf(
    conversation,
    useStore((state) => state.finished)
  )
  return (
    <>
      <span
        className={cn(
          "flex flex-col gap-0.5",
          news &&
            "[mask-image:linear-gradient(to_right,black_calc(100%-6.25rem),transparent_calc(100%-4rem))]"
        )}
      >
        {children}
      </span>
      {news && (
        <span
          className={cn(
            SMALL,
            "absolute top-1/2 right-3 -translate-y-1/2 font-medium"
          )}
        >
          <span className={NEWS[news].className}>{NEWS[news].label}</span>
        </span>
      )}
    </>
  )
}

/**
 * The bottom edge of a card with earlier conversations under it, and the sliver of the
 * next of them that shows below. This is what is pressed to spread them out; the rest
 * of the card opens what is on it. If Claude is in the middle of one of those under the
 * card, the sliver is tall enough to say so.
 */
function Under({
  count,
  news,
  onSpread,
}: {
  count: number
  /** what there is to say of one of them, if there is anything */
  news: News | null
  onSpread: () => void
}) {
  const label =
    count === 1 ? "1 earlier conversation" : `${count} earlier conversations`
  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-expanded={false}
            onClick={onSpread}
            // a little of the card's own edge, and what is under it
            className={cn(
              "group/under pointer-events-auto absolute inset-x-0 z-10 cursor-pointer outline-none",
              news ? "-bottom-7.5 h-9" : "-bottom-2.5 h-4"
            )}
          />
        }
      >
        {/* the card beneath, as much of it as shows: it comes out a little to be pressed */}
        <span
          className={cn(
            "glass absolute inset-x-2.5 top-1.5 flex items-center gap-1 rounded-b-lg border-x border-b border-foreground/5 bg-sidebar-accent/45 px-2.5 transition-[height]",
            news
              ? "h-6 group-hover/under:h-6.5 group-focus-visible/under:h-6.5"
              : "h-1.5 group-hover/under:h-2.5 group-focus-visible/under:h-2.5"
          )}
        >
          {news && (
            <>
              <span
                className={cn(
                  SMALL,
                  "min-w-0 truncate",
                  // here the light passes along quieter words than on a card
                  news === "working"
                    ? "shimmer text-muted-foreground shimmer-color-foreground"
                    : NEWS[news].className
                )}
              >
                {NEWS[news].under}
              </span>
              <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
            </>
          )}
        </span>
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * A project: its card, which is the conversation being carried on about it or the offer
 * of a new one, and under the card the conversations had before, which spread out below
 * it when asked for.
 */
function ProjectCard({ project, now }: { project: Project; now: number }) {
  const active = useStore((state) => state.activeId === project.id)
  const openConversation = useStore((state) => state.openConversation)
  const removeProject = useStore((state) => state.removeProject)
  const { cover, under, open } = useStack(project, now)
  const [spread, setSpread] = React.useState(false)
  // News of one of the conversations under the card, which the card itself has nothing
  // to say of: the edge under it does. Claude being in the middle of one comes first.
  const finished = useStore((state) => state.finished)
  const newsUnder =
    newsOf(under.find((c) => c.status !== "idle") ?? null, finished) ??
    newsOf(under.find((c) => finished.includes(c.id)) ?? null, finished)
  // the card is lit for its project, unless what is open is spread out under it
  const openUnder = under.some((c) => c.id === open?.id)
  const lit = active && !(spread && openUnder)

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      {/* the card is one button, and closing it another beside it: one cannot go in the other */}
      <div
        className={cn(
          "group/card relative w-49",
          // room for the one that shows under it
          under.length > 0 && !spread && (newsUnder ? "mb-6.5" : "mb-1.5")
        )}
      >
        <ProjectMenu project={project}>
          <button
            type="button"
            aria-current={active}
            onClick={() => openConversation(project.id, cover?.id ?? null)}
            className={cn(CARD, lit ? LIT : UNLIT)}
          />
          <Written conversation={cover}>
            <span className="flex items-baseline justify-between gap-2">
              <span className={NAME}>{project.name}</span>
              {/* makes way for the close button while the pointer is on the card */}
              {cover && (
                <span className="flex transition-opacity group-focus-within/card:opacity-0 group-hover/card:opacity-0">
                  <When conversation={cover} now={now} />
                </span>
              )}
            </span>
            <Said
              conversation={cover}
              otherwise={
                under.length > 0 ? "Start a new session" : "No messages yet"
              }
            />
            {/* the branch, for a folder that is kept in git */}
            {project.branch && (
              <span
                className={cn(
                  SMALL,
                  "mt-1.5 truncate text-muted-foreground/70"
                )}
              >
                {project.branch}
              </span>
            )}
          </Written>
        </ProjectMenu>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${project.name}`}
          title="Remove project"
          className="pointer-events-auto absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100"
          onClick={() => void removeProject(project.id)}
        >
          <XIcon />
        </Button>
        {under.length > 0 && !spread && (
          <Under
            count={under.length}
            news={newsUnder}
            onSpread={() => setSpread(true)}
          />
        )}
      </div>
      {spread &&
        under.map((conversation, index) => (
          <div
            key={conversation.id}
            className="flex animate-in items-center duration-150 fade-in slide-in-from-top-1"
          >
            {/* set in from the card they came out from under, which leaves room beside
                the first of them for what puts them back */}
            <span className="flex w-8 shrink-0 justify-center">
              {index === 0 && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Put the earlier conversations back"
                  className="pointer-events-auto text-muted-foreground"
                  onClick={() => setSpread(false)}
                >
                  <CornerLeftUpIcon />
                </Button>
              )}
            </span>
            <button
              type="button"
              aria-current={active && open?.id === conversation.id}
              onClick={() => openConversation(project.id, conversation.id)}
              className={cn(
                CARD,
                "w-49",
                active && open?.id === conversation.id ? LIT : UNLIT
              )}
            >
              <Written conversation={conversation}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className={NAME}>{conversation.title}</span>
                  <When conversation={conversation} now={now} />
                </span>
                <Said conversation={conversation} otherwise="" />
              </Written>
            </button>
          </div>
        ))}
    </div>
  )
}

/** A card, with what else can be done with its project on a right-click. */
function ProjectMenu({
  project,
  children,
}: {
  project: Project
  /** the card's button, then what goes in it */
  children: [React.ReactElement, ...React.ReactNode[]]
}) {
  const removeProject = useStore((state) => state.removeProject)
  const [card, ...inside] = children
  return (
    <ContextMenu>
      <ContextMenuTrigger render={card}>{inside}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuItem
            onClick={() => void window.cad.projects.reveal(project.id)}
          >
            Open folder
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          {/* the folder stays; what was said about it goes, which is asked about first */}
          <ContextMenuItem onClick={() => void removeProject(project.id)}>
            Remove project
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * The projects: one card per folder, with what its conversation is up to, and its earlier
 * conversations under it. The cards float over the 3D view rather than taking a column
 * from it, so the model is never cut off at an edge; everything between and below them
 * still belongs to the view.
 */
export function Sidebar() {
  const projects = useStore((state) => state.projects)
  const addProject = useStore((state) => state.addProject)
  const createProject = useStore((state) => state.createProject)
  const [adding, setAdding] = React.useState(false)
  const now = useNow()
  // with no projects the middle of the window is where one is started
  if (projects.length === 0)
    return (
      <aside className="pointer-events-none absolute inset-x-0 top-0">
        <div className="drag pointer-events-auto h-12" />
      </aside>
    )

  return (
    // wider than a card, by as far as the ones spread out from under it are set in
    <aside className="pointer-events-none absolute inset-y-0 left-0 flex w-68 flex-col">
      {/* room for the window's traffic lights, and something to drag it by */}
      <div className="drag pointer-events-auto h-12 w-58 shrink-0" />
      {/* a list that scrolls cuts off whatever is outside it, and a card's edge is drawn
          just outside the card: it starts a little higher than the first card does */}
      <div className="-mt-1 flex min-h-0 [scrollbar-width:none] flex-col items-start gap-1.5 overflow-y-auto px-4.5 pt-1 pb-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} now={now} />
        ))}
        <DropdownMenu open={adding} onOpenChange={setAdding}>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="pointer-events-auto mt-1.5 shrink-0 bg-background shadow-sm"
                    />
                  }
                />
              }
            >
              <PlusIcon />
              <span className="sr-only">New project</span>
            </TooltipTrigger>
            {!adding && (
              <TooltipContent side="right">New project</TooltipContent>
            )}
          </Tooltip>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => void createProject()}>
                New project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void addProject()}>
                Open folder…
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
