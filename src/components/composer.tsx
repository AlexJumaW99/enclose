import * as React from "react"
import { ArrowUpIcon, ChevronDownIcon, SquareIcon, XIcon } from "lucide-react"

import type { Access, PartRef } from "@shared/api"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { useActiveProject, useStore } from "@/lib/store"

const ACCESS: Record<Access, { label: string; detail: string }> = {
  ask: {
    label: "Ask first",
    detail: "Edits files freely, asks before running anything",
  },
  full: { label: "Full access", detail: "Never asks" },
}

function AccessMenu() {
  const access = useStore((state) => state.access)
  const setAccess = useStore((state) => state.setAccess)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<InputGroupButton />}>
        {ACCESS[access].label}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            What Claude may do without asking
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={access}
            onValueChange={(v) => setAccess(v as Access)}
          >
            {(Object.keys(ACCESS) as Access[]).map((key) => (
              <DropdownMenuRadioItem key={key} value={key}>
                <div className="flex flex-col gap-0.5">
                  <span>{ACCESS[key].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {ACCESS[key].detail}
                  </span>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Where a message to Claude is written: in the thread, or beside a part that was clicked. */
export function Composer({
  part,
  onClearPart,
  placeholder,
  autoFocus,
}: {
  /** the part this message is about, sent along with it */
  part: PartRef | null
  onClearPart?: () => void
  placeholder: string
  autoFocus?: boolean
}) {
  const project = useActiveProject()
  const send = useStore((state) => state.send)
  const [text, setText] = React.useState("")
  const busy = project ? project.thread.status !== "idle" : true

  const submit = () => {
    if (busy || !text.trim()) return
    send(text, part)
    setText("")
  }

  return (
    <InputGroup>
      <InputGroupTextarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={2}
        className="max-h-48 min-h-14"
      />
      <InputGroupAddon align="block-end">
        <AccessMenu />
        {part && onClearPart && (
          <Badge variant="secondary" className="max-w-40 gap-1">
            <span className="truncate">{part.label}</span>
            <button
              type="button"
              onClick={onClearPart}
              aria-label={`Leave out ${part.label}`}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        )}
        {busy && project ? (
          <InputGroupButton
            variant="secondary"
            size="icon-xs"
            className="ml-auto"
            onClick={() => void window.cad.thread.stop(project.id)}
          >
            <SquareIcon className="fill-current" />
            <span className="sr-only">Stop</span>
          </InputGroupButton>
        ) : (
          <InputGroupButton
            variant="default"
            size="icon-xs"
            className="ml-auto"
            disabled={!text.trim()}
            onClick={submit}
          >
            <ArrowUpIcon />
            <span className="sr-only">Send</span>
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}
