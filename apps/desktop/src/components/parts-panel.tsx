import * as React from "react"
import { cn } from "cn"
import { DownloadIcon, EyeOffIcon, SquareDashedIcon } from "lucide-react"

import { LOOSE } from "@/lib/arrange"
import { partFile, sizeOf, type Download } from "@/lib/model"
import { NO_SWEEP, sweptTo, toggled, toggledAll } from "@/lib/several"
import { savedAs } from "@/lib/saved"
import { useStore, type Only } from "@/lib/store"
import type { LoadedModel } from "./viewport/load"

/** What the list can pick out: one thing, by its id. */
type Listed = Extract<Only, { id: string }>

const same = (a: Only | null, b: Listed) =>
  a !== null && "id" in a && a.kind === b.kind && a.id === b.id
/** Stable when it is not several parts that are shown on their own. */
const NONE: string[] = []

/** What a group stands in, and what is listed with the groups without being one. */
const CARD = "shrink-0 rounded-2xl border bg-foreground/3"
/** A card whose group, or keep-outs, are what the view shows: its line is the lighter. */
const PICKED = "border-foreground/60"
const FOCUS = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** On a part that is out of sight, or a group that all is: why it is dim in the list. */
const HIDDEN = "size-3.5 shrink-0 text-muted-foreground"

/**
 * The button that saves a file: an arrow into a tray, drawn lightly. It has more room to
 * be pressed in than the arrow takes up, and is set by where the arrow is to stand.
 */
function Save({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-foreground/10",
        FOCUS,
        className
      )}
    >
      <DownloadIcon size={16} absoluteStrokeWidth strokeWidth={1.25} />
    </button>
  )
}

/** What a group goes by, in letters and in room: as it is read, and as it is written over. */
const TITLE = "-ml-1.5 h-7 min-w-0 rounded-md px-1.5 text-base font-medium"

/**
 * What a group goes by, at the top of its card. Clicked, it is written over, as what a
 * conversation goes by is: Enter, or clicking away, keeps what is written, and Esc
 * leaves it as it was. Left empty, the group goes back to what it went by before it
 * was called anything by hand. While Claude is thinking of what to call a group that
 * was just made, what it goes by meanwhile is drawn as something still to come.
 */
function Title({
  label,
  dim,
  awaited,
  onRename,
}: {
  label: string
  /** all of the group is out of sight */
  dim: boolean
  /** it is being given a name, and this is not it */
  awaited: boolean
  /** null for what is listed as a group without being one to name */
  onRename: ((label: string) => void) | null
}) {
  const [written, setWritten] = React.useState<string | null>(null)
  const left = React.useRef(false)
  if (!onRename)
    return (
      <h3 className={cn(TITLE, "flex items-center", dim && "opacity-45")}>
        <span className="truncate">{label}</span>
      </h3>
    )
  if (written === null)
    return (
      <h3 className="flex min-w-0">
        <button
          type="button"
          title="Rename"
          onClick={() => {
            left.current = false
            // a name still to come is not one to start from
            setWritten(awaited ? "" : label)
          }}
          className={cn(
            TITLE,
            "cursor-text truncate text-left outline-none hover:bg-foreground/8 focus-visible:bg-foreground/8",
            dim && "opacity-45",
            awaited && "shimmer text-muted-foreground shimmer-color-foreground"
          )}
        >
          {label}
        </button>
      </h3>
    )
  // done with once, however it is left: Enter and Esc are both followed by the box
  // losing the caret, which on its own would be clicking away
  const leave = (keep: boolean) => {
    if (left.current) return
    left.current = true
    setWritten(null)
    // nothing written for a name still to come is no name given: it is still to come
    if (keep && !(awaited && written.trim() === "")) onRename(written)
  }
  return (
    <input
      autoFocus
      aria-label="The group's name"
      value={written}
      onChange={(event) => setWritten(event.target.value)}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === "Enter") leave(true)
        if (event.key !== "Escape") return
        // not kept, and not taken for leaving anything else
        event.stopPropagation()
        leave(false)
      }}
      onBlur={() => leave(true)}
      className={cn(TITLE, "flex-1 bg-foreground/8 outline-none")}
    />
  )
}

/**
 * What the model is made of: a card for each group its parts are in, and in it a row of
 * the group's parts, each a picture with its name and how big its file is. A row with
 * more parts than fit is scrolled sideways. The groups are as the user has them: those
 * made by hand (Cmd+G) come first, the latest at the top, and parts taken out of their
 * groups (Shift+Cmd+G) are listed last, as in none.
 *
 * Picking a part shows it on its own in the view, with the camera brought to it, and
 * picking it again brings the rest back. Several are picked the way a list has it, and
 * shown together: with Cmd held, a part joins what is shown already, or leaves it; with
 * Shift held, every part from the one last clicked to this one is picked, across the
 * groups, as the list has them. A press on a group's card, anywhere that is not
 * something else to press, does for the whole group what picking does for a part: and
 * with Cmd or Shift held, the whole group joins what is picked, or leaves it. That is
 * how parts, or groups, are picked out here to make one group of. What a group goes by
 * is written over by clicking on it. Esc or a press anywhere else puts the list away;
 * what was picked stays picked.
 *
 * A part's file is saved from the arrow that comes up beside its name, and the files of
 * all a group's parts, together in a folder, from the arrow beside the group's.
 *
 * A part that was put out of sight in the view (H) is dim here, and so is a group all
 * of whose parts were. Picking one of those brings it back, and does no more than that.
 */
export function PartsPanel({
  loaded,
  projectId,
  thumbs,
  onRename,
  className,
}: {
  loaded: LoadedModel
  projectId: string
  /** the pictures of the parts, by part id, as far as they have been drawn */
  thumbs: Record<string, string>
  /** call a group something else: or, with nothing written, what it went by before */
  onRename: (groupId: string, label: string) => void
  className?: string
}) {
  const only = useStore((state) => state.view.only)
  const hidden = useStore((state) => state.view.hidden)
  const setView = useStore((state) => state.setView)
  const hoveredId = useStore((state) => state.hoveredId)
  const hover = useStore((state) => state.hover)
  const setPartsOpen = useStore((state) => state.setPartsOpen)
  const naming = useStore((state) => state.naming)
  const panel = React.useRef<HTMLDivElement>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const { model } = loaded

  // what is picked is shown on its own, and the camera brought to it; picked again,
  // the rest comes back and the camera goes back to where it was
  const pick = (what: Listed) =>
    setView({ only: same(only, what) ? null : { ...what, near: true } })
  // several picked out together in the view, and shown on their own, are each lit here
  const among = only?.kind === "parts" ? only.ids : NONE

  // Several are picked the way a list has it (see lib/several): the parts shown on
  // their own are the ones picked out here. The list's order is the groups' and, in
  // each, its parts': a sweep goes on from one group into the next.
  const order = React.useMemo(
    () =>
      model.groups.flatMap((group) =>
        model.parts
          .filter((part) => part.group === group.id)
          .map((part) => part.id)
      ),
    [model]
  )
  const sweep = React.useRef(NO_SWEEP)
  /** The parts shown on their own, by id: none, if all of the model is shown. */
  const alone = (): string[] => {
    if (!only) return NONE
    if (only.kind === "parts") return only.ids
    if (only.kind === "part") return [only.id]
    if (only.kind !== "group") return NONE
    return model.parts
      .filter((part) => part.group === only.id)
      .map((part) => part.id)
  }
  /** Show these parts on their own, and none other: all of the model, if there are none. */
  const showAlone = (ids: string[]) =>
    setView({
      only:
        ids.length === 0
          ? null
          : ids.length === 1
            ? { kind: "part", id: ids[0], near: true }
            : { kind: "parts", ids, near: true },
    })
  const pickOne = (id: string) => {
    sweep.current = { from: id, over: [] }
    pick({ kind: "part", id })
  }
  const pickToo = (id: string) => {
    const next = toggled(order, alone(), id)
    sweep.current = next.sweep
    showAlone(next.ids)
  }
  const pickTo = (id: string) => {
    // a part put out of sight is not there to pick: a sweep passes over it
    const next = sweptTo(order, alone(), sweep.current, id, hidden)
    sweep.current = next.sweep
    showAlone(next.ids)
  }
  /** Bring back parts that were put out of sight. */
  const show = (ids: string[]) =>
    setView({ hidden: hidden.filter((id) => !ids.includes(id)) })

  const save = (file: Download) =>
    void window.cad.model.saveCopy(projectId, file.file, savedAs(file.name))

  React.useEffect(() => {
    const away = (event: PointerEvent) => {
      const on = event.target as Element | null
      if (!on || panel.current?.contains(on)) return
      // the button that brought the list up also puts it away: that press is its own
      if (on.closest("[data-opens=parts]")) return
      setPartsOpen(false)
    }
    document.addEventListener("pointerdown", away, true)
    return () => document.removeEventListener("pointerdown", away, true)
  }, [setPartsOpen])

  // a group just made goes to the top of the list: the list goes there to show it
  const first = model.groups[0]?.id
  React.useEffect(() => {
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [first])

  return (
    <div
      ref={panel}
      role="group"
      aria-label="Parts"
      // for the view to know how much of itself the list lies over
      data-parts-list
      // A press in the list picks, and gives nothing the keys but a name that is being
      // written. So nothing here is drawn as having them for having been pressed, a
      // card least of all, which a key held to pick another with would then show; and
      // the keys go on being the view's. Whatever was being written, here or in the
      // message box, is done with, as it is by a press on the view.
      onMouseDown={(event) => {
        if ((event.target as Element).closest("input")) return
        event.preventDefault()
        const had = document.activeElement
        if (had instanceof HTMLElement && had !== document.body) had.blur()
      }}
      className={cn(
        // nothing in it is text to take: a click with Shift held picks, as in a list
        "glass pointer-events-auto flex w-107.5 flex-col overflow-hidden rounded-[28px] bg-background/70 shadow-lg ring-1 ring-foreground/10 select-none",
        className
      )}
    >
      <div
        ref={scroller}
        className="flex min-h-0 [scrollbar-width:none] flex-col gap-2.5 overflow-y-auto p-2.5"
        onPointerLeave={() => hover(null)}
      >
        {model.groups.map((group) => {
          const parts = model.parts.filter((part) => part.group === group.id)
          if (parts.length === 0) return null
          const whole: Listed = { kind: "group", id: group.id }
          // picked by itself, or with others: every part of it is among those shown
          const picked =
            same(only, whole) || parts.every((part) => among.includes(part.id))
          const gone = parts.every((part) => hidden.includes(part.id))
          // parts in no group are listed as one, but are not one to pick or to name
          const loose = group.id === LOOSE
          const awaited = naming.includes(group.id)
          // the files of its parts, each once, and how big they are together
          const files = [
            ...new Map(
              parts.flatMap((part) => {
                const file = partFile(model.downloads, part.id, part.label)
                return file ? [[file.file, file] as const] : []
              })
            ).values(),
          ]
          const size = sizeOf(files.reduce((sum, file) => sum + file.bytes, 0))
          const pickAll = (too: boolean) => {
            const ids = parts.map((part) => part.id)
            if (gone) return show(ids)
            if (!too) return pick(whole)
            // with a key held, the whole of it joins what is picked, or leaves it
            sweep.current = NO_SWEEP
            showAlone(toggledAll(order, alone(), ids))
          }
          return (
            <section
              key={group.id}
              aria-label={group.label}
              data-group={group.id}
              // a press on the card that is on nothing else of it is on the group
              {...(!loose && {
                tabIndex: 0,
                title: gone ? "Hidden: click to show it again" : undefined,
                onClick: (event: React.MouseEvent) => {
                  const on = event.target as Element
                  if (on.closest("button, input")) return
                  pickAll(event.metaKey || event.ctrlKey || event.shiftKey)
                },
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key !== "Enter" && event.key !== " ") return
                  event.preventDefault()
                  pickAll(event.metaKey || event.ctrlKey || event.shiftKey)
                },
              })}
              className={cn(
                CARD,
                "flex flex-col gap-7.5 overflow-hidden p-5.25",
                !loose && "cursor-pointer",
                !loose && FOCUS,
                picked ? PICKED : !loose && "hover:border-foreground/20",
                awaited && "being-named"
              )}
            >
              {/* taller than its words, to be pressed: it gives back above and below
                  what that takes */}
              <header className="-my-1.5 flex h-7 items-center gap-1.5">
                <Title
                  label={group.label}
                  dim={gone}
                  awaited={awaited}
                  onRename={loose ? null : (label) => onRename(group.id, label)}
                />
                {gone && <EyeOffIcon className={HIDDEN} />}
                {files.length > 0 && (
                  <>
                    <span className="ml-auto shrink-0 pl-1.5 text-xs text-muted-foreground tabular-nums">
                      {size}
                    </span>
                    <Save
                      label={
                        files.length === 1
                          ? `Download ${group.label}`
                          : `Download the ${files.length} parts of ${group.label}`
                      }
                      // its arrow stands where the card's room begins
                      className="-mr-1.5"
                      onClick={() =>
                        files.length === 1
                          ? save(files[0])
                          : void window.cad.model.saveCopies(
                              projectId,
                              files.map(({ file, name }) => ({ file, name })),
                              savedAs(group.label)
                            )
                      }
                    />
                  </>
                )}
              </header>
              {/* the row runs to the card's sides, where what does not fit is cut off */}
              <div className="-mx-5.25 flex [scrollbar-width:none] gap-5 overflow-x-auto px-5.25">
                {parts.map((part) => {
                  const one: Listed = { kind: "part", id: part.id }
                  // not where its whole group is picked: the card says so for them all
                  const lit =
                    !picked && (same(only, one) || among.includes(part.id))
                  const out = hidden.includes(part.id)
                  const file = partFile(model.downloads, part.id, part.label)
                  const url = thumbs[part.id]
                  return (
                    <div
                      key={part.id}
                      className="group/part relative w-37.5 shrink-0"
                    >
                      <button
                        type="button"
                        aria-pressed={lit}
                        data-part={part.id}
                        title={
                          out ? "Hidden: click to show it again" : undefined
                        }
                        className="group/pick flex w-full cursor-pointer flex-col gap-2 text-left outline-none"
                        onPointerEnter={() => hover(part.id)}
                        onClick={(event) => {
                          if (out) return show([part.id])
                          // Cmd is the one of the two that counts, with both held
                          if (event.metaKey || event.ctrlKey)
                            return pickToo(part.id)
                          if (event.shiftKey) return pickTo(part.id)
                          pickOne(part.id)
                        }}
                      >
                        {/* its picture, on a square a little lighter than the card: an
                            empty one until it has been drawn */}
                        <span
                          className={cn(
                            "relative block aspect-square w-full overflow-hidden rounded-xl border bg-foreground/9 group-focus-visible/pick:ring-[3px] group-focus-visible/pick:ring-ring/50",
                            lit
                              ? // one line, two pixels wide, drawn inside the square:
                                // nothing of it is cut off by the row, and it has no
                                // seam in it
                                "border-transparent outline-2 -outline-offset-2 outline-foreground"
                              : // pointed at, here or in the view
                                hoveredId === part.id
                                ? "border-foreground/40"
                                : "group-hover/pick:border-foreground/40"
                          )}
                        >
                          {url && (
                            <img
                              src={url}
                              alt=""
                              draggable={false}
                              className={cn("size-full", out && "opacity-35")}
                            />
                          )}
                          {out && (
                            <EyeOffIcon
                              className={cn(
                                HIDDEN,
                                "absolute top-2.5 right-2.5"
                              )}
                            />
                          )}
                        </span>
                        {/* its name and, under it in the same letters, how big its file
                            is; the arrow that saves the file has the room beside them */}
                        <span className="flex min-w-0 flex-col pr-7 text-xs leading-4">
                          <span
                            className={cn(
                              "truncate font-medium",
                              out && "opacity-45"
                            )}
                          >
                            {part.label}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {(file && sizeOf(file.bytes)) || " "}
                          </span>
                        </span>
                      </button>
                      {file && (
                        <Save
                          label={`Download ${part.label}`}
                          // there when the part is pointed at, or the keys are on it
                          className="absolute right-0 bottom-0.5 -mr-1.5 opacity-0 group-hover/part:opacity-100 focus-visible:opacity-100"
                          onClick={() => save(file)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
        {/* not parts, but space the parts have to leave: listed with them all the same */}
        {model.keepouts.length > 0 &&
          (() => {
            const all: Listed = { kind: "keepouts", id: "keepouts" }
            const lit = same(only, all)
            return (
              <button
                type="button"
                aria-pressed={lit}
                className={cn(
                  CARD,
                  "flex h-14 cursor-pointer items-center gap-3 px-5.25 text-left text-base font-medium",
                  FOCUS,
                  lit && PICKED
                )}
                onPointerEnter={() => hover(null)}
                onClick={() => pick(all)}
              >
                <SquareDashedIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{model.keepoutsLabel}</span>
              </button>
            )
          })()}
      </div>
    </div>
  )
}
