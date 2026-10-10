// What Claude says at the end of a turn comes in two parts. The user is looking at the
// model, and has seen what was done to it before reading a word: so Claude says the
// little they need in a short reply, and sets the rest off in a <details> block (it is
// told to in electron/threads.ts). The conversation shows the short reply, with the rest
// behind a button under it; a card in the sidebar says the short reply alone.

/** A reply as it is shown: what is said outright, and what is kept for whoever asks. */
export type Reply = {
  said: string
  /**
   * What was set off, as Markdown. Null where nothing was: all of the reply is said
   * outright. Empty where Claude has begun on it and written none of it yet.
   */
  more: string | null
}

/** Where what is set off begins: on a line of its own, or at the start of one. */
const OPENS = /^[ \t]*<details(?:\s[^>]*)?>/im
const CLOSES = /<\/details\s*>/i
/** What such a block is headed with in a web page: the button here says it already. */
const HEADED = /^\s*<summary>[\s\S]*?<\/summary>/i

/**
 * Text without the start of `tag` it ends in, where it ends in one: a reply is shown
 * while it is being written, and half a tag is nothing to show.
 */
function withoutBegun(text: string, tag: string, ownLine: boolean): string {
  const from = text.lastIndexOf("<")
  if (from < 0) return text
  const begun = text.slice(from).trimEnd().toLowerCase()
  if (begun.length >= tag.length || !tag.startsWith(begun)) return text
  // the tag that opens a block opens a line too: a < anywhere else is only a <
  if (ownLine && !/(^|\n)[ \t]*$/.test(text.slice(0, from))) return text
  return text.slice(0, from)
}

/** A reply of Claude's, in the two parts it is shown in. */
export function replyOf(text: string): Reply {
  const said: string[] = []
  const more: string[] = []
  let rest = text
  for (;;) {
    const opens = OPENS.exec(rest)
    if (!opens) break
    said.push(rest.slice(0, opens.index))
    rest = rest.slice(opens.index + opens[0].length)
    const closes = CLOSES.exec(rest)
    more.push(
      closes
        ? rest.slice(0, closes.index)
        : withoutBegun(rest, "</details>", false)
    )
    rest = closes ? rest.slice(closes.index + closes[0].length) : ""
  }
  // nothing set off, or only about to be
  if (more.length === 0)
    return { said: withoutBegun(text, "<details>", true).trim(), more: null }
  said.push(withoutBegun(rest, "<details>", true))

  const join = (parts: string[]) =>
    parts
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n\n")
  const outright = join(said)
  const setOff = join(more.map((part) => part.replace(HEADED, "")))
  // with nothing said first there is nothing to be short about: it is all the reply
  return outright
    ? { said: outright, more: setOff }
    : { said: setOff, more: null }
}
