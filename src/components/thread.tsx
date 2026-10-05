import * as React from "react"
import {
  BoxIcon,
  CheckIcon,
  PanelRightCloseIcon,
  SquarePenIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import type { Project, ThreadItem } from "@shared/api"
import { Composer } from "@/components/composer"
import { Markdown } from "@/components/markdown"
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
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useStore } from "@/lib/store"

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

/** One thing Claude did: read a file, ran a command, looked at the viewport. */
function ToolRow({ item }: { item: Of<"tool"> }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        {item.state === "running" && <Spinner className="size-3" />}
        {item.state === "done" && <CheckIcon className="size-3" />}
        {item.state === "failed" && (
          <XIcon className="size-3 text-destructive" />
        )}
      </span>
      <span className="shrink-0 font-medium text-foreground/80">
        {item.name}
      </span>
      <span className="truncate font-mono" title={item.detail}>
        {item.detail}
      </span>
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

function Item({ item, project }: { item: ThreadItem; project: Project }) {
  switch (item.kind) {
    case "user":
      return <UserMessage item={item} />
    case "assistant":
      return <Markdown>{item.text}</Markdown>
    case "tool":
      return <ToolRow item={item} />
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

/** The conversation with Claude about the open project. */
export function Thread({ project }: { project: Project }) {
  const items = useStore((state) => state.items[project.id])
  const claude = useStore((state) => state.claude)
  const selection = useStore((state) => state.selection)
  const select = useStore((state) => state.select)
  const setThreadOpen = useStore((state) => state.setThreadOpen)
  const end = React.useRef<HTMLDivElement>(null)

  // follow the conversation as it grows
  const last = items?.at(-1)
  const tail = last && "text" in last ? last.text.length : 0
  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [items?.length, tail])

  const working = project.thread.status === "working"
  const quiet =
    working &&
    last?.kind !== "assistant" &&
    !(last?.kind === "tool" && last.state === "running")

  return (
    <aside className="flex w-100 shrink-0 flex-col border-l bg-background">
      <header className="drag flex h-12 shrink-0 items-center justify-between gap-2 pr-2 pl-4">
        <h2 className="truncate text-sm font-medium">{project.name}</h2>
        <div className="no-drag flex items-center">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!items?.length}
                  onClick={() => void window.cad.thread.reset(project.id)}
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
            {items.map((item) => (
              <Item key={item.id} item={item} project={project} />
            ))}
            {quiet && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                Working
              </div>
            )}
            <div ref={end} />
          </div>
        </ScrollArea>
      ) : (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Ask Claude about this model</EmptyTitle>
            <EmptyDescription>
              Describe a change, or click a part in the view and say what it
              should become. Claude edits the project and rebuilds; the view
              updates by itself.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <div className="flex flex-col gap-2 p-3 pt-0">
        <Composer
          part={selection?.part ?? null}
          onClearPart={() => select(null)}
          placeholder="Message Claude"
        />
        <p className="px-1 text-xs text-muted-foreground">
          {!claude
            ? "Looking for Claude Code…"
            : claude.path
              ? `Using your Claude Code${claude.version ? ` ${claude.version}` : ""} and its login`
              : "Claude Code was not found on this machine. Install it and sign in there."}
        </p>
      </div>
    </aside>
  )
}
