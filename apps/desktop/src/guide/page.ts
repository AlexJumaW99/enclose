// The page of an assembly guide: what a guide is opened as in a browser, from the app or
// from the folder it was taken away in.
//
// At the left, what the guide is to and when it was written, and under that its steps,
// one below another. The page is gone down through as any page is, and the step that
// has come up to the middle of it is the one the model beside it shows: its parts come
// in and go on, over the ones that are on already. So the wheel, the keys and a finger
// all go through the guide, and going back up takes it apart again.
//
// It is one page for every guide. What it shows it is told, by a file loaded ahead of
// this one (see electron/guide-page.ts): the guide, and the model's parts.
import type { Looks } from "@shared/api"
import type { Guide } from "@shared/assembly-format"
import { readModel } from "@/lib/model"
import { madeWith } from "./made-with"
import { stageOf, type Room, type Stage } from "./stage"
import "./page.css"

declare global {
  interface Window {
    /** what the page is of: the guide, the model it shows, and how its parts are drawn */
    ENCLOSE_GUIDE?: { guide: Guide; model: unknown; looks: Looks }
    /** the model's files by name, in base64, where they came with the page */
    ENCLOSE_FILES?: Record<string, string>
  }
}

/**
 * How the page is laid out: with the steps beside the model, or, where it is too narrow
 * for that, with the model over them. For each, how far down the page a step has come
 * up to when it is the one shown, as a share of the page's height; the room the model
 * has to itself; and how far down what is written begins to be seen.
 */
const NARROW = "(max-width: 820px)"
const BESIDE = { shown: 0.45, column: 340, edge: 44 }
const OVER = { shown: 0.6, model: 0.52, top: 84 }

/** How many of the parts a step puts on it names, at the most: the rest are counted. */
const NAMED = 6

const counted = (many: number, what: string) =>
  `${many} ${what}${many === 1 ? "" : "s"}`

/** Something of the page: a thing of this kind, called this, saying this. */
function made<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  called: string,
  ...within: (Node | string | null)[]
): HTMLElementTagNameMap[Tag] {
  const one = document.createElement(tag)
  if (called) one.className = called
  for (const thing of within) if (thing !== null) one.append(thing)
  return one
}

/** What was written, as paragraphs: a line left empty begins another. */
const written = (text: string, called: string) =>
  text
    .split(/\n\s*\n/)
    .map((words) => words.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((words) => made("p", called, words))

function page(told: NonNullable<Window["ENCLOSE_GUIDE"]>) {
  const { guide } = told
  // what the parts are called, for a step to say which it puts on
  const called = new Map<string, string>()
  try {
    for (const part of readModel(told.model).parts)
      called.set(part.id, part.label)
  } catch {
    // none of the guide's parts are in the model any more: it is still to be read
  }
  const shown = new Set([
    ...guide.already,
    ...guide.steps.flatMap((step) => step.parts),
  ])
  const when =
    guide.made === null
      ? null
      : new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(guide.made)

  const canvas = made("canvas", "stage")
  canvas.setAttribute("aria-label", `${guide.title}, in 3D`)
  const sections = [
    // before anything is begun: the thing whole, and what is needed to hand
    made(
      "section",
      "step",
      made("p", "label", "Before you start"),
      made(
        "h2",
        "",
        `${counted(guide.steps.length, "step")}, ${counted(shown.size, "part")}`
      ),
      ...(guide.summary ? written(guide.summary, "") : []),
      guide.needs.length > 0 ? made("p", "label needs", "You will need") : null,
      guide.needs.length > 0
        ? made("ul", "", ...guide.needs.map((need) => made("li", "", need)))
        : null
    ),
    ...guide.steps.map((step, index) => {
      const names = step.parts.flatMap((id) => called.get(id) ?? [])
      const parts =
        names.length > NAMED + 1
          ? [...names.slice(0, NAMED), `${names.length - NAMED} more`]
          : names
      return made(
        "section",
        "step",
        made("p", "label", `Step ${index + 1}`),
        made("h2", "", step.title),
        ...written(step.text, ""),
        step.tip ? made("p", "tip", step.tip) : null,
        parts.length > 0 ? made("p", "parts", parts.join(" · ")) : null
      )
    }),
    made(
      "section",
      "step",
      made("p", "label", "Finished"),
      made("h2", "", guide.title),
      made("p", "", "Every part is on.")
    ),
  ]
  // The steps are in a window of their own over the model, which they go up through as
  // the page is gone down: so that they come out of nothing under the name of the
  // thing, and go back into it at the foot, wherever the page is. What gives the page
  // its length is beside them, and as long as they are.
  const list = made("div", "list", ...sections)
  const steps = made("main", "steps", list)
  const length = made("div", "length")
  const thumb = made("i", "")
  const loading = made("p", "loading", "Loading the parts")
  document.body.append(
    canvas,
    made("div", "shade"),
    made(
      "header",
      "cover",
      made("h1", "", guide.title),
      made("p", "", "Assembly Guide"),
      made("p", "", [when, `v${guide.version}`].filter(Boolean).join(" · "))
    ),
    steps,
    length,
    made("div", "progress", thumb),
    loading
  )

  const narrow = window.matchMedia(NARROW)
  const still = window.matchMedia("(prefers-reduced-motion: reduce)")
  let stage: Stage | null = null
  /** which of the sections is the one shown, by its place among them */
  let active = -1

  /** How far down the page a section has come to when it is the one shown, in px. */
  const line = () =>
    window.innerHeight * (narrow.matches ? OVER.shown : BESIDE.shown)
  /** The room the model has to itself. */
  const room = (): Room =>
    narrow.matches
      ? {
          left: 0,
          top: OVER.top,
          right: 0,
          bottom: window.innerHeight * (1 - OVER.model),
        }
      : { left: BESIDE.column, top: 0, right: BESIDE.edge, bottom: 0 }

  /** The page is as long as takes the last step up to where it is the one shown. */
  const measure = () => {
    const last = sections[sections.length - 1]
    length.style.height = `${last.offsetTop - sections[0].offsetTop + window.innerHeight}px`
  }

  const look = () => {
    list.style.transform = `translateY(${-window.scrollY}px)`
    const at = line()
    let now = 0
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= at + 1) now = index
    })
    sections.forEach((section, index) =>
      section.classList.toggle("shown", index === now)
    )
    // how far down the page it is, on the mark at its edge
    const most = document.documentElement.scrollHeight - window.innerHeight
    const track = thumb.parentElement!.clientHeight - thumb.clientHeight
    thumb.style.transform = `translateY(${most > 0 ? (window.scrollY / most) * track : 0}px)`
    if (now === active) return
    const first = active < 0
    active = now
    // (the first of them is the thing whole, which is before the first step)
    stage?.go(now - 1, first)
  }

  /** Bring a section up to where it is the one shown. */
  const goTo = (index: number) => {
    const section = sections[Math.min(sections.length - 1, Math.max(0, index))]
    window.scrollTo({
      top: section.getBoundingClientRect().top + window.scrollY - line() + 2,
      behavior: still.matches ? "instant" : "smooth",
    })
  }

  let soon = 0
  const looked = () => {
    cancelAnimationFrame(soon)
    soon = requestAnimationFrame(look)
  }
  window.addEventListener("scroll", looked, { passive: true })
  window.addEventListener("resize", () => {
    stage?.give(room())
    measure()
    looked()
  })
  // (what is written takes another size once its typeface is here)
  new ResizeObserver(() => {
    measure()
    looked()
  }).observe(list)
  sections.forEach((section, index) =>
    section.addEventListener("click", () => goTo(index))
  )
  // the keys that go down a page go on a step, and the ones that go up, back one
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const on =
      ["ArrowDown", "ArrowRight", "PageDown", "j"].includes(event.key) ||
      (event.key === " " && !event.shiftKey)
    const back =
      ["ArrowUp", "ArrowLeft", "PageUp", "k"].includes(event.key) ||
      (event.key === " " && event.shiftKey)
    if (!on && !back) return
    event.preventDefault()
    goTo(active + (on ? 1 : -1))
  })
  measure()
  look()

  void stageOf(canvas, told, (done, total) => {
    loading.textContent =
      total > 0 ? `Loading ${done} of ${counted(total, "part")}` : ""
  }).then(
    (ready) => {
      stage = ready
      stage.give(room())
      stage.go(active - 1, true)
      loading.remove()
      canvas.classList.add("ready")
    },
    (error: unknown) => {
      // the steps are still there to be read
      loading.textContent = "The model could not be shown here."
      console.error(error)
    }
  )
}

madeWith()
const told = window.ENCLOSE_GUIDE
if (told) page(told)
else
  document.body.append(
    made("p", "loading", "There is no guide here: guide.js is missing.")
  )
