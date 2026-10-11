import { useMotion } from '@modulato/gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsapCore from 'gsap'
import { useEffect, useRef, type CSSProperties } from 'react'
import { WINDOW } from '../../components/app/data'
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
    title: 'The essentials, in one place',
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
        // and so are the pictures in the list of parts, which are drawn of the model:
        // once it has come round, so that drawing them does not hold it up
        const pictures = [...document.querySelectorAll<HTMLImageElement>('.app__picture img')]
        window.setTimeout(() => {
          if (gone) return
          void opened.pictures(
            pictures.map((picture) => picture.dataset.part!),
            (id, url) => {
              for (const picture of pictures) if (picture.dataset.part === id) picture.src = url
            },
          )
        }, 2400)
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
            {/* (a word with a hyphen in it is kept on one line: "open-source") */}
            <h1 className="home__headline">
              {headline.split(/(\S+-\S+)/).map((part, index) =>
                index % 2 ? <span key={index}>{part}</span> : part,
              )}
            </h1>
            <p className="home__lede">{description}</p>
            <Download />
          </div>
          <div className="home__window" suppressHydrationWarning>
            <Window />
          </div>
          {/* The window is scaled to the room it is given, by how many times its own
              width goes into that: worked out here, as the page is read, so that it is
              right the first time it is drawn. (tour.ts keeps it right after.) */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w){w&&w.style.setProperty('--fit',w.offsetWidth/${WINDOW.width})})(document.querySelector('.home__window'))`,
            }}
          />
          {/* On a wide screen each is beside the window, on its own. On a phone they are
              in one band at the foot of the screen, side by side, and the band is gone
              along from one to the next. */}
          <div className="home__captions">
            <div className="home__trail" style={{ '--count': STOPS.length } as CSSProperties}>
              {STOPS.map((stop) => (
                <div key={stop.title} className={`home__caption home__caption--${stop.side}`}>
                  <h2>{stop.title}</h2>
                  <p>{stop.says}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
