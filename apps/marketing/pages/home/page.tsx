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
    title: 'Every project in view',
    says: 'Each card says what its agent is up to. Every conversation keeps its own version of the model.',
  },
  {
    side: 'right',
    title: 'The essentials,\nin one place',
    says: 'The view tools you reach for most, each one a click or a key away.',
  },
  {
    side: 'right',
    title: 'Edit everything at once',
    says: 'Leave a note on each part you want changed and send them together. Less back and forth.',
  },
  {
    side: 'right',
    title: 'Tools made for your model',
    says: 'No animation system to learn. Ask, and the agent builds the controls your model needs, from the same sliders and switches in every project.',
  },
  {
    side: 'left',
    title: 'Export high-definition drawings',
    says: 'Vector sheets of the whole model or only the parts you pick, each part on its own layer in the SVG.',
  },
] as const

export default function Home({ headline, description }: { headline: string; description: string }) {
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
        tour.current?.arrive()
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
            <h1 className="home__headline">{headline}</h1>
            <p className="home__lede">{description}</p>
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
