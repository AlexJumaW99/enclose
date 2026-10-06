// Telling fingers on a trackpad from a mouse wheel. Both arrive as the same scroll, and
// nothing in it says which it was, so it is read from how the scroll moves: fingers start
// slowly, by whole pixels, and wander sideways; a wheel turns one way, a notch at a time.

import { MAC } from "./platform"

/** The least a notch of a wheel scrolls where notches are counted in pixels. */
const NOTCH = 50
/** Scrolls closer together than this, in ms, are one movement, made by one thing. */
export const SCROLL_PAUSE = 200

export type Scroll = Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode">
export type ScrollSource = "fingers" | "wheel"

/** What a scroll that starts a movement was made with, as far as it shows. */
export function sourceOf(
  { deltaX, deltaY, deltaMode }: Scroll,
  mac = MAC
): ScrollSource {
  // counted in lines or pages, which fingers never are
  if (deltaMode !== 0) return "wheel"
  if (deltaX !== 0) return "fingers"
  // macOS speeds a wheel up by fractions of a line: a slow notch is 4.000244140625 px
  if (mac && !Number.isInteger(deltaY)) return "wheel"
  return Math.abs(deltaY) >= NOTCH ? "wheel" : "fingers"
}

/**
 * Follows the scrolls as they come and says what each was made with. A movement is
 * judged by how it starts and keeps that answer until it pauses: fingers that have got
 * up to speed scroll as far at a time as a wheel does.
 */
export function scrollSource(mac = MAC) {
  let last = -Infinity
  let source: ScrollSource = "fingers"
  return (scroll: Scroll, now: number): ScrollSource => {
    if (now - last > SCROLL_PAUSE) source = sourceOf(scroll, mac)
    last = now
    return source
  }
}
