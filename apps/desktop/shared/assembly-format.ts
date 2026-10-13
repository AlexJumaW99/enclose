// A project's assembly guides: how the thing that is modelled is put together, a step at
// a time, for whoever has its parts on the table. Each is one small file in a folder at
// the top of the project. It says which parts go on in each step and what is done with
// them, and no more: the parts are the model's own, as it is built, which a guide names
// and keeps no copy of. So a guide is shown with the model as it now is, and it is only
// when one is taken away, as an archive, that the parts go with it.
//
// Not everything goes straight on to the thing. A dot is pressed into its ring before
// the ring goes on, and a gear on to its shaft before the shaft does: such a thing is
// made up apart, in steps of its own that say what it is (`sub`), and then goes on whole
// in a step that says it does (`fits`). So a step is seen with only what it is done to:
// the thing itself, so far, or the one thing that is being made up on the table.
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

/**
 * The pictures the page has for what is needed to hand, by what each goes by: a guide
 * says which a thing is shown with, and the page draws it (src/guide/icons.ts).
 */
export const NEED_ICONS = [
  "hex-key",
  "screwdriver",
  "wrench",
  "pliers",
  "hammer",
  "glue",
  "tape",
  "scissors",
  "knife",
  "drill",
  "soldering-iron",
  "ruler",
  "clamp",
  "cloth",
  "pencil",
  "box",
  "screw",
  "battery",
  "helper",
] as const
export type NeedIcon = (typeof NEED_ICONS)[number]

/**
 * Something needed that is no part of the model: what it is, and the picture it is
 * shown with. Null leaves the picture to the page, which makes it out from the name.
 */
export type Need = { name: string; icon: NeedIcon | null }

/** One step of a guide: what goes on, and what is done with it. */
export type GuideStep = {
  /** what is done in it, in a few words: "Fit the seat" */
  title: string
  /** how, said to whoever is doing it */
  text: string
  /** the parts that go on in it, by id as the model has them */
  parts: string[]
  /**
   * What the step is done to, where that is not the thing itself: something made up
   * apart from it, before it goes on, by what the reader is told it is called ("Hour
   * carrier"). The steps that say the same make that one thing up between them, and it
   * is seen alone in them. Null is the thing itself.
   */
  sub: string | null
  /**
   * The things made up apart that go on in this step, each whole, by what their steps
   * call them: with the step's own parts, and from where those come.
   */
  fits: string[]
  /**
   * Where they are before they go on, as how far that is from where they end up: mm, in
   * the model's own frame, Z up. They are shown coming from there, all of them alike.
   * Null leaves it to the page, which brings each of them in its own way from outside
   * what is already there: as four bolts go through four legs.
   */
  from: Vec3 | null
  /**
   * Where the step is best looked at from: the way from the model to the eye, in the
   * model's frame. The page looks at the model from one of its corners, as a blueprint
   * does, and this says which: the one nearest that way (see `cornerOf`). Null is from
   * where the last step done to the same thing was.
   */
  view: Vec3 | null
  /** something to take care over in it, if there is anything */
  tip: string | null
}

/**
 * How the thing is drawn on its guide's cover: in lines, under what the guide is called,
 * as on the cover of a manual. Whoever wrote the guide knows what the thing is, and so
 * what of it says so at a glance: the drawing is made as big as fills the cover with
 * that, and the rest of the thing runs off the edge of the sheet.
 */
export type GuideCover = {
  /**
   * Where it is drawn from: the way from the thing to the eye, in the model's frame,
   * whatever way shows it at its best. (A cover is not kept to the corners a step is
   * seen from.) Null is its front right corner, from above.
   */
  view: Vec3 | null
  /** the parts the cover is filled with, by id: none, where it is all of the thing */
  parts: string[]
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
  needs: Need[]
  /**
   * The parts that are there before the first step, by id: what a guide to one part of
   * the model fits that part to. They are shown from the start, and no step puts them on.
   */
  already: string[]
  cover: GuideCover
  steps: GuideStep[]
}

/** A guide as it is given to be written: what an agent says, before the app has filed it. */
export type GuideGiven = {
  title: string
  summary?: string
  needs?: (string | { name: string; icon?: string })[]
  already?: string[]
  cover?: { view?: number[]; parts?: string[] }
  steps: {
    title: string
    text: string
    parts: string[]
    sub?: string
    fits?: string[]
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
/** What is needed, as it is written: each a name, or a name with its picture. */
const needed = (v: unknown): Need[] =>
  (Array.isArray(v) ? v : []).flatMap((one): Need[] => {
    const name = said(isObject(one) ? one.name : one)
    if (!name) return []
    const icon = isObject(one)
      ? NEED_ICONS.find((known) => known === one.icon)
      : undefined
    return [{ name, icon: icon ?? null }]
  })
/** What a thing made up apart is called, as what is the same however it is written. */
const sameAs = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
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
      sub: said(raw.sub),
      fits: [...new Set(listed(raw.fits))],
      from: vec3(raw.from),
      view,
      tip: said(raw.tip),
    }
  })
  // What is made up apart is called one thing throughout, as its first step has it:
  // "Hour carrier" and "hour-carrier" are the same thing, said twice.
  const names = new Map<string, string>()
  for (const { sub } of steps)
    if (sub && !names.has(sameAs(sub))) names.set(sameAs(sub), sub)
  for (const step of steps) {
    if (step.sub) step.sub = names.get(sameAs(step.sub))!
    step.fits = [
      ...new Set(step.fits.map((name) => names.get(sameAs(name)) ?? name)),
    ]
  }
  const version = Number(written.version)
  const made = typeof written.made === "string" ? Date.parse(written.made) : NaN
  const cover = isObject(written.cover) ? written.cover : {}
  const from = vec3(cover.view)
  if (cover.view !== undefined && cover.view !== null && !from)
    throw new Error('The cover\'s "view" is three numbers: [x, y, z].')
  return {
    title,
    version: Number.isInteger(version) && version > 0 ? version : 1,
    made: Number.isFinite(made) ? made : null,
    summary: said(written.summary),
    needs: needed(written.needs),
    already: [...new Set(listed(written.already))],
    cover: {
      view: from && from.some((n) => n !== 0) ? from : null,
      parts: [...new Set(listed(cover.parts))],
    },
    steps,
  }
}

/**
 * The corner of the model that a way of looking at it is nearest, as the way from the
 * model to the eye there: each of the three sides it shows turned equally to the eye,
 * which is how a blueprint draws a corner. A way that leans to neither side of one of
 * the model's axes is from the right, from the front, and from above.
 */
export const cornerOf = ([x, y, z]: Vec3): Vec3 => [
  x < 0 ? -1 : 1,
  y > 0 ? 1 : -1,
  z < 0 ? -1 : 1,
]

/** The parts a guide shows, by id: those there to begin with, then those its steps put on. */
export const partsIn = (guide: Pick<Guide, "already" | "steps">): string[] => [
  ...new Set([...guide.already, ...guide.steps.flatMap((step) => step.parts)]),
]

/**
 * The parts of each thing a guide has made up apart, by what the thing is called: the
 * ones its own steps put on, and those of whatever they fit to it, in the order they
 * go on.
 */
function madeUp(steps: GuideStep[]): Map<string, string[]> {
  const whole = new Map<string, string[]>()
  // (a thing fitted to itself, by whatever way round, is left out of itself)
  const of = (name: string, within: string[]): string[] => {
    const done = whole.get(name)
    if (done) return done
    if (within.includes(name)) return []
    const parts = [
      ...new Set(
        steps
          .filter((step) => step.sub === name)
          .flatMap((step) => [
            ...step.fits.flatMap((fitted) => of(fitted, [...within, name])),
            ...step.parts,
          ])
      ),
    ]
    if (within.length === 0) whole.set(name, parts)
    return parts
  }
  for (const { sub } of steps) if (sub) of(sub, [])
  return whole
}

/**
 * What is seen in a step: the parts that are there when it begins, and the ones it puts
 * on, by id. Everything else is out of sight in it.
 */
export type Scene = { there: string[]; coming: string[] }

/**
 * What is seen in each step of a guide. A step done to the thing itself has all that has
 * gone on to it so far, with what was there to begin with; a step done to something made
 * up apart has only that thing, so far. What a step puts on is its own parts and all of
 * whatever it fits.
 */
export function scenesOf(guide: Pick<Guide, "already" | "steps">): Scene[] {
  const made = madeUp(guide.steps)
  // what has gone on to each thing so far: the thing itself goes by null
  const on = new Map<string | null, string[]>([[null, [...guide.already]]])
  return guide.steps.map((step) => {
    const there = on.get(step.sub) ?? []
    const coming = [
      ...new Set([
        ...step.fits.flatMap((name) => made.get(name) ?? []),
        ...step.parts,
      ]),
    ].filter((id) => !there.includes(id))
    on.set(step.sub, [...there, ...coming])
    return { there, coming }
  })
}

/** Some steps, as they are spoken of: "step 3", "steps 3 and 4", "steps 3, 4 and 6". */
const stepsSaid = (steps: number[]) => {
  const said = steps.map((index) => String(index + 1))
  return said.length === 1
    ? `step ${said[0]}`
    : `steps ${said.slice(0, -1).join(", ")} and ${said.at(-1)}`
}

/**
 * What is wrong with how a guide's things made up apart are made up and fitted: each is
 * made up by steps that come before the one step that fits it, and is fitted once.
 */
function troubleMadeUp(guide: Guide): string[] {
  const trouble: string[] = []
  const steps = new Map<string, number[]>()
  guide.steps.forEach(({ sub }, index) => {
    if (sub) steps.set(sub, [...(steps.get(sub) ?? []), index])
  })
  const fitted = new Map<string, number>()
  guide.steps.forEach((step, index) => {
    for (const name of step.fits) {
      const made = steps.get(name)
      const before = fitted.get(name)
      if (!made)
        trouble.push(
          `Step ${index + 1} fits "${name}", which no step makes up: "fits" names what earlier steps give as their "sub"${steps.size > 0 ? ` (${[...steps.keys()].map((one) => `"${one}"`).join(", ")})` : ""}. A part that goes on by itself is in "parts".`
        )
      else if (step.sub === name)
        trouble.push(
          `Step ${index + 1} is done to "${name}" and fits it as well: the step that fits a thing is done to what the thing goes on to.`
        )
      else if (before !== undefined)
        trouble.push(
          `"${name}" is fitted in step ${before + 1} and again in step ${index + 1}: it goes on once.`
        )
      else {
        fitted.set(name, index)
        const late = made.filter((one) => one > index)
        if (late.length > 0)
          trouble.push(
            `"${name}" goes on in step ${index + 1}, and ${stepsSaid(late)} ${late.length === 1 ? "is" : "are"} still done to it: all of its steps come before the one that fits it. What is done once it is on is a step with no "sub".`
          )
      }
    }
  })
  for (const [name, made] of steps)
    if (!fitted.has(name))
      trouble.push(
        `"${name}" is made up in ${stepsSaid(made)} and never goes on: a later step fits it, by naming it in "fits".`
      )
  return trouble
}

/** What kind of part one is, going by what it is called: "Leg, front left" and "Leg, back right" are both legs. */
const kindOf = (called: string) => {
  const kind = called
    .split(",")[0]
    .toLowerCase()
    .replace(/[\d_-]+/g, " ")
    .replace(/\b(left|right|front|back|rear|top|bottom|upper|lower)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return kind || called
}

/**
 * The steps of a guide that put on parts of more than one kind at once, counted from 0,
 * each with what those parts are called. A step's parts arrive as one, so such a step
 * shows nothing of how they go to each other: right for a thing that comes in one
 * piece, and otherwise a step that wants splitting. `called` is what each part is
 * called, by id; one it does not have goes by its id.
 */
export function mixed(
  guide: Guide,
  called: ReadonlyMap<string, string> = new Map()
): { step: number; parts: string[] }[] {
  return guide.steps.flatMap((step, index) => {
    const names = step.parts.map((id) => called.get(id) ?? id)
    return new Set(names.map(kindOf)).size > 1
      ? [{ step: index, parts: names }]
      : []
  })
}

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
  trouble.push(...troubleMadeUp(guide))
  const shown = new Set(partsIn(guide))
  const strange = guide.cover.parts.filter(
    (id) => known.has(id) && !shown.has(id)
  )
  if (strange.length > 0)
    trouble.push(
      `The cover is to be filled with ${strange.join(", ")}, which the guide does not show: a cover is of parts the guide puts on, or that are there already.`
    )
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
        ...(guide.needs.length > 0
          ? {
              needs: guide.needs.map(({ name, icon }) =>
                icon ? { name, icon } : name
              ),
            }
          : {}),
        ...(guide.already.length > 0 ? { already: guide.already } : {}),
        ...(guide.cover.view || guide.cover.parts.length > 0
          ? {
              cover: {
                ...(guide.cover.view ? { view: guide.cover.view } : {}),
                ...(guide.cover.parts.length > 0
                  ? { parts: guide.cover.parts }
                  : {}),
              },
            }
          : {}),
        steps: guide.steps.map((step) => ({
          title: step.title,
          text: step.text,
          ...(step.sub ? { sub: step.sub } : {}),
          parts: step.parts,
          ...(step.fits.length > 0 ? { fits: step.fits } : {}),
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
