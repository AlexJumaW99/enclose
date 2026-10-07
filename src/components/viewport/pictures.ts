// What Claude is shown of a model to look it over by: the whole of it from two sides,
// the whole of it pulled apart, and every part by itself with its id under it. They are
// drawn off screen, by a renderer of their own that is thrown away when it is done, so
// nothing of how the user is looking at the model changes, and none of it is in them.
import * as THREE from "three"

import type { Picture, Seen, Vec3 } from "@shared/api"
import type { LoadedModel, LoadedPart } from "./load"
import { HOME_DIRECTION, toWorld } from "./rig"
import { frame, stage, standing } from "./thumbnails"

/** How big a picture of the whole model is, in pixels. */
const WHOLE = { width: 1280, height: 960 }
/** How much of its picture a thing fills. */
const FILL = 0.88
/** A part by itself: pixels a side, and the room under it for its id. */
const TILE = 224
const CAPTION = 30
/** The most parts across a sheet of them, and on one sheet; and the most sheets. */
const ACROSS = 6
const A_SHEET = ACROSS * ACROSS
const SHEETS = 5
/** What they are drawn on, and written in: light, where every colour of part shows. */
const PAPER = "#f4f4f5"
const INK = "#18181b"
/** From the other side of the model, and from under it. */
const BEHIND = new THREE.Vector3(-0.5, 0.62, -0.5).normalize()

/** A moment for the window to draw itself in: this is not to hold it up. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Draws on its own canvas whatever is handed to it, and gives it back as a picture on
 * paper: the renderer draws on nothing, and nothing is black to whoever is sent it.
 */
function easel() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)
  const { scene, root } = stage()
  const camera = new THREE.OrthographicCamera()
  return {
    root,
    /** Draw what stands in `root`, all of it in the picture, seen from `from`. */
    draw(width: number, height: number, from: THREE.Vector3) {
      renderer.setSize(width, height, false)
      root.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(root)
      frame(camera, box, toWorld(from), FILL, width / height)
      renderer.render(scene, camera)
      return renderer.domElement
    },
    done() {
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

function paper(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")!
  context.fillStyle = PAPER
  context.fillRect(0, 0, width, height)
  return { canvas, context }
}

const picture = (canvas: HTMLCanvasElement, caption: string): Picture => ({
  caption,
  data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1],
  mimeType: "image/jpeg",
})

/** As much of a line as fits in a width, with a mark that there was more. */
function fitted(
  context: CanvasRenderingContext2D,
  text: string,
  width: number
) {
  if (context.measureText(text).width <= width) return text
  let kept = text
  while (kept.length > 1 && context.measureText(`${kept}…`).width > width)
    kept = kept.slice(0, -1)
  return `${kept}…`
}

/**
 * A model as it is put before Claude: the pictures, and its parts with the size of each
 * and where its middle is. `colours` are the ones the user has given parts.
 */
export async function picturesOf(
  loaded: LoadedModel,
  colours: Record<string, string>
): Promise<Seen> {
  const { root, draw, done } = easel()
  const pictures: Picture[] = []
  // Pulled apart for Claude, every part goes its own way out from the middle, whatever
  // the view keeps together: it is to see each of them, to say which belong together.
  const middle = loaded.box.getCenter(new THREE.Vector3())
  const out = new THREE.Vector3()
  /** Every part put where it stands, or as far out from there as the model is pulled apart. */
  const stand = (parts: LoadedPart[], apart: number) => {
    const stood = parts.map((part) => {
      const made = standing(part, false, colours[part.part.id])
      part.box.getCenter(out).applyMatrix4(part.home).sub(middle)
      made.holder.position.addScaledVector(out, apart)
      root.add(made.holder)
      return made
    })
    return () => {
      for (const { holder, dispose } of stood) {
        root.remove(holder)
        dispose()
      }
    }
  }
  const whole = (from: THREE.Vector3, caption: string) => {
    const { canvas, context } = paper(WHOLE.width, WHOLE.height)
    context.drawImage(draw(WHOLE.width, WHOLE.height, from), 0, 0)
    pictures.push(picture(canvas, caption))
  }

  try {
    let clear = stand(loaded.parts, 0)
    whole(
      HOME_DIRECTION,
      "the model as it is put together, from the front, the right and above."
    )
    whole(
      BEHIND,
      "the same from the other side: from behind, the left and below."
    )
    clear()
    await breathe()
    if (loaded.parts.length > 1) {
      clear = stand(loaded.parts, 1)
      whole(
        HOME_DIRECTION,
        "the model pulled apart, every part moved straight out from the middle."
      )
      clear()
      await breathe()
    }

    // each part by itself, as big as its picture lets it be: sizes are in the list
    const pictured = loaded.parts.slice(0, A_SHEET * SHEETS)
    for (let first = 0; first < pictured.length; first += A_SHEET) {
      const sheet = pictured.slice(first, first + A_SHEET)
      const across = Math.min(ACROSS, Math.ceil(Math.sqrt(sheet.length)))
      const down = Math.ceil(sheet.length / across)
      const { canvas, context } = paper(across * TILE, down * (TILE + CAPTION))
      context.fillStyle = INK
      context.font = "500 14px ui-monospace, Menlo, monospace"
      context.textAlign = "center"
      context.textBaseline = "middle"
      for (const [index, part] of sheet.entries()) {
        const x = (index % across) * TILE
        const y = Math.floor(index / across) * (TILE + CAPTION)
        const clear = stand([part], 0)
        context.drawImage(draw(TILE, TILE, HOME_DIRECTION), x, y)
        clear()
        context.fillText(
          fitted(context, part.part.id, TILE - 12),
          x + TILE / 2,
          y + TILE + CAPTION / 2 - 3
        )
        if (index % 6 === 5) await breathe()
      }
      const last = first + sheet.length
      pictures.push(
        picture(
          canvas,
          `${
            loaded.parts.length === 1
              ? "the one part"
              : `parts ${first + 1} to ${last} of ${loaded.parts.length}`
          }, each by itself and as big as its square lets it be, with its id under it.`
        )
      )
      await breathe()
    }
  } catch (error) {
    // whatever went wrong in the drawing, the list of parts is still something to go by
    console.warn("[pictures]", error)
  } finally {
    done()
  }

  const round = (v: THREE.Vector3): Vec3 => [
    Math.round(v.x * 100) / 100,
    Math.round(v.y * 100) / 100,
    Math.round(v.z * 100) / 100,
  ]
  return {
    pictures,
    parts: loaded.parts.map((part) => {
      const box = part.box.clone().applyMatrix4(part.home)
      return {
        id: part.part.id,
        label: part.part.label,
        group:
          loaded.model.groups.find((group) => group.id === part.part.group)
            ?.label ?? part.part.group,
        size: round(box.getSize(new THREE.Vector3())),
        middle: round(box.getCenter(new THREE.Vector3())),
        color: part.part.color,
      }
    }),
  }
}
