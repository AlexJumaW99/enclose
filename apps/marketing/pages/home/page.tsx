import { useMotion } from '@modulato/gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsapCore from 'gsap'
import { useEffect, useRef } from 'react'
import { Window } from '../../components/app/Window'
import type { Look } from '../../components/app/look'
import type { View } from '../../components/app/view'
import { Download } from '../../components/Download'
import { Footer } from '../../shell/Footer'
import { runTour } from './tour'

gsapCore.registerPlugin(ScrollTrigger)

// What is said beside the window at each stop of the scroll, in the order the scroll
// reaches them, and which side of the window it is said on.
const STOPS = [
  {
    side: 'left',
    title: 'Every project where you can see it',
    says: 'A card for each project floats over the model and says what its conversation is up to. Earlier conversations wait under it, and agents can be at work on several at once.',
  },
  {
    side: 'right',
    title: 'One column for how you look',
    says: 'Lay a grid under the model, cut it open, pull it apart, stand it beside something of a known size, find a part by name. Each is a button, and each has a key.',
  },
  {
    side: 'right',
    title: 'Say what should change',
    says: 'Click the part you mean and say it. Claude, Codex or Grok, on your own subscription, edits the project’s code, builds the model again and tells you what it did.',
  },
  {
    side: 'right',
    title: 'Tools made for your model',
    says: 'Ask to see the model do something and the agent builds the tool for it: a lid on a slider, a clock set to a time, an arm run through a routine. They are the project’s own, and they are blue.',
  },
  {
    side: 'left',
    title: 'Drawings worked out from the model',
    says: 'Every side and four corners, each on its own sheet, with whatever is behind something left out and the sizes written on. Save them as SVG, with the model’s parts as layers.',
  },
] as const

export default function Home() {
  const view = useRef<View | null>(null)
  const tour = useRef<ReturnType<typeof runTour> | null>(null)

  useMotion(({ gsap }) => {
    const root = document.querySelector<HTMLElement>('.home')
    if (!root) return
    const running = runTour({ gsap, root, draw: (look: Look) => view.current?.draw(look) })
    tour.current = running
    return () => {
      running.stop()
      tour.current = null
    }
  })

  // The model is fetched once the page is up, and three.js with it: neither is in
  // what the page needs to be read.
  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-app="canvas"]')
    if (!canvas) return
    let gone = false
    // as sharp as the screen can show it where the window is drawn biggest, within reason
    const ratio = () => Math.min(1.7, Math.max(1, window.devicePixelRatio * (tour.current?.most() ?? 1)))
    const sharpen = () => view.current?.sharpen(ratio())
    void import('../../components/app/view')
      .then(({ openView }) => openView(canvas, ratio()))
      .then((opened) => {
        if (gone) return opened.dispose()
        view.current = opened
        tour.current?.render()
        canvas.dataset.ready = ''
        // once it has come in, it is the scroll's to show and hide, at the scroll's pace
        window.setTimeout(() => (canvas.style.transition = 'none'), 900)
        // the drawings are for later in the page: fetched once the model is there
        for (const sheet of document.querySelectorAll<HTMLImageElement>('.app__paper img[data-src]'))
          sheet.src = sheet.dataset.src!
        window.addEventListener('resize', sharpen)
      })
      .catch(() => {})
    return () => {
      gone = true
      window.removeEventListener('resize', sharpen)
      view.current?.dispose()
      view.current = null
    }
  }, [])

  return (
    <main className="home">
      <div className="home__tour">
        <div className="home__stage">
          <div className="home__hero">
            <h1 className="home__headline">
              Enclose is an open-source control plane for CAD with agents.
            </h1>
            <p className="home__lede">
              Bring your own subscriptions. Fork the project and make it your own.
            </p>
            <Download />
          </div>
          <div className="home__window">
            <Window />
          </div>
          {STOPS.map((stop) => (
            <div key={stop.title} className={`home__caption home__caption--${stop.side}`}>
              <h2>{stop.title}</h2>
              <p>{stop.says}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  )
}
