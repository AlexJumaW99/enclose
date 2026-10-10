import type gsapType from 'gsap'
import { resolveTokens } from 'modulato'
import { ACTIVITIES, TYPED, WINDOW } from '../../components/app/data'
import { BUILT, REST, type Look } from '../../components/app/look'
import { drawMark, GIZMO, GIZMO_PARTS } from '../../shell/axes'
import tokens from './motion'

// The page's one long move. The app's window stays on the screen while the page is
// scrolled, and the scroll takes it from stop to stop: to its project cards, to the
// buttons down the edge of its view, to its conversation, to a project's own tools,
// to its drawings. At each stop something goes on in the window, as far along as
// the scroll is: so it can be stopped anywhere, and run backwards.

/** When each stop is reached and left, on the timeline: the gaps are the ways between. */
const AT = {
  projects: [10, 24],
  menu: [30, 48],
  chat: [54, 72],
  tools: [78, 94],
  sheets: [100, 114],
  outro: [122, 122],
} as const

type Stop = keyof typeof AT
const STOPS = Object.keys(AT) as Stop[]

/** The arm's routine: where its joints are from one beat to the next. */
const ROUTINE: Partial<Look>[] = [
  { turn: 0, shoulder: 95, elbow: 100, wrist: 10, roll: 0, grip: BUILT },
  // waving
  { turn: -28, shoulder: 105, elbow: 150, wrist: -40, roll: 30, grip: 80 },
  { turn: 28, shoulder: 105, elbow: 150, wrist: 35, roll: -30, grip: 80 },
  { turn: -20, shoulder: 105, elbow: 150, wrist: -40, roll: 30, grip: 80 },
  // pick and place
  { turn: -38, shoulder: 150, elbow: 120, wrist: 45, roll: 0, grip: 85 },
  { turn: -38, shoulder: 158, elbow: 118, wrist: 50, roll: 0, grip: 12 },
  { turn: 10, shoulder: 110, elbow: 115, wrist: 20, roll: 0, grip: 12 },
  { turn: 42, shoulder: 152, elbow: 122, wrist: 48, roll: 0, grip: 85 },
  // stirring
  { turn: 12, shoulder: 132, elbow: 128, wrist: 60, roll: 80, grip: 10 },
  { turn: -12, shoulder: 140, elbow: 120, wrist: 66, roll: -80, grip: 10 },
  { turn: 12, shoulder: 132, elbow: 128, wrist: 60, roll: 120, grip: 10 },
  // a bow, and folded again, as it is built
  { turn: 0, shoulder: 150, elbow: 60, wrist: -30, roll: 0, grip: 40 },
  { turn: 0, shoulder: 95, elbow: 100, wrist: 10, roll: 0, grip: BUILT },
  { turn: 0, shoulder: 0, elbow: 0, wrist: 0, roll: 0, grip: BUILT },
]

export function runTour({
  gsap,
  root,
  draw,
}: {
  gsap: typeof gsapType
  /** the page */
  root: HTMLElement
  /** draws the model, once there is one to draw */
  draw: (look: Look) => void
}) {
  const one = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const all = (selector: string) => [...root.querySelectorAll<HTMLElement>(selector)]

  const tour = one('.home__tour')
  const stage = one('.home__stage')
  const hero = one('.home__hero')
  const frame = one('.home__window')
  const app = one('.app')
  const captions = all('.home__caption')
  const mark = document.querySelector<HTMLElement>('.header__mark')
  const gizmo = one('[data-app="gizmo"]')

  /** Where the window is (its top left corner and its scale) and how its model is looked at. */
  const cam = { x: 0, y: 0, s: 1 }
  const look: Look = { ...REST }
  /** where the window is laid out, before it is moved: what `cam` is measured from */
  let home = { x: 0, y: 0, s: 1 }

  const render = () => {
    frame.style.transform = `translate3d(${cam.x - home.x}px, ${cam.y - home.y}px, 0) scale(${cam.s / home.s})`
    draw(look)
    gizmo.innerHTML = drawMark(
      { ...GIZMO, azimuth: look.azimuth, elevation: look.elevation },
      GIZMO_PARTS,
    )
  }

  const build = () => {
    const wide = stage.clientWidth
    const tall = stage.clientHeight
    home = { x: frame.offsetLeft, y: frame.offsetTop, s: frame.offsetWidth / WINDOW.width }
    Object.assign(cam, home)
    Object.assign(look, REST)

    const stops = resolveTokens(tokens).stops
    /** A stop as the screen has it: where the window is, and the model in it. */
    const stop = (name: Stop) => {
      const at = stops[name]
      let s = (at.wide * wide) / WINDOW.width
      if ('tall' in at) s = Math.min(s, (at.tall * tall) / WINDOW.height)
      const x = at.vx * wide - at.ax * s
      const y = at.vy * tall - at.ay * s
      return {
        x,
        y,
        s,
        // the model's middle, in the window's px
        mx: (at.mx * wide - x) / s,
        my: (at.my * tall - y) / s,
        far: at.far,
      }
    }
    const to = Object.fromEntries(STOPS.map((name) => [name, stop(name)])) as Record<
      Stop,
      ReturnType<typeof stop>
    >
    // The conversation is gone to by its foot, where the message box is. But a window
    // that is no taller than the screen is all on it, in the middle.
    // (On a narrow screen the words are under the window, and it keeps clear of them.)
    if (wide >= 768 && WINDOW.height * to.chat.s < tall * 0.92)
      to.chat.y = (tall - WINDOW.height * to.chat.s) / 2

    const length = AT.outro[1]
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: { trigger: tour, start: 'top top', end: 'bottom bottom', scrub: true },
      onUpdate: render,
    })

    /** The way from one stop to the next: the window, and the model in it. */
    const go = (name: Stop, from: number, more: Partial<Look> = {}) => {
      const { x, y, s, mx, my, far } = to[name]
      const duration = AT[name][0] - from
      tl.to(cam, { x, y, s, duration }, from)
      tl.to(look, { x: mx, y: my, distance: far, ...more, duration }, from)
    }
    const caption = (index: number, name: Stop) => {
      const [arrive, leave] = AT[name]
      tl.fromTo(
        captions[index],
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 2.4, ease: 'power2.out' },
        arrive - 1.8,
      )
      tl.to(captions[index], { autoAlpha: 0, y: -14, duration: 2, ease: 'power2.in' }, leave - 1)
    }
    /** Something put away or brought back: it closes up to nothing, or opens from it. */
    const tuck = (targets: HTMLElement | HTMLElement[], open: boolean, at: number, duration = 2) => {
      const [from, into] = open ? ['0fr', '1fr'] : ['1fr', '0fr']
      tl.fromTo(
        targets,
        { gridTemplateRows: from },
        { gridTemplateRows: into, duration, ease: 'power2.inOut', immediateRender: false },
        at,
      )
    }
    /** A button's tip comes up, the button is pressed (or let go), and the tip goes. */
    const press = (button: HTMLElement, on: number | null, at: number, held = 2.4) => {
      tl.to(button, { '--tip': 1, duration: 0.8, ease: 'power2.out' }, at)
      if (on !== null) tl.to(button, { '--on': on, duration: 0.5 }, at + 0.8)
      tl.to(button, { '--tip': 0, duration: 0.6, ease: 'power2.in' }, at + held)
    }
    const says = (target: HTMLElement, text: () => string) => () => {
      const next = text()
      if (target.textContent !== next) target.textContent = next
    }

    // ── from the top of the page to the project cards ─────────────────────
    // What the page says first goes up as fast as the page is scrolled.
    const perUnit = (tour.offsetHeight - tall) / length
    tl.to(hero, { y: -perUnit * 12, duration: 12, ease: 'none' }, 0)
    tl.to(hero, { autoAlpha: 0, duration: 5, ease: 'none' }, 1.5)
    if (mark) tl.to(mark, { '--fly': 0, duration: 9, ease: 'power2.inOut' }, 0)
    go('projects', 0, { azimuth: -38 })
    caption(0, 'projects')

    // The cards that were not there come in one after another, and the earlier
    // conversations of the first come out from under it.
    const later = all('[data-app="later"]')
    later.forEach((card, index) => {
      const at = AT.projects[0] + index * 1.7
      tuck(card, true, at)
      tl.fromTo(card, { marginBottom: -6 }, { marginBottom: 0, duration: 2, immediateRender: false }, at)
      tl.to(card.querySelector('.app__card'), { opacity: 1, duration: 1.4 }, at + 0.6)
    })
    const spread = one('[data-app="spread"]')
    const stacked = one('.app__card[data-under]')
    tuck(spread, true, AT.projects[0] + 6, 3)
    tl.to(stacked, { marginBottom: 0, duration: 1 }, AT.projects[0] + 6)
    tl.to(one('[data-app="sliver"]'), { opacity: 0, duration: 0.6 }, AT.projects[0] + 6)
    tl.to(all('[data-app="earlier"]'), { opacity: 1, duration: 1.4, stagger: 0.7 }, AT.projects[0] + 6.8)
    // the cards grow down the screen, and the window goes up to keep their foot on it
    const { foot, footAt } = stops.projects
    tl.to(
      cam,
      { y: Math.min(to.projects.y, footAt * tall - foot * to.projects.s), duration: 11, ease: 'sine.inOut' },
      AT.projects[0] + 1,
    )
    tl.to(look, { azimuth: -24, duration: 14, ease: 'none' }, AT.projects[0])

    // ── the buttons down the edge of the view ─────────────────────────────
    const talk = one('[data-app="talk"]')
    const button = (id: string) => one(`[data-switch="${id}"]`)
    // the conversation is put away, which leaves the view the whole window
    press(talk, 0, AT.projects[1] + 0.5)
    tl.to(app, { '--shut': 1, duration: 4 }, AT.projects[1] + 1.5)
    go('menu', AT.projects[1], { azimuth: -62, elevation: 30 })
    caption(1, 'menu')

    const [menu, menuEnds] = AT.menu
    press(button('grid'), 1, menu)
    tl.to(look, { grid: 1, duration: 2 }, menu + 0.8)
    // pulled apart, and looked at from further off as it grows; then put back
    press(button('explode'), 1, menu + 4, 3)
    tl.to(look, { apart: 1, distance: stops.menu.apart, duration: 6, ease: 'power2.inOut' }, menu + 4.8)
    tl.to(look, { azimuth: -18, elevation: 24, duration: 13, ease: 'sine.inOut' }, menu + 4.8)
    tl.to(look, { apart: 0, distance: to.menu.far, duration: 5 }, menuEnds - 5.5)
    tl.to(button('explode'), { '--on': 0, duration: 0.5 }, menuEnds - 1)
    tl.to(button('grid'), { '--on': 0, duration: 0.5 }, menuEnds - 0.5)
    tl.to(look, { grid: 0, duration: 2 }, menuEnds - 0.5)

    // ── the conversation ──────────────────────────────────────────────────
    const messages = one('[data-app="messages"]')
    const scroll = messages.parentElement!
    // it comes back as it was left a long while ago: at its beginning
    const above = Math.max(0, messages.offsetHeight - scroll.clientHeight)
    tl.set(messages, { y: above }, menuEnds + 0.4)
    press(talk, 1, menuEnds + 0.5)
    tl.to(app, { '--shut': 0, duration: 4 }, menuEnds + 1.5)
    go('chat', menuEnds, { azimuth: -40, elevation: 34 })
    caption(2, 'chat')

    // Scrolling the page scrolls what was said, down to the last of it.
    const [chat, chatEnds] = AT.chat
    tl.to(messages, { y: 0, duration: 9, ease: 'none' }, chat)

    // Then something more is written: of a part, which goes with it as a chip.
    const typed = one('[data-app="typed"]')
    const chip = one('[data-app="typed-part"]')
    const written = { letters: 0 }
    const write = says(typed, () => TYPED.text.slice(0, Math.round(written.letters)))
    tuck(chip, true, chat + 9, 1)
    tl.to(chip, { opacity: 1, paddingTop: 10, duration: 1 }, chat + 9)
    tl.to(one('[data-app="placeholder"]'), { opacity: 0, duration: 0.3 }, chat + 10)
    tl.to(one('[data-app="send"]'), { '--on': 1, duration: 0.3 }, chat + 10)
    tl.to(written, { letters: TYPED.text.length, duration: 4, ease: 'none', onUpdate: write }, chat + 10)
    // and sent: the box is empty again, and what was written is the last thing said
    const sent = chat + 14.6
    tl.to(written, { letters: 0, duration: 0.05, ease: 'none', onUpdate: write }, sent)
    tl.to(one('[data-app="placeholder"]'), { opacity: 1, duration: 0.3 }, sent)
    tl.to(one('[data-app="send"]'), { '--on': 0, duration: 0.3 }, sent)
    tuck(chip, false, sent, 0.5)
    tl.to(chip, { opacity: 0, paddingTop: 0, duration: 0.3 }, sent)
    tl.to(
      one('[data-app="sent"]'),
      { height: 'auto', marginTop: 0, opacity: 1, duration: 1.2, ease: 'power2.out' },
      sent,
    )
    const working = one('[data-app="working"]')
    const worked = { seconds: 1 }
    tl.to(working, { height: 20, marginTop: 0, opacity: 1, duration: 0.8 }, sent + 1)
    tl.to(
      worked,
      {
        seconds: 14,
        duration: chatEnds + 3 - sent,
        ease: 'none',
        onUpdate: says(one('[data-app="working-for"]'), () => `${Math.round(worked.seconds)} s`),
      },
      sent + 1,
    )
    tl.to(look, { azimuth: -52, duration: 18, ease: 'none' }, chat)

    // ── the project's own tools ───────────────────────────────────────────
    const panel = one('[data-app="panel"]')
    press(talk, 0, chatEnds + 0.3, 2)
    tl.to(app, { '--shut': 1, duration: 3.5 }, chatEnds + 1.1)
    go('tools', chatEnds, { azimuth: -64, elevation: 22 })
    caption(3, 'tools')
    press(button('tools'), 1, chatEnds + 2.4, 2.6)
    tl.fromTo(
      panel,
      { autoAlpha: 0, x: 14 },
      { autoAlpha: 1, x: 0, duration: 1.6, ease: 'power2.out' },
      chatEnds + 3.4,
    )
    // the cables are drawn where they lie at rest: moved, the arm would leave them behind
    tl.to(look, { cables: 0, duration: 1 }, chatEnds + 4)

    // The slider is taken along, and the arm goes through its routine as it is.
    const [tools, toolsEnds] = AT.tools
    const slider = one('[data-app="slider"]')
    const set = { along: 0 }
    const count = says(one('[data-app="count"]'), () => String(3 + Math.round(set.along * 7)))
    const doing = one('[data-app="doing"]')
    const routine = gsap.timeline({ defaults: { ease: 'sine.inOut' } })
    ROUTINE.forEach((pose) => routine.to(look, { ...pose, duration: 1 }))
    tl.add(routine.duration(toolsEnds + 2.5 - (tools - 2)), tools - 2)
    tl.to(
      set,
      {
        along: 1,
        duration: toolsEnds - tools - 2,
        ease: 'none',
        onUpdate() {
          slider.style.setProperty('--along', String(set.along))
          count()
          const beat = Math.min(ACTIVITIES.length - 1, Math.floor(set.along * ACTIVITIES.length))
          if (doing.textContent !== ACTIVITIES[beat]) doing.textContent = ACTIVITIES[beat]
        },
      },
      tools + 0.5,
    )
    tl.to(look, { azimuth: -30, duration: toolsEnds - tools, ease: 'none' }, tools)

    // ── the model's drawings ──────────────────────────────────────────────
    const sheets = one('[data-app="sheets"]')
    const row = one('[data-app="sheet-row"]')
    const canvas = one('[data-app="canvas"]')
    const others = [...all('[data-app="other"]'), ...later]
    tl.to(panel, { autoAlpha: 0, x: 14, duration: 1.4, ease: 'power2.in' }, toolsEnds)
    tl.to(button('tools'), { '--on': 0, duration: 0.5 }, toolsEnds + 0.6)
    // (the arm's routine ends folded, as it began: its cables are where it is again)
    tl.to(look, { cables: 1, duration: 0.8 }, toolsEnds + 2.6)
    go('sheets', toolsEnds, { azimuth: -45, elevation: 35 })
    caption(4, 'sheets')
    press(button('blueprint'), 1, toolsEnds + 1.6, 2.6)
    // the cards of the other projects close up out of the sheets' way
    tuck(others, false, toolsEnds + 2.4, 2.4)
    tl.to(others, { marginBottom: -6, duration: 2.4, immediateRender: false }, toolsEnds + 2.4)
    // (from all there, whatever they are when the scroll gets here: the view is not
    // there at all until its model has come)
    const giveWay = [
      canvas,
      gizmo,
      one('[data-app="add"]'),
      ...others.map((card) => card.querySelector('.app__project')),
    ]
    tl.fromTo(
      giveWay,
      { opacity: 1 },
      { opacity: 0, duration: 1.6, immediateRender: false },
      toolsEnds + 2.4,
    )
    tl.to(sheets, { autoAlpha: 1, duration: 0.6 }, toolsEnds + 3)
    tl.fromTo(
      all('[data-app="sheet"]'),
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 2, stagger: 0.5, ease: 'power3.out' },
      toolsEnds + 3,
    )
    tl.fromTo(
      one('[data-app="options"]'),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' },
      toolsEnds + 4.4,
    )
    // The sheets stand in a row that is gone along sideways.
    const [drawings, drawingsEnd] = AT.sheets
    const inSight = (wide - Math.max(0, to.sheets.x)) / to.sheets.s
    tl.to(
      row,
      { x: -Math.max(0, row.offsetWidth - inSight), duration: drawingsEnd - drawings - 1, ease: 'none' },
      drawings + 0.5,
    )

    // ── and the whole window again ────────────────────────────────────────
    tl.to(sheets, { autoAlpha: 0, duration: 1.4 }, drawingsEnd)
    tl.to(button('blueprint'), { '--on': 0, duration: 0.5 }, drawingsEnd + 0.4)
    tuck(others, true, drawingsEnd + 1, 2.4)
    tl.to(others, { marginBottom: 0, duration: 2.4 }, drawingsEnd + 1)
    tl.to(giveWay, { opacity: 1, duration: 1.8 }, drawingsEnd + 1.2)
    tl.to(talk, { '--on': 1, duration: 0.5 }, drawingsEnd + 1)
    tl.to(app, { '--shut': 0, duration: 4 }, drawingsEnd + 1)
    go('outro', drawingsEnd, { azimuth: -51.1 + 360, elevation: 37 })

    // the timeline is as long as the last stop says, whatever its last tween is
    tl.set({}, {}, length)
    render()
  }

  // Built again whenever the screen is another size: every stop is worked out from it.
  let context = gsap.context(build)
  let size = `${stage.clientWidth}x${stage.clientHeight}`
  let waiting = 0
  const resized = () => {
    window.clearTimeout(waiting)
    waiting = window.setTimeout(() => {
      const now = `${stage.clientWidth}x${stage.clientHeight}`
      if (now === size) return
      size = now
      context.revert()
      frame.style.transform = ''
      context = gsap.context(build)
    }, 160)
  }
  window.addEventListener('resize', resized)

  return {
    /** Draw the window as the scroll has it: asked for when the model has arrived. */
    render,
    /** The most the window is ever scaled, which is how sharp its view has to be. */
    most: () => {
      const stops = resolveTokens(tokens).stops
      return Math.max(...STOPS.map((name) => (stops[name].wide * stage.clientWidth) / WINDOW.width))
    },
    stop() {
      window.removeEventListener('resize', resized)
      window.clearTimeout(waiting)
      context.revert()
      frame.style.transform = ''
    },
  }
}
