import * as React from "react"
import { cn } from "cn"
import { BookOpenIcon, BoxIcon, SlashIcon, type LucideIcon } from "lucide-react"

import type { Calling } from "@/lib/mentions"

/** One thing a name being written could be: what goes into the message, and what is shown. */
export type Choice = {
  /** what is written after the mark: a part's id, a skill's or a command's name */
  name: string
  /** what else it is found by, and shown as instead: a part's label */
  also?: string
  detail: string
}

const WHAT: Record<Calling, { title: string; none: string; icon: LucideIcon }> =
  {
    part: {
      title: "Parts",
      none: "The model has no parts yet.",
      icon: BoxIcon,
    },
    skill: {
      title: "Skills",
      none: "Claude Code has no skills installed.",
      icon: BookOpenIcon,
    },
    command: {
      title: "Commands",
      none: "Claude Code has no commands to offer.",
      icon: SlashIcon,
    },
  }

/**
 * What a name being written in the message could be, as a list over the message box.
 * The keys stay with the writing: the box moves through the list and chooses from it,
 * and a press here chooses without taking the caret out of the box.
 */
export function MentionMenu({
  kind,
  choices,
  any,
  asking,
  active,
  onActive,
  onPick,
}: {
  kind: Calling
  /** the ones that what has been written could be */
  choices: Choice[]
  /** there are some of this kind at all, whatever has been written */
  any: boolean
  /** Claude Code is still being asked what there is */
  asking: boolean
  active: number
  onActive: (index: number) => void
  onPick: (choice: Choice) => void
}) {
  const { title, none, icon: Icon } = WHAT[kind]
  const list = React.useRef<HTMLDivElement>(null)
  // the one the keys are on is kept in sight
  React.useEffect(() => {
    list.current
      ?.querySelector("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest" })
  }, [active, choices])

  return (
    <div
      role="listbox"
      aria-label={title}
      className="absolute inset-x-0 bottom-full z-20 mb-2 flex max-h-72 flex-col rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/10"
      // a press here is not to take the caret out of the message
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="px-3 pt-1.5 pb-1 text-xs text-muted-foreground">
        {title}
      </div>
      {choices.length === 0 ? (
        <div className="px-3 pt-1 pb-2 text-sm text-muted-foreground">
          {asking ? (
            <span className="shimmer shimmer-color-foreground">
              Asking Claude Code what it has
            </span>
          ) : any ? (
            "Nothing by that name."
          ) : (
            none
          )}
        </div>
      ) : (
        <div ref={list} className="min-h-0 overflow-y-auto">
          {choices.map((choice, index) => (
            <div
              key={choice.name}
              role="option"
              aria-selected={index === active}
              onMouseMove={() => index !== active && onActive(index)}
              onClick={() => onPick(choice)}
              className={cn(
                "flex cursor-default items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm",
                index === active && "bg-accent text-accent-foreground"
              )}
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="max-w-[60%] shrink-0 truncate">
                {choice.also ?? choice.name}
              </span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {choice.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
