import { motion } from 'modulato'

// Where the app's window is at each stop of the page's scroll, and where the model
// is in it. A stop says how wide the window is drawn (`wide`, in widths of the
// screen), and which point of the window (`ax`, `ay`, in the window's own px, of
// 1720 by 1000) is put at which point of the screen (`vx`, `vy`, as shares of it).
// `mx` and `my` are where on the screen the model's middle is, and `far` how far
// off it is seen from, in its own radius.
export default motion({
  stops: {
    projects: {
      wide: 1.5, ax: 0, ay: 0, vx: 0.42, vy: 0.12,
      // the foot of the cards once they are all there, which is kept on the screen
      foot: 826, footAt: 0.95,
      mx: 0.86, my: 0.66, far: 3.9,
      phone: { wide: 3.3, vx: 0.05, vy: 0.11, footAt: 0.64, mx: 1.2, my: 0.4 },
    },
    menu: {
      wide: 1.25, ax: 1720, ay: 500, vx: 0.72, vy: 0.5,
      mx: 0.34, my: 0.52, far: 4.2, apart: 6.6,
      phone: { wide: 3, vx: 0.985, vy: 0.4, mx: 0.42, my: 0.42, far: 6, apart: 9 },
    },
    chat: {
      wide: 1.3, ax: 1720, ay: 1000, vx: 0.71, vy: 0.965,
      mx: 0.16, my: 0.5, far: 3.9,
      phone: { wide: 3.1, vx: 0.985, vy: 0.66, mx: -0.3, my: 0.4 },
    },
    tools: {
      wide: 1.2, ax: 1720, ay: 500, vx: 0.72, vy: 0.5,
      mx: 0.25, my: 0.62, far: 7.4,
      phone: { wide: 2.9, ax: 1690, vx: 0.98, vy: 0.45, mx: 0.46, my: 0.2, far: 10 },
    },
    sheets: {
      wide: 1.1, ax: 0, ay: 500, vx: 0.4, vy: 0.5,
      mx: 0.7, my: 0.5, far: 3.6,
      phone: { wide: 2.5, ax: 250, vx: 0, vy: 0.38 },
    },
    outro: {
      // as much of the window as the screen has room for, in its middle
      wide: 0.9, tall: 0.8, ax: 860, ay: 500, vx: 0.5, vy: 0.53,
      mx: 0.34, my: 0.5, far: 3.6,
      phone: { wide: 0.94, vy: 0.4 },
    },
  },
})

export const keywords: Record<string, string[]> = {
  'stops.projects': ['project cards', 'sidebar zoom', 'first stop'],
  'stops.menu': ['view buttons', 'explode', 'tool column'],
  'stops.chat': ['conversation', 'message box', 'thread'],
  'stops.tools': ['blue panel', 'custom tools', 'arm moving'],
  'stops.sheets': ['blueprint', 'drawings', 'sheets row'],
  'stops.outro': ['whole window', 'last stop', 'zoom out'],
}
