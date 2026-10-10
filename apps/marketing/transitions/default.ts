import { resolveTokens, transition } from 'modulato'
import tokens from './default.motion'

/**
 * From any page to any other: the one that is left fades out, the mark goes to where
 * the next page has it, and then the next comes in. A page of terms comes in a thing
 * at a time, down its column; the first page comes in whole, and its own scroll and
 * its model do the rest. (The mark goes by itself: see `.header` and shell/Mark.tsx.
 * Here it is only waited for, where it has anywhere to go.)
 */
export default transition({
  async run({ from, to }) {
    const { leave, enter } = resolveTokens(tokens)
    const column = [...to.element.querySelectorAll<HTMLElement>('.legal__text > *, .legal > .footer')]
    const coming = column.length > 0 ? column : [to.element]
    // The mark is already where it is going only from one page of terms, not
    // scrolled, to the other: at its full size there, at the head of the column.
    const mark = document.querySelector<HTMLElement>('.header__mark')
    const full = mark
      ? mark.offsetWidth * parseFloat(getComputedStyle(mark).getPropertyValue('--legal-scale'))
      : 0
    const inPlace =
      mark !== null &&
      column.length > 0 &&
      from.element.querySelector('.legal__text') !== null &&
      mark.getBoundingClientRect().width > full - 1
    const wait = inPlace ? leave.duration : Math.max(leave.duration, enter.after)

    const going = from.element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: leave.duration,
      easing: leave.ease,
      fill: 'forwards',
    })
    // (each is held as it starts until its turn comes: the next page is under the one
    // that is fading, and would show through it otherwise)
    const arriving = coming.map((piece, index) =>
      piece.animate(
        column.length > 0
          ? [
              { opacity: 0, transform: `translateY(${enter.rise}px)` },
              { opacity: 1, transform: 'translateY(0)' },
            ]
          : [{ opacity: 0 }, { opacity: 1 }],
        {
          duration: enter.duration,
          delay: wait + Math.min(index, enter.most) * enter.stagger,
          easing: enter.ease,
          fill: 'both',
        },
      ),
    )
    await Promise.all([going.finished, ...arriving.map((one) => one.finished)]).catch(() => {})
    // as they rest is as the page has them: nothing is left holding them
    for (const one of arriving) one.cancel()
  },
})
