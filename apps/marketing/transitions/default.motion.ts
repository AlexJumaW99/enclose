import { motion } from 'modulato'

// Going from one page to another: the page that is left fades, and then what is on
// the next comes in. Times are in ms, and the eases are written as curves: these are
// the browser's own animations.
export default motion({
  leave: {
    duration: 420,
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    reduced: { duration: 0 },
  },
  enter: {
    duration: 700,
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    // each thing in a column comes in this long after the one before, from this far
    // under where it rests, px: up to `most` of them, and the rest with the last
    stagger: 70,
    rise: 14,
    most: 12,
    // how long after the way is taken the next page waits, where the mark has
    // somewhere to go first: as long as the mark takes (shell/Mark.tsx, `.header`)
    after: 900,
    reduced: { duration: 0, stagger: 0, rise: 0, after: 0 },
  },
})

export const keywords: Record<string, string[]> = {
  leave: ['page fade out', 'leaving a page'],
  enter: ['page fade in', 'staggered text', 'terms and privacy coming in'],
}
