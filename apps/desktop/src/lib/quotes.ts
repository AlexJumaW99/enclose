// Words picked out of what was said in a conversation, for something to be said of them
// (see components/quoting.tsx). What is here needs no window: how the words are kept,
// and where what floats beside them goes.

/** The most letters of what was picked out that are kept. */
export const QUOTE_LENGTH = 2000

/**
 * What was picked out, as it is kept: its lines as they were, without the room a
 * selection leaves round them and between them, and no longer than a quote is.
 */
export function quoteOf(picked: string): string {
  const words = picked
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return words.length > QUOTE_LENGTH
    ? `${words.slice(0, QUOTE_LENGTH).trimEnd()}…`
    : words
}

/** The same in one line, for where there is room for no more: a chip, the head of a box. */
export const inLine = (words: string) => words.replace(/\s+/g, " ").trim()

/** Where something is on the screen, by its edges, px. */
export type Box = { left: number; top: number; right: number; bottom: number }

const between = (value: number, least: number, most: number) =>
  Math.min(Math.max(value, least), Math.max(least, most))

/**
 * Where something that floats beside a stretch of words goes, given how big it is: over
 * them or under them, as it would sooner be, and the other way where that has no room;
 * and as near their middle as keeps all of it inside `within`.
 */
export function beside(
  words: Box,
  size: { width: number; height: number },
  within: Box,
  sooner: "over" | "under",
  gap = 8
): { left: number; top: number } {
  const over = words.top - gap - size.height
  const under = words.bottom + gap
  const fits = {
    over: over >= within.top,
    under: under + size.height <= within.bottom,
  }
  const other = sooner === "over" ? "under" : "over"
  const way = fits[sooner] || !fits[other] ? sooner : other
  return {
    left: between(
      (words.left + words.right) / 2 - size.width / 2,
      within.left,
      within.right - size.width
    ),
    top: between(
      way === "over" ? over : under,
      within.top,
      within.bottom - size.height
    ),
  }
}
