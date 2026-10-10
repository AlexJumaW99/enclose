// The mark: the axes widget from the corner of Enclose's 3D view, as the brand
// project draws it (enclose-brand, lib/mark.ts). Three axes seen from a camera,
// a dot at each end, the half of each axis that runs to its negative end broken
// into dots. Lengths are in the widget's own units, a square 100 across.

export type MarkParams = {
  azimuth: number
  elevation: number
  roll: number
  length: number
  weight: number
  dash: number
  gap: number
  dot: number
  negativeDot: number
  outline: number
  x: string
  y: string
  z: string
}

/** What of the mark a drawing shows. */
export type Parts = {
  negativeAxes: boolean
  /** every dot filled, the ones at the negative ends too */
  solid: boolean
  /** the letters on the positive ends, and what they are drawn in */
  labels: string | null
  /** what an outlined dot is filled with, where it is not left empty */
  tint: string | null
  /** how much the ends pointing away sit back, of 1 */
  fade: number
}

export type View = Pick<MarkParams, 'azimuth' | 'elevation' | 'roll'>

/** The brand's preset 2026-10-09-3: the logo. */
export const LOGO: MarkParams = {
  azimuth: -135,
  elevation: -35.26,
  roll: 0,
  length: 45,
  weight: 3,
  dash: 0,
  gap: 3.75,
  dot: 5,
  negativeDot: 5,
  outline: 4.5,
  x: 'currentColor',
  y: 'currentColor',
  z: 'currentColor',
}

export const LOGO_PARTS: Parts = {
  negativeAxes: true,
  solid: false,
  labels: null,
  tint: null,
  fade: 0,
}

/** The widget as it is in the corner of the app's view. */
export const GIZMO: MarkParams = {
  azimuth: -51.1,
  elevation: 37,
  roll: 0,
  length: 31,
  weight: 3,
  dash: 0,
  gap: 4,
  dot: 10.5,
  negativeDot: 8.5,
  outline: 1.75,
  x: 'var(--axis-x)',
  y: 'var(--axis-y)',
  z: 'var(--axis-z)',
}

export const GIZMO_PARTS: Parts = {
  negativeAxes: false,
  solid: false,
  labels: 'rgb(0 0 0 / 0.75)',
  tint: 'var(--app-view)',
  fade: 0.28,
}

type Axis = 'x' | 'y' | 'z'
const AXES: Axis[] = ['x', 'y', 'z']
const RADIANS = Math.PI / 180

const n = (value: number) => String(Math.round(value * 100) / 100)

/**
 * The six ends of the axes on the page, one unit long before they are
 * foreshortened, with y running down. A parallel projection: the axes stay
 * straight through the middle. Furthest first, so the nearer are drawn over.
 */
function project({ azimuth, elevation, roll }: View) {
  const turn = azimuth * RADIANS
  const lift = elevation * RADIANS
  const spin = roll * RADIANS
  const right = [-Math.sin(turn), Math.cos(turn), 0]
  const up = [-Math.cos(turn) * Math.sin(lift), -Math.sin(turn) * Math.sin(lift), Math.cos(lift)]
  const toward = [Math.cos(turn) * Math.cos(lift), Math.sin(turn) * Math.cos(lift), Math.sin(lift)]

  return AXES.flatMap((axis, index) =>
    ([1, -1] as const).map((sign) => {
      const x = sign * right[index]
      const y = sign * up[index]
      return {
        axis,
        sign,
        x: x * Math.cos(spin) - y * Math.sin(spin),
        y: -(x * Math.sin(spin) + y * Math.cos(spin)),
        depth: sign * toward[index],
      }
    }),
  ).sort((a, b) => a.depth - b.depth)
}

/**
 * The half of an axis that runs to its negative end, as the dashes it is broken
 * into: where each starts and ends, from the middle. As many however the mark
 * is turned, squeezed into what the turn leaves of the axis.
 */
function dashes(mark: MarkParams, seen: number, edge: number) {
  const cap = mark.weight
  const flat = mark.length - edge
  const left = seen * mark.length - edge
  const room = flat - (edge > 0 ? cap / 2 : 0)
  if (left <= 0 || room <= cap) return []

  const dash = Math.min(mark.dash, room - cap)
  const count = Math.min(
    Math.floor(room / (dash + cap)),
    Math.max(1, Math.round((room - (edge > 0 ? mark.gap : 0)) / (dash + mark.gap + cap))),
  )
  const gap = edge > 0 ? (room - count * (dash + cap)) / (count + 1) : room / count - dash - cap
  const squeeze = left / flat

  return Array.from({ length: count }, (_, index): [number, number] => {
    const from = (edge > 0 ? gap + cap / 2 : 0) + index * (dash + gap + cap)
    return [(flat - from) * squeeze, (flat - from - dash) * squeeze]
  })
}

const LETTERS: Record<Axis, string> = { x: 'X', y: 'Y', z: 'Z' }

/** The mark's elements, as SVG, in a square 100 across with its middle at 0, 0. */
export function drawMark(mark: MarkParams, parts: Parts): string {
  return project(mark)
    .map(({ axis, sign, x, y, depth }) => {
      const color = mark[axis]
      const px = x * mark.length
      const py = y * mark.length
      const at = `cx="${n(px)}" cy="${n(py)}"`
      const stroke = `stroke="${color}" stroke-width="${n(mark.weight)}" stroke-linecap="round"`
      const drawn: string[] = []

      if (sign > 0) {
        drawn.push(`<line x1="0" y1="0" x2="${n(px)}" y2="${n(py)}" ${stroke}/>`)
        drawn.push(`<circle ${at} r="${n(mark.dot)}" fill="${color}"/>`)
        if (parts.labels)
          drawn.push(
            `<text x="${n(px)}" y="${n(py)}" dy="0.36em" text-anchor="middle" font-size="${n(mark.dot * 1.15)}" font-weight="700" fill="${parts.labels}">${LETTERS[axis]}</text>`,
          )
      } else {
        const seen = Math.hypot(x, y)
        if (parts.negativeAxes && seen > 0) {
          for (const [from, to] of dashes(mark, seen, mark.negativeDot)) {
            const [x1, y1] = [(x / seen) * from, (y / seen) * from]
            const [x2, y2] = [(x / seen) * to, (y / seen) * to]
            drawn.push(
              from - to < 0.01
                ? `<circle cx="${n(x1)}" cy="${n(y1)}" r="${n(mark.weight / 2)}" fill="${color}"/>`
                : `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${stroke}/>`,
            )
          }
        }
        if (parts.solid) {
          drawn.push(`<circle ${at} r="${n(mark.negativeDot)}" fill="${color}"/>`)
        } else {
          const r = mark.negativeDot
          const width = Math.min(mark.outline, r)
          drawn.push(
            `<circle ${at} r="${n(r - width / 2)}" stroke="${color}" stroke-width="${n(width)}" fill="${
              parts.tint ? `color-mix(in oklch, ${color} 28%, ${parts.tint})` : 'none'
            }"/>`,
          )
        }
      }

      const opacity = 1 - parts.fade * (1 - (depth + 1) / 2)
      return opacity < 1 ? `<g opacity="${n(opacity)}">${drawn.join('')}</g>` : drawn.join('')
    })
    .join('')
}
