import { motion } from 'modulato'

/** Shell motion tokens — tweak live in the dev overlay (the ✦ motion button). */
export default motion({
  shell: {
    // The mark turns by itself, once round each of its axes to a turn. With the page
    // at its top it turns once and rests, over and over. Once the page is scrolled
    // it keeps turning, and back at the top it comes round to how it started.
    mark: {
      // how long before the first turn, how long a turn takes, and the rest after it, s
      first: 1.2,
      spin: 2.6,
      rest: 4,
      // how long a turn takes while it keeps turning, and how long it takes to come
      // back to where it started, s
      around: 9,
      settle: 1.4,
      // how far above and below the ground it is seen from on the way, in degrees
      elevation: 35.26,
    },
  },
})

export const keywords: Record<string, string[]> = {
  'shell.mark': ['logo', 'symbol turning', 'axes rotating', 'spin interval'],
}
