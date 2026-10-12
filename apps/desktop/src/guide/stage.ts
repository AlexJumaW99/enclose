// The model in a guide's page: its parts, drawn as the app draws them, going on as the
// guide is gone through.
//
// The parts are the model's own files, the ones the app's view loads, and are drawn the
// same way: in the app's colours, with the lines of their edges over them, under the
// same lights. What a step puts on is lit, as a part picked out in the app is; what is on
// already is quieter; and before the first step, and after the last, the thing is in its
// own colours. Where each part is, and how much of it, is all worked out from how far
// through the guide the page is (see standing.ts).
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

import { UNDER_FROM, underlit } from "@/components/viewport/light"
import { EDGE, finish, skinColour } from "@/components/viewport/paint"
import { readModel, type Model, type Part } from "@/lib/model"
import type { Looks, Vec3 } from "@shared/api"
import type { Guide } from "@shared/assembly-format"
import { standing, towards } from "./standing"

/** How wide the camera's lens is, in degrees: the app's. */
const FOV = 30
/** Where the model is looked at from to begin with: front right, and down on it, as the app opens one. */
const HOME: Vec3 = [0.5, -0.62, 0.6]
/** How much room is left round the model, of the room it has: a little, for parts on their way in. */
const ROOM = 1.14
/**
 * How long a step takes to go on, in seconds; the camera to come round to a step's
 * view; and to come up to a step's parts.
 */
const STEP_TAKES = 0.9
const TURN_TAKES = 0.28
const NEARS_TAKES = 0.4
/**
 * How near the camera comes to the parts a step puts on: what it frames is this many
 * times as far across as they are, and this share of the whole thing more, so that
 * they are seen with what they go on to; and never less of the whole thing than `least`.
 * Parts that are all round the thing are as far across as it is, and it stays where
 * it was for them.
 */
const CLOSE = { times: 2.4, more: 0.12, least: 0.3 }
/** How far the view turns under a pull, in radians a pixel; and how close it is let get, and how far. */
const PULL = 0.006
const NEAR = { most: 4, least: 0.5 }
/**
 * How far off a part is before it goes on, where the guide does not say, as a share of
 * how far across the whole thing is: at the least, at the most, and where there is
 * nothing to go by. And never less than this many mm.
 */
const COMES_FROM = { least: 0.12, most: 0.45, share: 0.32, mm: 15 }
/**
 * How much further off than the model pulls a part, when it is pulled apart, the part
 * is before it goes on: a model is pulled apart a little way, to be seen into.
 */
const FURTHER = 1.5
/** How much of the way a part lies from the rest counts as none, beside the most of it. */
const ASIDE = 0.35
/** What a part that is on already is drawn in: its own colour, most of the way to this. */
const QUIET = { towards: new THREE.Color("#3c3e42"), by: 0.72 }
/** What a part the step is about is drawn in, and how much of its own light it gives off. */
const LIT = { colour: new THREE.Color("#ffffff"), glow: 0.3 }
/** How strong the lines of a part are: of one on already, and of one that is lit. */
const LINES = { quiet: 0.55, plain: 0.85 }
/**
 * How strongly the lines of a part that is lit show through whatever is in front of it:
 * a part that goes on inside the rest is still seen to go on, and where.
 */
const THROUGH = 0.22
/** Two triangles that meet at more than this, in degrees, have an edge between them. */
const CREASE = 20

// glTF is Y-up metres; the model is Z-up millimetres
const TO_MODEL = new THREE.Matrix4()
  .makeRotationX(Math.PI / 2)
  .multiply(new THREE.Matrix4().makeScale(1000, 1000, 1000))
/** The model's frame as the scene has it: its Z is up, and the scene's Y. */
const toWorld = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y)

/** One of the model's files: handed to the page with it, or asked for from beside it. */
async function fileOf(name: string): Promise<ArrayBuffer> {
  const handed = window.ENCLOSE_FILES?.[name]
  if (handed !== undefined) {
    const read = atob(handed)
    const bytes = new Uint8Array(read.length)
    for (let i = 0; i < read.length; i++) bytes[i] = read.charCodeAt(i)
    return bytes.buffer
  }
  const response = await fetch(
    `model/${name.split("/").map(encodeURIComponent).join("/")}`
  )
  if (!response.ok) throw new Error(`${name}: ${response.status}`)
  return response.arrayBuffer()
}

/** The colour a face came with, unless it is the loader's stand-in for "none given". */
function fileColour(
  material: THREE.Material | THREE.Material[]
): THREE.Color | null {
  const one = Array.isArray(material) ? material[0] : material
  const colour = (one as THREE.MeshStandardMaterial).color
  if (!colour || (colour.getHex() === 0xffffff && !one.name)) return null
  return colour.clone()
}

/** Three numbers to a corner, as plain ones, however the file packs them. */
function float3(
  from: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
) {
  const out = new Float32Array(from.count * 3)
  for (let i = 0; i < from.count; i++) {
    out[i * 3] = from.getX(i)
    out[i * 3 + 1] = from.getY(i)
    out[i * 3 + 2] = from.getZ(i)
  }
  return new THREE.BufferAttribute(out, 3)
}

/** The faces of a part that share a colour, joined into one mesh, in the model's own measure. */
function skinsOf(scene: THREE.Object3D, part: Part) {
  scene.updateMatrixWorld(true)
  const sorted = new Map<
    string,
    { color: THREE.Color | null; faces: THREE.BufferGeometry[] }
  >()
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const color = part.paint === "all" ? null : fileColour(mesh.material)
    const key = color ? color.getHexString() : "none"
    let same = sorted.get(key)
    if (!same) sorted.set(key, (same = { color, faces: [] }))
    // position, normal and index only, so that faces written differently can be joined
    const { position, normal } = mesh.geometry.attributes
    const face = new THREE.BufferGeometry()
    face.setAttribute("position", float3(position))
    if (normal) face.setAttribute("normal", float3(normal))
    face.setIndex(
      mesh.geometry.index
        ? Array.from(mesh.geometry.index.array)
        : Array.from({ length: position.count }, (_, i) => i)
    )
    face.applyMatrix4(TO_MODEL.clone().multiply(mesh.matrixWorld))
    if (!normal) face.computeVertexNormals()
    same.faces.push(face)
  })
  return [...sorted.values()].flatMap(({ color, faces }) => {
    const geometry = mergeGeometries(faces, false)
    for (const face of faces) face.dispose()
    return geometry ? [{ geometry, color }] : []
  })
}

/** A part as the page draws it. */
type Shown = {
  /** the step that puts it on, counted from 0: null of one that is there to begin with */
  step: number | null
  /** all of it, where the model has it: what is moved when it is on its way in */
  whole: THREE.Group
  home: THREE.Matrix4
  /** where the model says it goes when it is pulled apart, mm: nowhere, if it does not say */
  away: THREE.Vector3
  /** where it comes from, as how far that is from its place, mm (see comingFrom) */
  comes: THREE.Vector3
  /** the room it takes up, in the model, where the model has it */
  box: THREE.Box3
  surfaces: {
    material: THREE.MeshStandardMaterial
    /** its colour as the app draws it, and that colour as it is on a part that is quiet */
    own: THREE.Color
    quiet: THREE.Color
  }[]
  lines: THREE.LineBasicMaterial
  /** the same lines again, as they show through what is in front of the part */
  through: THREE.LineBasicMaterial
  /** made of something clear: seen through, however it stands */
  clear: boolean
}

/** How see-through a part made of something clear is. */
const CLEAR = 0.28

async function shownOf(
  part: Part,
  turn: number,
  chosen: string | null,
  step: number | null
): Promise<Shown> {
  const [gltf, edges] = await Promise.all([
    fileOf(part.file).then((file) => new GLTFLoader().parseAsync(file, "")),
    part.edges
      ? fileOf(part.edges).then(
          (file) => new Float32Array(file),
          () => null
        )
      : null,
  ])
  const skins = skinsOf(gltf.scene, part)
  const whole = new THREE.Group()
  whole.matrixAutoUpdate = false
  const box = new THREE.Box3()
  const lines = new THREE.LineBasicMaterial({
    color: EDGE,
    transparent: true,
    opacity: LINES.plain,
  })
  const through = new THREE.LineBasicMaterial({
    color: LIT.colour,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  })
  /** Its lines, drawn as they are and again as they show through the rest. */
  const lined = (geometry: THREE.BufferGeometry) => {
    const seen = new THREE.LineSegments(geometry, through)
    seen.renderOrder = 1
    whole.add(new THREE.LineSegments(geometry, lines), seen)
  }
  const surfaces = skins.map(({ geometry, color }) => {
    const own = skinColour({ part, turn }, { color }, true, chosen)
    const material = new THREE.MeshStandardMaterial({
      color: own,
      ...finish({ part }),
      side: THREE.DoubleSide,
      emissive: LIT.colour,
      emissiveIntensity: 0,
      // behind its own lines, which are drawn where its surfaces are
      polygonOffset: true,
      polygonOffsetFactor: 1.5,
      polygonOffsetUnits: 1.5,
    })
    whole.add(new THREE.Mesh(geometry, material))
    geometry.computeBoundingBox()
    box.union(geometry.boundingBox!)
    // the build's own edges, or failing those wherever its surfaces meet sharply
    if (!edges) lined(new THREE.EdgesGeometry(geometry, CREASE))
    return {
      material,
      own,
      quiet: own.clone().lerp(QUIET.towards, QUIET.by),
    }
  })
  if (edges) {
    const drawn = new THREE.BufferGeometry()
    drawn.setAttribute("position", new THREE.BufferAttribute(edges, 3))
    lined(drawn)
  }
  const home = new THREE.Matrix4()
  if (part.matrix)
    home.set(...(part.matrix as Parameters<THREE.Matrix4["set"]>))
  whole.matrix.copy(home)
  return {
    step,
    whole,
    home,
    away: new THREE.Vector3(...part.explode),
    comes: new THREE.Vector3(),
    box: box.applyMatrix4(home),
    surfaces,
    lines,
    through,
    clear: part.clear,
  }
}

/** The room the model has to itself in the page, as how much of each edge is taken up, in px. */
export type Room = { left: number; top: number; right: number; bottom: number }

export type Stage = {
  /** Go to a place in the guide (see standing.ts): at once, or going on through it. */
  go(to: number, atOnce?: boolean): void
  /** The room the model has to itself, when that changes. */
  give(room: Room): void
  /** Have done with it. */
  close(): void
}

/**
 * Says where each part comes from, in the model's own measure: where its step says,
 * which is the same for every part of the step. Where the step does not say, each
 * comes its own way in from outside: back along the way the model says it goes when it
 * is pulled apart, if the model says, and otherwise straight in towards the middle of
 * what is on by then. So four bolts through four legs come in from four sides. A part
 * with nothing on before it, or in the middle of the rest, comes down from above.
 */
function comingFrom(guide: Guide, shown: Map<string, Shown>, across: number) {
  const least = Math.max(COMES_FROM.mm, across * COMES_FROM.least)
  const most = Math.max(least, across * COMES_FROM.most)
  const far = Math.max(COMES_FROM.mm, across * COMES_FROM.share)
  const on = new THREE.Box3()
  for (const id of guide.already) {
    const part = shown.get(id)
    if (part) on.union(part.box)
  }
  for (const step of guide.steps) {
    const these = step.parts.flatMap((id) => shown.get(id) ?? [])
    for (const part of these) {
      if (step.from) {
        part.comes.set(...step.from)
        continue
      }
      if (part.away.lengthSq() > 1e-6) {
        const length = part.away.length() * FURTHER
        part.comes
          .copy(part.away)
          .setLength(THREE.MathUtils.clamp(length, least, most))
        continue
      }
      const out = on.isEmpty()
        ? new THREE.Vector3()
        : part.box
            .getCenter(new THREE.Vector3())
            .sub(on.getCenter(new THREE.Vector3()))
      // what is nearly along one of the model's axes is taken to be along it
      const [x, y, z] = out.toArray().map(Math.abs)
      const longest = Math.max(x, y, z)
      if (x < longest * ASIDE) out.x = 0
      if (y < longest * ASIDE) out.y = 0
      if (z < longest * ASIDE) out.z = 0
      if (longest < across * 0.02) out.set(0, 0, 1)
      part.comes.copy(out).setLength(far)
    }
    for (const part of these) on.union(part.box)
  }
}

/**
 * Draw a guide's model on a canvas. `progress` hears how many of its parts are loaded,
 * of how many, as they come. The parts are all there by the time this resolves.
 */
export async function stageOf(
  canvas: HTMLCanvasElement,
  told: { guide: Guide; model: unknown; looks: Looks },
  progress: (done: number, total: number) => void
): Promise<Stage> {
  const { guide, looks } = told
  let model: Model | null = null
  try {
    model = readModel(told.model)
  } catch {
    // a model with none of the guide's parts left in it: the steps are still to be read
  }
  const steps = guide.steps.length
  const stepOf = new Map<string, number | null>()
  for (const id of guide.already) stepOf.set(id, null)
  guide.steps.forEach((step, index) => {
    for (const id of step.parts) if (!stepOf.has(id)) stepOf.set(id, index)
  })
  const wanted = (model?.parts ?? []).filter((part) => stepOf.has(part.id))

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight("#ffffff", 0.55))
  scene.add(new THREE.HemisphereLight("#ffffff", "#7d828c", 0.7))
  const sun = new THREE.DirectionalLight("#ffffff", 1.7)
  sun.position.set(180, 320, 220)
  const fill = new THREE.DirectionalLight("#ffffff", 0.55)
  fill.position.set(-240, 160, -180)
  // and from under it, once it is looked up at from below (see light.ts)
  const under = new THREE.DirectionalLight("#ffffff", 0)
  under.position.set(...UNDER_FROM)
  scene.add(sun, fill, under)
  // everything in here is in the model's own measure, mm with Z up
  const root = new THREE.Group()
  root.rotation.set(-Math.PI / 2, 0, 0)
  scene.add(root)

  let done = 0
  progress(0, wanted.length)
  const shown = new Map<string, Shown>()
  await Promise.all(
    wanted.map(async (part) => {
      // its group's place among the groups: what gives a part with no colour one
      const turn = Math.max(
        0,
        model!.groups.findIndex((group) => group.id === part.group)
      )
      try {
        const one = await shownOf(
          part,
          turn,
          looks.colours[part.id] ?? null,
          stepOf.get(part.id) ?? null
        )
        shown.set(part.id, one)
        root.add(one.whole)
      } catch (error) {
        // the guide is read without it
        console.warn(`"${part.label}" could not be loaded.`, error)
      }
      progress(++done, wanted.length)
    })
  )

  // the room the parts take up between them, where the model has them
  const all = new THREE.Box3()
  for (const part of shown.values()) all.union(part.box)
  if (all.isEmpty()) all.set(new THREE.Vector3(), new THREE.Vector3())
  const across = all.getSize(new THREE.Vector3()).length()
  const radius = Math.max(across / 2, 1)
  const middle = toWorld(all.getCenter(new THREE.Vector3()).toArray())
  comingFrom(guide, shown, across)

  // What the camera frames at each step: the parts the step puts on, with room round
  // them, as far as that is less than all of the thing. It looks at the middle of
  // that: of the parts, where it has come right up to them, and of the thing where it
  // has not.
  type Framed = { middle: THREE.Vector3; radius: number }
  const whole: Framed = { middle, radius }
  const framed = guide.steps.map((step): Framed => {
    const these = new THREE.Box3()
    for (const id of step.parts) {
      const part = shown.get(id)
      if (part) these.union(part.box)
    }
    if (these.isEmpty()) return whole
    const round = THREE.MathUtils.clamp(
      (these.getSize(new THREE.Vector3()).length() / 2) * CLOSE.times +
        radius * CLOSE.more,
      radius * CLOSE.least,
      radius
    )
    const off = (round / radius - CLOSE.least) / (1 - CLOSE.least)
    return {
      middle: toWorld(these.getCenter(new THREE.Vector3()).toArray()).lerp(
        middle,
        off
      ),
      radius: round,
    }
  })
  /** What is framed at a place in the guide: all of the thing, before the steps and after. */
  const framedAt = (place: number) =>
    (place < steps ? framed[Math.round(place)] : undefined) ?? whole

  const camera = new THREE.PerspectiveCamera(FOV, 1, radius / 50, radius * 60)
  /** where the eye is, round the middle of the model: and where it is on its way to */
  const eye = new THREE.Spherical().setFromVector3(toWorld(HOME))
  const bound = new THREE.Spherical().copy(eye)
  let near = 1
  let room: Room = { left: 0, top: 0, right: 0, bottom: 0 }
  /** how far back the eye stands for what it frames, as so many times how far round that is */
  let back = 4
  /** what the camera frames, and what it is on its way to framing */
  const aim: Framed = { middle: middle.clone(), radius }
  let aimed = whole

  /** where the guide is, and where it is going */
  let at = -1
  let to = -1
  let dirty = true
  let pulled: { x: number; y: number } | null = null
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const size = () => {
    const [wide, high] = [window.innerWidth, window.innerHeight]
    renderer.setSize(wide, high, false)
    camera.aspect = wide / high
    // The model is in the middle of the room it has, which is not the middle of the
    // window: the picture is made of the window moved over by that much.
    const free = {
      wide: Math.max(1, wide - room.left - room.right),
      high: Math.max(1, high - room.top - room.bottom),
    }
    camera.setViewOffset(
      wide,
      high,
      (room.right - room.left) / 2,
      (room.bottom - room.top) / 2,
      wide,
      high
    )
    // and it stands far enough back for the model to fit the lesser way of that room
    const lens = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const least = Math.min(free.high, free.wide) / high
    back = ROOM / Math.sin(Math.atan(lens * least))
    dirty = true
  }

  const draw = () => {
    for (const part of shown.values()) {
      const { there, out, lit, own } = standing(at, part.step, steps)
      part.whole.visible = there > 0.01
      if (!part.whole.visible) continue
      part.whole.matrix.copy(part.home)
      if (out > 0) {
        part.whole.matrix.elements[12] += part.comes.x * out
        part.whole.matrix.elements[13] += part.comes.y * out
        part.whole.matrix.elements[14] += part.comes.z * out
      }
      // lit is for what a step is about: the thing whole has nothing picked out of it
      const light = lit * (1 - own)
      const through = there * (part.clear ? CLEAR : 1)
      for (const surface of part.surfaces) {
        surface.material.color
          .copy(surface.quiet)
          .lerp(surface.own, own)
          .lerp(LIT.colour, light)
        surface.material.emissiveIntensity = LIT.glow * light
        surface.material.opacity = through
        // (seen through, it hides nothing that is behind it)
        surface.material.transparent = through < 1
        surface.material.depthWrite = through >= 1
      }
      part.lines.opacity =
        there * (LINES.quiet + (LINES.plain - LINES.quiet) * Math.max(own, lit))
      part.through.opacity = there * light * THROUGH
      part.through.visible = part.through.opacity > 0.005
    }
    eye.radius = (aim.radius * back) / near
    camera.position.setFromSpherical(eye).add(aim.middle)
    camera.lookAt(aim.middle)
    camera.updateProjectionMatrix()
    under.intensity = underlit(camera)
    renderer.render(scene, camera)
  }

  let last = performance.now()
  let frame = 0
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    const seconds = Math.min(0.1, (now - last) / 1000)
    last = now
    if (at !== to) {
      at = still ? to : towards(at, to, seconds, STEP_TAKES)
      dirty = true
    }
    // the eye comes round to where it is bound for, the short way, and slows into it
    if (!pulled && (eye.theta !== bound.theta || eye.phi !== bound.phi)) {
      const share = still ? 1 : 1 - Math.exp(-seconds / TURN_TAKES)
      const round = Math.atan2(
        Math.sin(bound.theta - eye.theta),
        Math.cos(bound.theta - eye.theta)
      )
      const down = bound.phi - eye.phi
      if (Math.abs(round) + Math.abs(down) < 1e-3) {
        eye.theta = bound.theta
        eye.phi = bound.phi
      } else {
        eye.theta += round * share
        eye.phi += down * share
      }
      dirty = true
    }
    // and comes up to what the step puts on, or back off it, the same way
    if (aim.radius !== aimed.radius || !aim.middle.equals(aimed.middle)) {
      const share = still ? 1 : 1 - Math.exp(-seconds / NEARS_TAKES)
      if (
        Math.abs(aimed.radius - aim.radius) < radius * 1e-3 &&
        aim.middle.distanceTo(aimed.middle) < radius * 1e-3
      ) {
        aim.radius = aimed.radius
        aim.middle.copy(aimed.middle)
      } else {
        aim.radius += (aimed.radius - aim.radius) * share
        aim.middle.lerp(aimed.middle, share)
      }
      dirty = true
    }
    if (!dirty) return
    dirty = false
    draw()
  }

  /**
   * Where a place in the guide is looked at from: for a step, where it asks to be, or
   * the last step before it that asked; and for the thing whole, before the steps and
   * after them, where a model is looked at from to begin with.
   */
  const viewFor = (place: number) => {
    const upTo = place < steps ? Math.round(place) : -1
    for (let index = upTo; index >= 0; index--) {
      const view = guide.steps[index].view
      if (view) return toWorld(view)
    }
    return toWorld(HOME)
  }

  // The view is turned by taking hold of it: and stays as it was turned until a step
  // is gone to that is to be seen from somewhere else.
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return
    pulled = { x: event.clientX, y: event.clientY }
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add("pulled")
  }
  const move = (event: PointerEvent) => {
    if (!pulled) return
    eye.theta -= (event.clientX - pulled.x) * PULL
    eye.phi = THREE.MathUtils.clamp(
      eye.phi - (event.clientY - pulled.y) * PULL,
      0.02,
      Math.PI - 0.02
    )
    bound.copy(eye)
    pulled = { x: event.clientX, y: event.clientY }
    dirty = true
  }
  const up = () => {
    pulled = null
    canvas.classList.remove("pulled")
  }
  // A wheel goes through the guide, which is the page's: with the key held that a
  // pinch comes with, it brings the model nearer.
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    near = THREE.MathUtils.clamp(
      near * Math.exp(-event.deltaY * 0.01),
      NEAR.least,
      NEAR.most
    )
    dirty = true
  }
  canvas.addEventListener("pointerdown", down)
  canvas.addEventListener("pointermove", move)
  canvas.addEventListener("pointerup", up)
  canvas.addEventListener("pointercancel", up)
  canvas.addEventListener("wheel", wheel, { passive: false })
  window.addEventListener("resize", size)
  size()
  frame = requestAnimationFrame(tick)

  let seenFrom = viewFor(-1)
  return {
    go(place, atOnce = false) {
      to = place
      if (atOnce) at = place
      const view = viewFor(place)
      // (a step that asks for the view the last one had leaves it as the hand turned it)
      if (!view.equals(seenFrom)) {
        seenFrom = view
        bound.setFromVector3(view)
        bound.phi = THREE.MathUtils.clamp(bound.phi, 0.02, Math.PI - 0.02)
        if (atOnce) eye.copy(bound)
      }
      aimed = framedAt(place)
      if (atOnce) {
        aim.radius = aimed.radius
        aim.middle.copy(aimed.middle)
      }
      dirty = true
    },
    give(given) {
      room = given
      size()
    },
    close() {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", size)
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerup", up)
      canvas.removeEventListener("pointercancel", up)
      canvas.removeEventListener("wheel", wheel)
      renderer.dispose()
    },
  }
}
