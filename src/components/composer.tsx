import * as React from "react"
import { cn } from "cn"
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  GaugeIcon,
  LockIcon,
  LockOpenIcon,
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
  useActiveProject,
  useStack,
  useStore,
  type Called,
  type Note,
} from "@/lib/store"
import { useNow } from "@/lib/time"
import { bridge } from "./viewport/bridge"

/** What the choices under a message go without, one after another, as room runs out. */
const GIVEN_UP = ["arrows", "access", "effort", "model"]

/**
 * The choices sit a little lower than the round button beside them, which is taller: as
 * far from the bottom of the box, near enough, as they are from its side.
 */
const LOW = "translate-y-1"

/**
 * One of the choices: small print, never squeezed. Its pictures are small to match, and
 * drawn with a heavier line for it, to be of a weight with the words; its arrow is a
 * little bigger than they are, being less of a shape.
 */
const CHOICE = `shrink-0 ${LOW} text-[11px] [&>svg]:size-3! [&>svg]:stroke-3 [&>svg[data-icon]]:size-3.5! [&>svg[data-icon]]:stroke-[2.5]`

/** The arrow of a choice that can do without one. */
const ARROW = "opacity-60 group-data-[short~=arrows]/bar:hidden"

/**
 * Has the choices under a message say as much as there is room for. They are tried in
 * full; while they do not fit, they give up one thing at a time: their arrows, then the
 * words for what Claude may do unasked, then those for how hard it thinks, and at last
 * some of the model's name. `said` is what they say, so that a change in it is fitted.
 */
function useFit(said: string) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    const row = ref.current
    if (!row) return
    const fit = () => {
      for (let count = 0; count <= GIVEN_UP.length; count++) {
        row.dataset.short = GIVEN_UP.slice(0, count).join(" ")
        if (row.scrollWidth <= row.clientWidth) return
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(row)
    // the words are no width to speak of until their letters have come
    void document.fonts.ready.then(fit)
    return () => observer.disconnect()
  }, [said])
  return ref
}

// what each choice is a choice of: over its list, and on it when it is down to a picture
const EFFORT_TITLE = "How hard Claude thinks"
const ACCESS_TITLE = "What Claude may do without asking"

/** A thin line between two of the choices under the message. */
function Divider() {
  return <span aria-hidden className={`h-3.5 w-px shrink-0 bg-border ${LOW}`} />
}

/** The model that will answer, by whose it is and its name. It opens onto the others. */
function ModelMenu() {
  const models = useStore((state) => state.models)
  const picked = useStore((state) => state.model)
  const setModel = useStore((state) => state.setModel)
  const [open, setOpen] = React.useState(false)
  const chosen = chosenModel(models, picked)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Claude Code may not have said when the app started: it is asked again
        if (next) void askModels()
      }}
    >
      <PopoverTrigger
        render={
          <InputGroupButton
            className={cn(
              CHOICE,
              "min-w-0 group-data-[short~=model]/bar:shrink"
            )}
          />
        }
      >
        <ClaudeIcon className="shrink-0" />
        <span className="truncate">{chosen?.short ?? "Claude"}</span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 gap-0 p-1">
        {/* whose models: one maker for now, so one tab */}
        <Tabs defaultValue="claude" className="gap-1">
          <TabsList variant="line" className="h-8! justify-start px-1">
            <TabsTrigger value="claude" title="Claude" className="flex-none">
              <ClaudeIcon />
              <span className="sr-only">Claude</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="claude"
            className="flex max-h-80 flex-col overflow-y-auto border-t pt-1"
          >
            {models.length === 0 && (
              <p className="px-2.5 py-2 text-muted-foreground">
                Claude Code has not said what models it has.
              </p>
            )}
            {models.map((model) => (
              <button
                key={model.id ?? ""}
                type="button"
                aria-pressed={model === chosen}
                onClick={() => {
                  setModel(model.id)
                  setOpen(false)
                }}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent aria-pressed:bg-accent"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {model.detail}
                  </span>
                </span>
                {model === chosen && <CheckIcon className="size-4 shrink-0" />}
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

/** How hard the model thinks, for a model that can be told. */
function EffortMenu() {
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
    <>
      <Divider />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<InputGroupButton className={CHOICE} title={EFFORT_TITLE} />}
        >
          <GaugeIcon />
          <span className="group-data-[short~=effort]/bar:sr-only">
            {effort ? EFFORT_WORDS[effort] : "Default"}
          </span>
          <ChevronDownIcon data-icon="inline-end" className={ARROW} />
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
              <DropdownMenuRadioItem value="">
                <div className="flex flex-col gap-0.5">
                  <span>Default</span>
                  <span className="text-xs text-muted-foreground">
                    As Claude Code is set
                  </span>
                </div>
              </DropdownMenuRadioItem>
              {model.efforts.map((level) => (
                <DropdownMenuRadioItem key={level} value={level}>
                  {EFFORT_WORDS[level]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

const ACCESS_ICON: Record<Access, LucideIcon> = {
  supervised: LockIcon,
  edits: PencilIcon,
  auto: SparklesIcon,
  full: LockOpenIcon,
}

/** What Claude may do without asking. */
function AccessMenu() {
  const access = useStore((state) => state.access)
  const setAccess = useStore((state) => state.setAccess)
  const Icon = ACCESS_ICON[access]
  return (
    <>
      <Divider />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<InputGroupButton className={CHOICE} title={ACCESS_TITLE} />}
        >
          <Icon />
          <span className="group-data-[short~=access]/bar:sr-only">
            {ACCESS_WORDS[access].label}
          </span>
          <ChevronDownIcon data-icon="inline-end" className={ARROW} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{ACCESS_TITLE}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={access}
              onValueChange={(value) => setAccess(value as Access)}
            >
              {(Object.keys(ACCESS_WORDS) as Access[]).map((key) => {
                const ItemIcon = ACCESS_ICON[key]
                return (
                  <DropdownMenuRadioItem key={key} value={key}>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <ItemIcon className="text-muted-foreground" />
                        {ACCESS_WORDS[key].label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ACCESS_WORDS[key].detail}
                      </span>
                    </div>
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

/** The cross on a chip, which takes it back off the message. */
const OFF =
  "shrink-0 cursor-pointer rounded-full p-0.5 text-muted-foreground outline-none hover:text-foreground"

/**
 * What is waiting to go with the next message: the parts called on from the view, and
 * what has been said of parts. A chip for each, in one row that scrolls sideways when
 * there are more than fit, so that however many there are the box is no taller for
 * them. A part called on is a chip of its name. What was said of a part is a chip that
 * says which part and how it begins; pressed, it opens that again beside the part.
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
            title={`@${part.id}`}
            className="h-6 max-w-44 shrink-0 gap-1 pr-1"
          >
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
              <span className="shrink-0">{note.part.label}</span>
              <span className="truncate font-normal text-muted-foreground">
                {note.text}
              </span>
            </button>
            <button
              type="button"
              onClick={() => dropNote(note.id)}
              aria-label={`Take back what was said of ${note.part.label}`}
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
  const choices = useFit(
    useStore((state) =>
      [state.models.length, state.model, state.effort, state.access].join()
    )
  )
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
      {/* by which model, thinking how hard, asking how much: each says what it is set
          to, in fewer words where there is less room */}
      <InputGroupAddon
        ref={choices}
        align="block-end"
        // the choices have room of their own around their words, which the round button
        // has not: it is kept as far from the side as it is from the bottom
        className="group/bar gap-1 pr-3 pl-1.5"
      >
        <ModelMenu />
        <EffortMenu />
        <AccessMenu />
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
