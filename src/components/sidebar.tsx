import * as React from "react"
import { cn } from "cn"
import { PlusIcon, XIcon } from "lucide-react"

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
  "glass pointer-events-auto flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
/** The card of what is open, and the others. */
const LIT = "bg-sidebar-accent/90 shadow-sm ring-foreground/15"
const UNLIT =
  "bg-sidebar-accent/45 ring-foreground/5 hover:bg-sidebar-accent/65"

/** Top right of a card: how long Claude has been at it, or when it was last carried on. */
function Status({
  conversation,
  now,
}: {
  conversation: ConversationSummary
  now: number
}) {
  const { status, since, updatedAt } = conversation
  if (status === "asking") {
    return <span className="shrink-0 text-xs text-attention">Needs you</span>
  }
  if (status === "working") {
    const elapsed = since ? ago(since, now) : "now"
    return (
      <span className="shrink-0 text-xs text-attention tabular-nums">
        Working{elapsed === "now" ? "" : ` ${elapsed}`}
      </span>
    )
  }
  return (
    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
      {ago(updatedAt, now)}
    </span>
  )
}

/**
 * The bottom edge of a card with earlier conversations under it, and the sliver of the
 * next of them that shows below. This is what is pressed to spread them out; the rest
 * of the card opens what is on it.
 */
function Under({ count, onSpread }: { count: number; onSpread: () => void }) {
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
            className="group/under pointer-events-auto absolute inset-x-0 -bottom-2.5 z-10 h-4 cursor-pointer outline-none"
          />
        }
      >
        {/* the card beneath, as much of it as shows: it comes out a little to be pressed */}
        <span className="glass absolute inset-x-2.5 top-1.5 h-1.5 rounded-b-lg border-x border-b border-foreground/5 bg-sidebar-accent/45 transition-[height] group-hover/under:h-2.5 group-focus-visible/under:h-2.5" />
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
  // what Claude is at work on is said on the card, wherever in the stack it is
  const shown = project.conversations.find((c) => c.status !== "idle") ?? cover
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
          under.length > 0 && !spread && "mb-1.5"
        )}
      >
        <ProjectMenu project={project}>
          <button
            type="button"
            aria-current={active}
            onClick={() => openConversation(project.id, cover?.id ?? null)}
            className={cn(CARD, lit ? LIT : UNLIT)}
          />
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{project.name}</span>
            {/* makes way for the close button while the pointer is on the card */}
            {shown && (
              <span className="transition-opacity group-focus-within/card:opacity-0 group-hover/card:opacity-0">
                <Status conversation={shown} now={now} />
              </span>
            )}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {cover
              ? cover.lastMessage
              : under.length > 0
                ? "Start a new session"
                : "No messages yet"}
          </span>
          {/* the branch, for a folder that is kept in git */}
          {project.branch && (
            <span className="mt-2 truncate text-xs text-muted-foreground/70">
              {project.branch}
            </span>
          )}
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
          <Under count={under.length} onSpread={() => setSpread(true)} />
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
                  <XIcon />
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
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {conversation.title}
                </span>
                <Status conversation={conversation} now={now} />
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {conversation.lastMessage}
              </span>
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
      <div className="flex min-h-0 [scrollbar-width:none] flex-col items-start gap-1.5 overflow-y-auto px-4.5 pb-4">
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
