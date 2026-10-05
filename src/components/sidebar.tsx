import { cn } from "cn"
import { PlusIcon } from "lucide-react"

import type { Project } from "@shared/api"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useStore } from "@/lib/store"
import { ago, useNow } from "@/lib/time"

/** Top right of a card: how long Claude has been at it, or when the thread last moved. */
function Status({ project, now }: { project: Project; now: number }) {
  const { status, since, updatedAt } = project.thread
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
  if (!updatedAt) return null
  return (
    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
      {ago(updatedAt, now)}
    </span>
  )
}

function ProjectCard({ project, now }: { project: Project; now: number }) {
  const active = useStore((state) => state.activeId === project.id)
  const activate = useStore((state) => state.activate)
  const removeProject = useStore((state) => state.removeProject)

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            aria-current={active}
            onClick={() => activate(project.id)}
            className={cn(
              "glass pointer-events-auto flex w-full shrink-0 flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "bg-sidebar-accent/90 shadow-sm ring-foreground/15"
                : "bg-sidebar-accent/45 ring-foreground/5 hover:bg-sidebar-accent/65"
            )}
          />
        }
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{project.name}</span>
          <Status project={project} now={now} />
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {project.thread.lastMessage ?? "No messages yet"}
        </span>
        <span className="mt-2 truncate text-xs text-muted-foreground/70">
          {project.branch ?? "not a git repository"}
        </span>
      </ContextMenuTrigger>
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
          <ContextMenuItem
            variant="destructive"
            onClick={() => void removeProject(project.id)}
          >
            Remove from list
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * The projects: one card per folder, with what its conversation is up to. The cards float
 * over the 3D view rather than taking a column from it, so the model is never cut off at
 * an edge; everything between and below them still belongs to the view.
 */
export function Sidebar() {
  const projects = useStore((state) => state.projects)
  const addProject = useStore((state) => state.addProject)
  const now = useNow()

  return (
    <aside className="pointer-events-none absolute inset-y-0 left-0 flex w-58 flex-col">
      {/* room for the window's traffic lights, and something to drag it by */}
      <div className="drag pointer-events-auto h-12 shrink-0" />
      <div className="flex min-h-0 [scrollbar-width:none] flex-col items-start gap-1.5 overflow-y-auto px-4.5 pb-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} now={now} />
        ))}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="pointer-events-auto mt-1.5 shrink-0 bg-background shadow-sm"
                onClick={() => void addProject()}
              />
            }
          >
            <PlusIcon />
            <span className="sr-only">Add a project folder</span>
          </TooltipTrigger>
          <TooltipContent side="right">Add a project folder</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
