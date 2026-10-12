// A project's assembly guides: how the thing that is modelled is put together, a step at
// a time, for whoever has its parts on the table. Each is one small file in a folder at
// the top of the project. It says which parts go on in each step and what is done with
// them, and no more: the parts are the model's own, as it is built, which a guide names
// and keeps no copy of. So a guide is shown with the model as it now is, and it is only
// when one is taken away, as an archive, that the parts go with it.
//
// kit/assembly.md says how one is written, and is what an agent reads before it writes
// one.
import type { Vec3 } from "./api"

/** The folder at the top of a project that its guides are in, one file each. */
export const ASSEMBLY_FOLDER = "assembly"

/** What a file in it is called to be a guide: lower case, and nothing an address cannot hold. */
export const GUIDE_FILE = /^([a-z0-9][a-z0-9-]*)\.json$/

/** The most guides a project has shown, the most that is read of one, in bytes, and its most steps. */
export const MOST_GUIDES = 40
export const MOST_GUIDE_BYTES = 400_000
export const MOST_STEPS = 80

/** One step of a guide: what goes on, and what is done with it. */
export type GuideStep = {
  /** what is done in it, in a few words: "Fit the seat" */
  title: string
  /** how, said to whoever is doing it */
  text: string
  /** the parts that go on in it, by id as the model has them */
  parts: string[]
  /**
   * Where they are before they go on, as how far that is from where they end up: mm, in
   * the model's own frame, Z up. They are shown coming from there, all of them alike.
   * Null leaves it to the page, which brings each of them in its own way from outside
   * what is already there: as four bolts go through four legs.
   */
  from: Vec3 | null
  /**
   * Where the step is best looked at from: the way from the model to the eye, in the
   * model's frame. Null is from where the step before was.
   */
  view: Vec3 | null
  /** something to take care over in it, if there is anything */
  tip: string | null
}

/** A guide, as its file has it. */
export type Guide = {
  /** what it is a guide to putting together: the thing, or the part of it */
  title: string
  /** which writing of the guide to that it is: the first is 1 */
  version: number
  /** when it was written (ms); null where its file does not say */
  made: number | null
  /** a line or two on what is being put together, for the top of it */
  summary: string | null
  /** what is needed that is no part of the model: a screwdriver, glue, something to buy */
  needs: string[]
  /**
   * The parts that are there before the first step, by id: what a guide to one part of
   * the model fits that part to. They are shown from the start, and no step puts them on.
   */
  already: string[]
  steps: GuideStep[]
}

/** A guide as it is given to be written: what an agent says, before the app has filed it. */
export type GuideGiven = {
  title: string
  summary?: string
  needs?: string[]
  already?: string[]
  steps: {
    title: string
    text: string
    parts: string[]
    from?: number[]
    view?: number[]
    tip?: string
  }[]
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v)
/** Something written, in one run of words: nothing, if there is nothing to it. */
const said = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null
const listed = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).flatMap((one) => said(one) ?? [])
const vec3 = (v: unknown): Vec3 | null =>
  Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n))
    ? (v as Vec3)
    : null

/**
 * A guide, from what is written in its file or what an agent gave to be written: or
 * what is wrong with it, said so that whoever wrote it can put it right.
 */
export function readGuide(written: unknown): Guide {
  if (!isObject(written)) throw new Error("A guide is an object.")
  const title = said(written.title)
  if (!title) throw new Error('A guide needs a "title".')
  if (!Array.isArray(written.steps) || written.steps.length === 0)
    throw new Error('A guide needs "steps": at least one.')
  if (written.steps.length > MOST_STEPS)
    throw new Error(`A guide has ${MOST_STEPS} steps at the most.`)
  const steps = written.steps.map((raw: unknown, index): GuideStep => {
    const step = `Step ${index + 1}`
    if (!isObject(raw)) throw new Error(`${step} is not an object.`)
    const what = said(raw.title)
    const text = said(raw.text)
    if (!what || !text) throw new Error(`${step} needs a "title" and a "text".`)
    if (raw.from !== undefined && raw.from !== null && !vec3(raw.from))
      throw new Error(`${step}: "from" is three numbers, in mm: [x, y, z].`)
    const view = vec3(raw.view)
    if (raw.view !== undefined && raw.view !== null && !view)
      throw new Error(`${step}: "view" is three numbers: [x, y, z].`)
    if (view && view.every((n) => n === 0))
      throw new Error(`${step}: "view" has to point somewhere.`)
    return {
      title: what,
      text,
      parts: [...new Set(listed(raw.parts))],
      from: vec3(raw.from),
      view,
      tip: said(raw.tip),
    }
  })
  const version = Number(written.version)
  const made = typeof written.made === "string" ? Date.parse(written.made) : NaN
  return {
    title,
    version: Number.isInteger(version) && version > 0 ? version : 1,
    made: Number.isFinite(made) ? made : null,
    summary: said(written.summary),
    needs: listed(written.needs),
    already: [...new Set(listed(written.already))],
    steps,
  }
}

/** The parts a guide shows, by id: those there to begin with, then those its steps put on. */
export const partsIn = (guide: Guide): string[] => [
  ...new Set([...guide.already, ...guide.steps.flatMap((step) => step.parts)]),
]

/**
 * What is wrong with a guide for a model that has these parts, each thing in a line:
 * nothing, of one that can be written. A part named twice would go on twice.
 */
export function troubleWith(guide: Guide, model: string[]): string[] {
  const known = new Set(model)
  const trouble: string[] = []
  const unknown = partsIn(guide).filter((id) => !known.has(id))
  if (unknown.length > 0)
    trouble.push(
      `The model has no part with ${unknown.length === 1 ? "the id" : "the ids"} ${unknown.join(", ")}. Its parts are: ${model.join(", ")}.`
    )
  const put = new Map<string, number>()
  guide.steps.forEach((step, index) => {
    for (const id of step.parts) {
      const before = put.get(id)
      if (before !== undefined)
        trouble.push(
          `${id} goes on in step ${before + 1} and again in step ${index + 1}: a part goes on once.`
        )
      else put.set(id, index)
      if (guide.already.includes(id))
        trouble.push(
          `${id} is there already ("already") and goes on in step ${index + 1}: it is one or the other.`
        )
    }
  })
  if (put.size === 0)
    trouble.push("No step puts a part on: each names the parts it adds.")
  return trouble
}

/** The parts of a model that a guide leaves out, by id: no step puts them on, and they are not there to begin with. */
export function leftOut(guide: Guide, model: string[]): string[] {
  const shown = new Set(partsIn(guide))
  return model.filter((id) => !shown.has(id))
}

/** A name a guide's file can have, from what the guide is to: "Counter stool" is "counter-stool". */
export const fileNameOf = (title: string): string =>
  title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "") || "guide"

/** A guide as its file is written: what `readGuide` reads back as the same guide. */
export function writtenAs(guide: Guide): string {
  return (
    JSON.stringify(
      {
        title: guide.title,
        version: guide.version,
        ...(guide.made === null
          ? {}
          : { made: new Date(guide.made).toISOString() }),
        ...(guide.summary ? { summary: guide.summary } : {}),
        ...(guide.needs.length > 0 ? { needs: guide.needs } : {}),
        ...(guide.already.length > 0 ? { already: guide.already } : {}),
        steps: guide.steps.map((step) => ({
          title: step.title,
          text: step.text,
          parts: step.parts,
          ...(step.from ? { from: step.from } : {}),
          ...(step.view ? { view: step.view } : {}),
          ...(step.tip ? { tip: step.tip } : {}),
        })),
      },
      null,
      2
    ) + "\n"
  )
}
