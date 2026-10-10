// The pictures put with a message: what each is called in the words of it, which kinds
// of picture can go, and where the window is shown one from. Both sides go by this: the
// window writes a picture's name into a message where it was pasted, and the app's own
// process hands the agent each picture under the same name.

import { MODEL_SCHEME, PICTURE_HOST } from "./api"

/** What a picture goes by in a message, by which of its pictures it is: "Image 2". */
export const pictureName = (number: number) => `Image ${number}`

/** That name as it stands in what was written, where the picture was put: "[Image 2]". */
export const pictureMark = (number: number) => `[${pictureName(number)}]`

const MARKED = /\[Image (\d+)\]/g

/** A stretch of what was written: plain words, or the mark of one of its pictures. */
export type Marked = { text: string; from: number; picture: number | null }

/**
 * What was written, cut into plain words and the marks of pictures. Only the marks of
 * pictures there are (`numbers`) are taken for marks: any other is words like the rest.
 */
export function atPictures(text: string, numbers: number[]): Marked[] {
  const out: Marked[] = []
  let at = 0
  for (const match of text.matchAll(MARKED)) {
    const picture = Number(match[1])
    if (!numbers.includes(picture)) continue
    if (match.index > at)
      out.push({ text: text.slice(at, match.index), from: at, picture: null })
    out.push({ text: match[0], from: match.index, picture })
    at = match.index + match[0].length
  }
  if (at < text.length)
    out.push({ text: text.slice(at), from: at, picture: null })
  return out
}

/**
 * What was written without a stretch of it, and without the gap that leaves: one of
 * the spaces either side of the stretch goes with it. And where the caret then goes.
 */
export function cutOut(text: string, from: number, length: number) {
  const before = text.slice(0, from)
  const after = text.slice(from + length)
  // (a comma or a full stop after it closes up to the word before)
  if (/[^\S\n]$/.test(before) && /^(\s|$|[,.;:!?)])/.test(after))
    return { text: before.slice(0, -1) + after, caret: from - 1 }
  return { text: before + after.replace(/^[^\S\n]/, ""), caret: from }
}

/** What was written without the mark of one picture, wherever it stands in it. */
export function withoutMark(text: string, number: number): string {
  const mark = pictureMark(number)
  let out = text
  for (let from = out.indexOf(mark); from >= 0; from = out.indexOf(mark))
    out = cutOut(out, from, mark.length).text
  return out
}

/** The kinds of picture every agent takes, and what a file of each ends in. */
export const PICTURE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

/**
 * The biggest a picture's file can be, in bytes, and the most it can measure along its
 * longer side: what an agent's maker takes of one. The window makes a bigger picture
 * smaller before it is kept.
 */
export const MOST_BYTES = 3_700_000
export const MOST_SIDE = 2000

/** The most pictures one message takes. */
export const MOST_AT_ONCE = 8

/** Where the window loads one of a project's pictures from. */
export const pictureUrl = (projectId: string, id: string) =>
  `${MODEL_SCHEME}://${projectId}.${PICTURE_HOST}/${id}`
