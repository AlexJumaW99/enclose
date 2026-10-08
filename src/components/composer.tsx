import * as React from "react"
import { cn } from "cn"
import {
  ArrowUpIcon,
  BoxesIcon,
  ChevronDownIcon,
  CircleGaugeIcon,
  LockKeyholeIcon,
  LockKeyholeOpenIcon,
  PencilIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import type { Access, Effort } from "@shared/api"
import { ClaudeIcon } from "@/components/icons"
import { MentionMenu, type Choice } from "@/components/mention-menu"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ACCESS_WORDS,
  chosenEffort,
  chosenModel,
  EFFORT_WORDS,
} from "@/lib/manner"
import { matching, putIn, tokenAt } from "@/lib/mentions"
import {
  askCommands,
  askModels,
  goesBy,
  useActiveProject,
  useStack,
  useStore,
  type Called,
  type Note,
} from "@/lib/store"
import { useNow } from "@/lib/time"
import { bridge } from "./viewport/bridge"

/**
 * The line under a message sits a little lower than the round button beside it, which is
 * taller: as far from the bottom of the box, near enough, as it is from its side.
 */
const LOW = "translate-y-1"

/** How far in from the side of the box the line begins: its edge, and the room by it. */
const BAR_INSET = 7

/** How far the box is from the side of the window. */
const BOX_INSET = 14

// what each choice is a choice of: over its list
const MODEL_TITLE = "Which model answers"
const EFFORT_TITLE = "How hard Claude thinks"
const ACCESS_TITLE = "What Claude may do without asking"

/**
 * One of the three choices, where they are made: what it is set to, and an arrow to the
 * others. The three sit side by side as one box, a line between each two.
 */
const CHOICE =
  "flex h-14.5 flex-auto cursor-pointer items-center gap-2.5 border-l pr-4.5 pl-5 text-sm font-semibold whitespace-nowrap outline-none transition-colors first-of-type:border-l-0 hover:bg-foreground/5 focus-visible:bg-foreground/5 data-popup-open:bg-foreground/5 [&>svg]:size-3.5 [&>svg]:shrink-0"

/** The arrow of a choice: bigger than its picture and drawn lighter, being less of a shape. */
function Arrow() {
  return (
    <ChevronDownIcon className="size-5.5! stroke-[1.5] text-muted-foreground" />
  )
}

/**
 * What one of a list's choices says: what it is called and, under that, what it comes
 * to. Both in the same letters, the name in the heavier of them.
 */
function Words({ name, detail }: { name: string; detail?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="font-medium">{name}</span>
      {detail && <span className="text-muted-foreground">{detail}</span>}
    </div>
  )
}

/** Which model answers. */
function ModelChoice() {
  const models = useStore((state) => state.models)
  const picked = useStore((state) => state.model)
  const setModel = useStore((state) => state.setModel)
  const chosen = chosenModel(models, picked)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={CHOICE} title={MODEL_TITLE}>
        {chosen?.short ?? "Claude"}
        <Arrow />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        // there are many of them: the list is no taller than it was, and scrolls. It is
        // as wide as the longest thing said in it, short of a width to read across
        className="max-h-[min(22rem,var(--available-height))] w-max max-w-[min(26rem,var(--available-width))]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{MODEL_TITLE}</DropdownMenuLabel>
          {models.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Claude Code has not said what models it has.
            </p>
          )}
          <DropdownMenuRadioGroup
            value={chosen?.id ?? ""}
            onValueChange={(value) => setModel(value === "" ? null : value)}
          >
            {models.map((model) => (
              <DropdownMenuRadioItem
                key={model.id ?? ""}
                value={model.id ?? ""}
                closeOnClick
              >
                <Words name={model.name} detail={model.detail} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** How hard the model thinks, for a model that can be told. */
function EffortChoice() {
  const models = useStore((state) => state.models)
  const model = chosenModel(
    models,
    useStore((state) => state.model)
  )
  const picked = useStore((state) => state.effort)
  const setEffort = useStore((state) => state.setEffort)
  if (!model || model.efforts.length === 0) return null
  const effort = chosenEffort(model, picked)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={CHOICE} title={EFFORT_TITLE}>
        <CircleGaugeIcon />
        {effort ? EFFORT_WORDS[effort] : "Default"}
        <Arrow />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{EFFORT_TITLE}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={effort ?? ""}
            onValueChange={(value) =>
              setEffort(value === "" ? null : (value as Effort))
            }
          >
            <DropdownMenuRadioItem value="" closeOnClick>
              <Words name="Default" detail="As Claude Code is set" />
            </DropdownMenuRadioItem>
            {model.efforts.map((level) => (
              <DropdownMenuRadioItem key={level} value={level} closeOnClick>
                <Words name={EFFORT_WORDS[level]} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ACCESS_ICON: Record<Access, LucideIcon> = {
  supervised: LockKeyholeIcon,
  edits: PencilIcon,
  auto: SparklesIcon,
  full: LockKeyholeOpenIcon,
}

/** What Claude may do without asking. */
function AccessChoice() {
  const access = useStore((state) => state.access)
  const setAccess = useStore((state) => state.setAccess)
  const Icon = ACCESS_ICON[access]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={CHOICE} title={ACCESS_TITLE}>
        <Icon />
        {ACCESS_WORDS[access].label}
        <Arrow />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        // as wide as the longest thing said in it
        className="w-max max-w-(--available-width)"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{ACCESS_TITLE}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={access}
            onValueChange={(value) => setAccess(value as Access)}
          >
            {(Object.keys(ACCESS_WORDS) as Access[]).map((key) => {
              const ItemIcon = ACCESS_ICON[key]
              return (
                <DropdownMenuRadioItem key={key} value={key} closeOnClick>
                  {/* its picture stands left of all that is said of it, half way
                      down the two lines, and is drawn with a line a pixel wide */}
                  <ItemIcon size={16} absoluteStrokeWidth strokeWidth={1} />
                  <Words
                    name={ACCESS_WORDS[key].label}
                    detail={ACCESS_WORDS[key].detail}
                  />
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * How the next message will be answered, said in one line under it: by which model,
 * thinking how hard, asking how much. The line is a button: it opens onto the three
 * choices, under the makers whose models there are to choose from.
 */
function Manner() {
  const models = useStore((state) => state.models)
  const model = chosenModel(
    models,
    useStore((state) => state.model)
  )
  const effort = chosenEffort(
    model,
    useStore((state) => state.effort)
  )
  const access = useStore((state) => state.access)
  const said = [
    model?.short ?? "Claude",
    // a model that cannot be told how hard to think has nothing to say of it
    ...(model && model.efforts.length > 0
      ? [effort ? EFFORT_WORDS[effort] : "Default effort"]
      : []),
    ACCESS_WORDS[access].label,
  ].join(", ")
  return (
    <Popover
      onOpenChange={(open) => {
        // Claude Code may not have said when the app started: it is asked again
        if (open) void askModels()
      }}
    >
      <PopoverTrigger
        render={
          <InputGroupButton
            // what it opens is in plain sight over it: it is drawn no differently for
            // being open
            className={`min-w-0 shrink gap-1.5 text-xs font-normal ${LOW} aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted/50 aria-expanded:hover:text-foreground [&>svg]:size-3!`}
          />
        }
      >
        <ClaudeIcon className="shrink-0" />
        <span className="truncate">Using {said}</span>
      </PopoverTrigger>
      {/* its side is the side of the box the message is written in: the left one where
          there is room for that, and the right one where the box is the narrower */}
      <PopoverContent
        align="start"
        alignOffset={-BAR_INSET}
        side="top"
        sideOffset={12}
        collisionAvoidance={{ side: "flip", align: "shift" }}
        collisionPadding={BOX_INSET}
        className="w-auto gap-0 p-1.5 ring-foreground/8"
      >
        {/* whose models: one maker for now, so one tab */}
        <Tabs defaultValue="claude" className="gap-1.75">
          <TabsList
            variant="line"
            className="h-11.5! w-full justify-start gap-0 border-b p-0"
          >
            <TabsTrigger
              value="claude"
              title="Claude"
              className="h-full w-11.5 flex-none p-0 after:-bottom-px! after:h-px!"
            >
              <ClaudeIcon className="size-6" />
              <span className="sr-only">Claude</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="claude"
            className="flex overflow-hidden rounded-[0.75rem] border bg-foreground/6"
          >
            <ModelChoice />
            <EffortChoice />
            <AccessChoice />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

/** The cross on a chip, which takes it back off the message. */
const OFF =
  "shrink-0 cursor-pointer rounded-full p-0.5 text-muted-foreground outline-none hover:text-foreground"

/**
 * What is waiting to go with the next message: the parts called on from the view, and
 * what has been said of parts. A chip for each, in one row that scrolls sideways when
 * there are more than fit, so that however many there are the box is no taller for
 * them. A part called on is a chip of its name, and so is a whole object, which is one
 * chip however many parts it is made of. What was said of a part is a chip that says
 * which part and how it begins; pressed, it opens that again beside the part.
 */
function Waiting({ called, notes }: { called: Called[]; notes: Note[] }) {
  const write = useStore((state) => state.write)
  const dropNote = useStore((state) => state.dropNote)
  const dropCalled = useStore((state) => state.dropCalled)
  const writing = useStore((state) => state.writing)
  return (
    <InputGroupAddon align="block-start" className="pb-0">
      <div className="flex min-w-0 [scrollbar-width:none] gap-1.5 overflow-x-auto">
        {called.map((part) => (
          <Badge
            key={part.id}
            data-called={part.id}
            variant="secondary"
            title={
              part.parts
                ? `The whole of it: ${part.parts.length} parts`
                : `@${part.id}`
            }
            className="h-6 max-w-44 shrink-0 gap-1 pr-1"
          >
            {/* a whole object has the sign the list of parts has */}
            {part.parts && <BoxesIcon className="shrink-0" />}
            <span className="truncate">{part.label}</span>
            <button
              type="button"
              onClick={() => dropCalled(part.id)}
              aria-label={`Leave ${part.label} out of the message`}
              className={OFF}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        {notes.map((note) => (
          <Badge
            key={note.id}
            data-note={note.id}
            variant="secondary"
            className={cn(
              "h-6 max-w-52 shrink-0 gap-1 pr-1",
              writing === note.id && "ring-1 ring-foreground/30"
            )}
          >
            <button
              type="button"
              title="Change what was said"
              onClick={() => write(note.id)}
              className="flex min-w-0 cursor-pointer items-center gap-1.5 outline-none"
            >
              <span className="shrink-0">{goesBy(note.part)}</span>
              <span className="truncate font-normal text-muted-foreground">
                {note.text}
              </span>
            </button>
            <button
              type="button"
              onClick={() => dropNote(note.id)}
              aria-label={`Take back what was said of ${goesBy(note.part)}`}
              className={OFF}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </InputGroupAddon>
  )
}

/** Stable when a project has nothing said of its parts, and none of them called on. */
const NO_NOTES: Note[] = []
const NO_CALLED: Called[] = []
const NO_CHOICES: Choice[] = []

/** How many times the message box has taken the typing for being asked to. */
let answered = 0

/** The parts of the model on screen, as what @ can name: each by its id, shown by its label. */
function partChoices(): Choice[] {
  const parts = (bridge.parts?.() ?? []) as { id: string; label: string }[]
  return parts.map((part) => ({
    name: part.id,
    also: part.label,
    detail: `@${part.id}`,
  }))
}

/** Where a message to Claude is written, with what has been said of parts to go with it. */
export function Composer({
  placeholder,
  autoFocus,
}: {
  placeholder: string
  autoFocus?: boolean
}) {
  const project = useActiveProject()
  const { open } = useStack(project, useNow(60_000))
  const send = useStore((state) => state.send)
  const text = useStore((state) =>
    project ? (state.drafts[project.id] ?? "") : ""
  )
  const setText = useStore((state) => state.setDraft)
  const notes = useStore((state) =>
    project ? (state.notes[project.id] ?? NO_NOTES) : NO_NOTES
  )
  const called = useStore((state) =>
    project ? (state.called[project.id] ?? NO_CALLED) : NO_CALLED
  )
  // a line high until it is being written in: then it has room for what is written
  const [within, setWithin] = React.useState(false)
  const roomy = within || text !== ""

  // A name being written - a part's after @, a skill's after $, a command's after / -
  // brings up what it could be, over the box. Esc puts the list away for that name.
  const box = React.useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = React.useState(0)
  const [shut, setShut] = React.useState<string | null>(null)
  const token = within ? tokenAt(text, caret) : null
  const naming = token ? `${token.kind}:${token.from}` : null
  // a name that was put away is done with once the caret has left it, or it is gone
  if (shut !== null && shut !== naming) setShut(null)
  const calling = token !== null && naming !== shut ? token : null
  const kind = calling?.kind ?? null
  const projectId = project?.id ?? null
  const has = useStore((state) =>
    projectId ? state.commands[projectId] : undefined
  )
  // what Claude Code has is asked for when the box opens on a project, and again when
  // one of its names is begun, should it have changed since
  const ofClaude = kind === "skill" || kind === "command"
  React.useEffect(() => {
    if (projectId) void askCommands(projectId)
  }, [projectId, ofClaude])
  // the parts are what is on screen when the name is begun
  const parts = React.useMemo(
    () => (kind === "part" ? partChoices() : NO_CHOICES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, naming, project?.revision]
  )
  const all: Choice[] =
    kind === "part"
      ? parts
      : kind === "skill"
        ? (has?.skills ?? NO_CHOICES)
        : kind === "command"
          ? (has?.commands ?? NO_CHOICES)
          : NO_CHOICES
  const query = calling?.query ?? ""
  const offered = React.useMemo(() => matching(all, query), [all, query])
  // the keys start at the top of the list each time what is written changes
  const [chosen, setChosen] = React.useState({ of: "", index: 0 })
  const written = `${naming}:${query}`
  const active =
    chosen.of === written ? Math.min(chosen.index, offered.length - 1) : 0
  const move = (index: number) => setChosen({ of: written, index })

  // the caret goes after a name that was put in, once the box holds it
  const caretTo = React.useRef<number | null>(null)
  React.useLayoutEffect(() => {
    if (caretTo.current === null) return
    box.current?.setSelectionRange(caretTo.current, caretTo.current)
    caretTo.current = null
  }, [text])
  const pick = (choice: Choice) => {
    if (!calling) return
    const put = putIn(text, calling, choice.name)
    caretTo.current = put.caret
    setText(put.text)
    setCaret(put.caret)
  }
  const follow = (at: HTMLTextAreaElement) => setCaret(at.selectionStart)

  // Parts called on from the view go on the box as chips, for the user to say what of
  // them: the box takes the typing. It may only now be on show, having been asked before.
  const asked = useStore((state) => state.writeRequests)
  React.useEffect(() => {
    const at = box.current
    if (asked === answered || !at) return
    answered = asked
    at.focus()
    at.setSelectionRange(at.value.length, at.value.length)
    setCaret(at.value.length)
  }, [asked])

  // The part the keys are on lights up in the view, as it does under the pointer; and
  // for as long as a part is being named, the view shows it through all the others.
  const hover = useStore((state) => state.hover)
  const seek = useStore((state) => state.seek)
  const seeking = kind === "part"
  const lit = seeking ? (offered[active]?.name ?? null) : null
  React.useEffect(() => {
    if (!seeking) return
    seek(true)
    return () => seek(false)
  }, [seeking, seek])
  React.useEffect(() => {
    if (lit === null) return
    hover(lit)
    return () => hover(null)
  }, [lit, hover])
  // one thing at a time is done in a project's folder: Claude is at work in the
  // conversation this writes to, which can be stopped, or in another of the project's
  const running = project?.conversations.find((c) => c.status !== "idle")
  const busy = !project || (running !== undefined && running.id === open?.id)
  const elsewhere = running !== undefined && !busy

  const something = text.trim() !== "" || notes.length > 0 || called.length > 0
  const submit = () => {
    if (!busy && !elsewhere && something) send()
  }

  return (
    // being written in does not change how the box is drawn: the caret says where the
    // typing goes
    <InputGroup
      className="has-[[data-slot=input-group-control]:focus-visible]:border-input has-[[data-slot=input-group-control]:focus-visible]:ring-0"
      onFocus={() => setWithin(true)}
      onBlur={(event) => {
        // one of its own choices being made, in the list that opens for it, is not leaving
        const next = event.relatedTarget as Element | null
        const stays =
          next !== null &&
          (event.currentTarget.contains(next) ||
            next.closest("[role=menu], [role=dialog]") !== null)
        if (!stays) setWithin(false)
      }}
    >
      {calling && (
        <MentionMenu
          kind={calling.kind}
          choices={offered}
          any={all.length > 0}
          asking={ofClaude && has === undefined}
          active={active}
          onActive={move}
          onPick={pick}
        />
      )}
      {(called.length > 0 || notes.length > 0) && (
        <Waiting called={called} notes={notes} />
      )}
      <InputGroupTextarea
        value={text}
        ref={box}
        onChange={(event) => {
          setText(event.target.value)
          follow(event.target)
        }}
        onSelect={(event) => follow(event.currentTarget)}
        onKeyDown={(event) => {
          if (calling && !event.nativeEvent.isComposing) {
            if (event.key === "Escape") {
              event.preventDefault()
              setShut(naming)
              return
            }
            const step =
              event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
            if (step !== 0 && offered.length > 0) {
              event.preventDefault()
              move((active + step + offered.length) % offered.length)
              return
            }
            const takes =
              (event.key === "Enter" && !event.shiftKey) || event.key === "Tab"
            if (takes && offered.length > 0) {
              event.preventDefault()
              pick(offered[active])
              return
            }
          }
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
        rows={1}
        // a little more room over the words than the box gives, to match what is under
        // the words of the choices below
        className={cn(
          "pt-3 transition-[min-height] duration-150",
          // with nothing written and nobody writing, the one line is all there is of
          // it, however long what it suggests is
          roomy
            ? "max-h-48 min-h-14"
            : "max-h-10 min-h-10 overflow-hidden whitespace-nowrap placeholder:text-ellipsis"
        )}
      />
      {/* by which model, thinking how hard, asking how much: one line that says so */}
      <InputGroupAddon
        align="block-end"
        // the line has room of its own around its words, which the round button has
        // not: that is kept as far from the side as it is from the bottom
        className="gap-1 pr-3 pl-1.5"
      >
        <Manner />
        {busy && project ? (
          <InputGroupButton
            variant="secondary"
            size="icon-xs"
            className="ml-auto shrink-0"
            onClick={() => void window.cad.thread.stop(project.id)}
          >
            <SquareIcon className="fill-current" />
            <span className="sr-only">Stop</span>
          </InputGroupButton>
        ) : (
          <InputGroupButton
            variant="default"
            size="icon-xs"
            className="ml-auto shrink-0"
            disabled={!something || elsewhere}
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
