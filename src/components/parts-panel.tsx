import * as React from "react"
import { cn } from "cn"
import { DownloadIcon, EyeOffIcon, SquareDashedIcon } from "lucide-react"

import { partFile, sizeOf, type Download } from "@/lib/model"
import { useStore, type Only } from "@/lib/store"
import type { LoadedModel } from "./viewport/load"

/** What the list can pick out: one thing, by its id. */
type Listed = Extract<Only, { id: string }>

const same = (a: Only | null, b: Listed) =>
  a !== null && "id" in a && a.kind === b.kind && a.id === b.id
/** Stable when it is not several parts that are shown on their own. */
const NONE: string[] = []

/** What a group stands in, and what is listed with the groups without being one. */
const CARD = "shrink-0 rounded-xl border bg-foreground/3"
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

/**
 * What the model is made of: a card for each group the model puts its parts in, and in
 * it a row of the group's parts, each a picture with its name and how big its file is.
 * A row with more parts than fit is scrolled sideways. Picking a part or a group shows
 * it on its own in the view, and picking it again brings the rest back. Esc or a press
 * anywhere else puts the list away; what was picked stays picked.
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
  className,
}: {
  loaded: LoadedModel
  projectId: string
  /** the pictures of the parts, by part id, as far as they have been drawn */
  thumbs: Record<string, string>
  className?: string
}) {
  const only = useStore((state) => state.view.only)
  const hidden = useStore((state) => state.view.hidden)
  const setView = useStore((state) => state.setView)
  const hoveredId = useStore((state) => state.hoveredId)
  const hover = useStore((state) => state.hover)
  const setPartsOpen = useStore((state) => state.setPartsOpen)
  const panel = React.useRef<HTMLDivElement>(null)
  const { model } = loaded

  // what is picked is shown on its own, and the camera brought to it; picked again,
  // the rest comes back and the camera goes back to where it was
  const pick = (what: Listed) =>
    setView({ only: same(only, what) ? null : { ...what, near: true } })
  /** Bring back parts that were put out of sight. */
  const show = (ids: string[]) =>
    setView({ hidden: hidden.filter((id) => !ids.includes(id)) })
  // several picked out together in the view, and shown on their own, are each lit here
  const among = only?.kind === "parts" ? only.ids : NONE

  const save = (file: Download) =>
    void window.cad.model.saveCopy(projectId, file.file, file.name)

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

  return (
    <div
      ref={panel}
      role="listbox"
      aria-label="Parts"
      // for the view to know how much of itself the list lies over
      data-parts-list
      className={cn(
        "glass pointer-events-auto flex w-107.5 flex-col overflow-hidden rounded-[22px] bg-background/70 shadow-lg ring-1 ring-foreground/10",
        className
      )}
    >
      <div
        className="flex min-h-0 [scrollbar-width:none] flex-col gap-2.5 overflow-y-auto p-2.5"
        onPointerLeave={() => hover(null)}
      >
        {model.groups.map((group) => {
          const parts = model.parts.filter((part) => part.group === group.id)
          if (parts.length === 0) return null
          const whole: Listed = { kind: "group", id: group.id }
          const picked = same(only, whole)
          const gone = parts.every((part) => hidden.includes(part.id))
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
          return (
            <section
              key={group.id}
              className={cn(
                CARD,
                "flex flex-col gap-7.5 overflow-hidden p-5.25",
                picked && PICKED
              )}
            >
              {/* taller than its words, to be pressed: it gives back above and below
                  what that takes */}
              <header className="-my-1.5 flex h-7 items-center gap-1.5">
                <button
                  type="button"
                  role="option"
                  aria-selected={picked}
                  title={gone ? "Hidden: click to show it again" : undefined}
                  className={cn(
                    "mr-auto flex h-full min-w-0 cursor-pointer items-center gap-2 rounded-md text-left text-base font-medium",
                    FOCUS
                  )}
                  onClick={() =>
                    gone ? show(parts.map((part) => part.id)) : pick(whole)
                  }
                >
                  <span className={cn("truncate", gone && "opacity-45")}>
                    {group.label}
                  </span>
                  {gone && <EyeOffIcon className={HIDDEN} />}
                </button>
                {files.length > 0 && (
                  <>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
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
                              group.label
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
                  const lit = same(only, one) || among.includes(part.id)
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
                        role="option"
                        aria-selected={lit}
                        title={
                          out ? "Hidden: click to show it again" : undefined
                        }
                        className="group/pick flex w-full cursor-pointer flex-col gap-2 text-left outline-none"
                        onPointerEnter={() => hover(part.id)}
                        onClick={() => (out ? show([part.id]) : pick(one))}
                      >
                        {/* its picture, on a square a little lighter than the card: an
                            empty one until it has been drawn */}
                        <span
                          className={cn(
                            "relative block aspect-square w-full overflow-hidden rounded-lg border bg-foreground/9 group-focus-visible/pick:ring-[3px] group-focus-visible/pick:ring-ring/50",
                            lit
                              ? "border-foreground ring-1 ring-foreground"
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
                role="option"
                aria-selected={lit}
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
