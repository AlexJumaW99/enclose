import { useRef } from 'react'
import { resolveTokens, useTicker, useViewport } from 'modulato'
import tokens from '../tokens/motion'
import { drawMark, LOGO, LOGO_PARTS } from './axes'

/** How far the page has to be scrolled before the mark takes it for scrolled, px. */
const SCROLLED = 8

const inOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const out = (t: number) => 1 - (1 - t) ** 3

/**
 * The logo, in the header: drawn in whatever colour the text there is, and turning
 * by itself. How far it has turned is one number, in turns: at every whole number
 * it is exactly as it started, having gone once round each of its axes.
 */
export function Mark() {
  const drawing = useRef<SVGGElement>(null)
  const { reducedMotion } = useViewport()
  const state = useRef({
    turns: 0,
    drawn: 0,
    /** what it is doing, and since when (ms), and from how far round */
    doing: 'resting' as 'resting' | 'spinning' | 'turning' | 'settling',
    since: -1,
    from: 0,
    /** how long it rests this time, s: less the first time */
    rest: -1,
  })

  useTicker((time, delta) => {
    const now = state.current
    if (reducedMotion || !drawing.current) return
    const { first, spin, rest, around, settle, elevation } = resolveTokens(tokens).shell.mark
    if (now.since < 0) now.since = time
    if (now.rest < 0) now.rest = first
    const scrolled = window.scrollY > SCROLLED
    const begin = (doing: typeof now.doing) => {
      now.doing = doing
      now.since = time
      now.from = now.turns
    }
    const elapsed = (time - now.since) / 1000

    if (scrolled) {
      // it keeps turning, from wherever it was
      if (now.doing !== 'turning') begin('turning')
      now.turns += delta / 1000 / around
    } else if (now.doing === 'turning') {
      begin('settling')
    } else if (now.doing === 'settling') {
      // on round to the next time it is as it started: not back the way it came
      const to = Math.ceil(now.from + 0.12)
      now.turns = now.from + (to - now.from) * out(Math.min(1, elapsed / settle))
      if (elapsed >= settle) {
        now.rest = rest
        begin('resting')
      }
    } else if (now.doing === 'spinning') {
      now.turns = now.from + inOut(Math.min(1, elapsed / spin))
      if (elapsed >= spin) {
        now.rest = rest
        begin('resting')
      }
    } else if (elapsed >= now.rest) {
      begin('spinning')
    }

    if (now.turns === now.drawn) return
    now.drawn = now.turns
    drawing.current.innerHTML = drawMark(
      {
        ...LOGO,
        azimuth: LOGO.azimuth + now.turns * 360,
        // down through the ground and back up, once each way
        elevation: -elevation * Math.cos(now.turns * Math.PI * 2),
        roll: now.turns * 360,
      },
      LOGO_PARTS,
    )
  })

  return (
    <svg viewBox="-50 -50 100 100" role="img" aria-label="Enclose">
      <g ref={drawing} dangerouslySetInnerHTML={{ __html: drawMark(LOGO, LOGO_PARTS) }} />
    </svg>
  )
}
