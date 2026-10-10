import * as THREE from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { WINDOW } from './data'
import { makeGround } from './ground'
import { BUILT, type Look } from './look'

// The 3D view in the app's window on the page: the robot arm of the app's examples
// (public/model, packed by scripts/pack-model.mjs), drawn the way the app draws a
// model. Nothing here listens to the pointer. The page's scroll says how the model
// is to be looked at (a Look), and it is drawn once each time that changes.

// The colours parts are drawn in (the app's shared/palette.ts), and the order groups
// that give none are handed them in.
const PALETTE: Record<string, string> = {
  red: '#f19c9a',
  orange: '#f7cd9e',
  yellow: '#fdf6a3',
  lime: '#cffda2',
  green: '#b0fcc2',
  cyan: '#b0fcfe',
  blue: '#9eb7f9',
  indigo: '#a398f8',
  violet: '#d69af9',
  pink: '#f19cc9',
  white: '#fafafa',
  lightgrey: '#d4d4d4',
  grey: '#4b4b4b',
}
const IN_TURN = ['blue', 'orange', 'green', 'pink', 'cyan', 'yellow', 'violet', 'lime', 'red', 'indigo']
const METAL = '#c4c7cc'
const EDGE = '#0e1012'

// Where each joint is as built, and the line it turns about, in mm: the arm's own
// tool has these (examples/arm/tools/arm.js). A joint turns its link and every link
// further out.
const JOINTS = [
  { id: 'turn', link: 'shoulder', about: [-0.099, -7.543, 62.43], axis: [0, -0.0087, 1], way: 1 },
  { id: 'shoulder', link: 'upper-arm', about: [-13.654, -38.86, 119.757], axis: [-1, -0.0087, -0.0001], way: -1 },
  { id: 'elbow', link: 'lower-arm', about: [-12.143, 73.581, 148.473], axis: [-0.9999, -0.0086, -0.0088], way: 1 },
  { id: 'wrist', link: 'wrist', about: [-10.061, -60.577, 152.295], axis: [-0.9998, 0.0002, -0.0175], way: 1 },
  { id: 'roll', link: 'gripper', about: [7.062, -118.775, 152.082], axis: [0, -1, -0.0088], way: 1 },
  { id: 'grip', link: 'jaw', about: [22.765, -145.704, 172.057], axis: [1, -0.0001, 0.0087], way: 1 },
] as const

type Packed = {
  edgeBox: { min: number[]; max: number[] }
  /** the room the model takes, as it is built */
  box: { min: number[]; max: number[] }
  groups: { id: string; label: string }[]
  parts: {
    id: string
    group: string
    color: string | null
    metal: boolean
    explode: number[]
    edges: [number, number]
  }[]
}

// glTF is Y-up metres; the model is Z-up millimetres
const TO_MODEL = new THREE.Matrix4()
  .makeRotationX(Math.PI / 2)
  .multiply(new THREE.Matrix4().makeScale(1000, 1000, 1000))

const RADIANS = Math.PI / 180
const FOV = 30

export type View = {
  draw: (look: Look) => void
  /** how many of the screen's pixels there are to one of the window's */
  sharpen: (ratio: number) => void
  dispose: () => void
}

export async function openView(canvas: HTMLCanvasElement, ratio: number): Promise<View> {
  const at = (file: string) => `/model/${file}`
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [packed, lines, gltf] = await Promise.all([
    fetch(at('arm.json')).then((response) => response.json() as Promise<Packed>),
    fetch(at('arm.edges.bin')).then(async (response) => new Uint16Array(await response.arrayBuffer())),
    loader.loadAsync(at('arm.glb')),
  ])

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.setPixelRatio(ratio)
  renderer.setSize(WINDOW.width, WINDOW.height, false)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, WINDOW.width / WINDOW.height, 1, 10000)
  camera.up.set(0, 0, 1)

  scene.add(new THREE.AmbientLight('#ffffff', 0.55))
  scene.add(new THREE.HemisphereLight('#ffffff', '#7d828c', 0.7))
  // the lights go round with the eye, as they do in the app: see `draw`
  const key = new THREE.DirectionalLight('#ffffff', 1.7)
  const fill = new THREE.DirectionalLight('#ffffff', 0.55)
  scene.add(key, fill)

  // ── the parts ───────────────────────────────────────────────────────────
  const colours = new Map<string, THREE.MeshStandardMaterial>()
  const surface = (colour: string, metal: boolean, cable: boolean) => {
    const name = `${colour}${metal ? ':metal' : ''}${cable ? ':cable' : ''}`
    let material = colours.get(name)
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: colour,
        metalness: metal ? 0.55 : 0.1,
        roughness: metal ? 0.45 : 0.62,
        side: THREE.DoubleSide,
        // behind its own edges, which are drawn on it
        polygonOffset: true,
        polygonOffsetFactor: 1.5,
        polygonOffsetUnits: 1.5,
        transparent: cable,
      })
      colours.set(name, material)
    }
    return material
  }
  const ink = (cable: boolean) =>
    new LineMaterial({
      color: EDGE,
      // in the window's px: the page scales the window, and its lines with it
      linewidth: 1,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      resolution: new THREE.Vector2(WINDOW.width, WINDOW.height),
      userData: { cable },
    })
  const edgeInk = ink(false)
  const cableInk = ink(true)

  const found = new Map<string, THREE.Mesh>()
  gltf.scene.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    // a part's node is named for it: the mesh is that node, or just under it
    const name = packed.parts.some((part) => part.id === mesh.name)
      ? mesh.name
      : (mesh.parent?.name ?? mesh.name)
    found.set(name, mesh)
  })

  const { min, max } = packed.edgeBox
  const span = min.map((low, axis) => (max[axis] - low) / 65535)
  const model = new THREE.Group()
  const box = new THREE.Box3(
    new THREE.Vector3(...packed.box.min),
    new THREE.Vector3(...packed.box.max),
  )
  const parts = packed.parts.flatMap((part) => {
    const mesh = found.get(part.id)
    if (!mesh) return []
    const cable = part.group === 'cables'
    const group = packed.groups.findIndex((one) => one.id === part.group)
    const colour = part.metal
      ? METAL
      : PALETTE[part.color ?? IN_TURN[Math.max(group, 0) % IN_TURN.length]] ?? part.color!

    const object = new THREE.Group()
    object.matrixAutoUpdate = false
    // (its corners are packed as whole numbers, which moving them here would spoil:
    // the mesh is turned to the model's frame instead)
    const skin = new THREE.Mesh(mesh.geometry, surface(colour, part.metal, cable))
    skin.matrixAutoUpdate = false
    skin.matrix.copy(TO_MODEL)
    object.add(skin)

    const [first, count] = part.edges
    if (count > 0) {
      const positions = new Float32Array(count * 6)
      for (let i = 0; i < positions.length; i++)
        positions[i] = min[i % 3] + lines[first * 6 + i] * span[i % 3]
      const drawn = new LineSegments2(
        new LineSegmentsGeometry().setPositions(positions),
        cable ? cableInk : edgeInk,
      )
      drawn.renderOrder = 1
      object.add(drawn)
    }
    model.add(object)
    return [{ object, cable, link: part.group, explode: new THREE.Vector3(...part.explode) }]
  })
  scene.add(model)

  const middle = box.getCenter(new THREE.Vector3())
  const radius = box.getSize(new THREE.Vector3()).length() / 2

  // ── the ground ──────────────────────────────────────────────────────────
  // (and the world's axes: the model is built on the ground, about where they meet)
  const ground = makeGround(ratio, { x: '#ff0033', y: '#74d908', z: '#0f73ff' })
  scene.add(...ground.objects)

  // ── a frame ─────────────────────────────────────────────────────────────
  const turned = new Map<string, THREE.Matrix4>()
  const chain = JOINTS.map((joint) => ({
    ...joint,
    about: new THREE.Vector3(...joint.about),
    axis: new THREE.Vector3(...joint.axis).normalize(),
  }))
  const still = new THREE.Matrix4()
  const moved = new THREE.Matrix4()
  const there = new THREE.Matrix4()
  const back = new THREE.Matrix4()
  const turn = new THREE.Matrix4()
  const eye = new THREE.Vector3()
  const right = new THREE.Vector3()

  const draw = (look: Look) => {
    // Each joint turns its link and all that the link carries: so a link is turned
    // by every joint from the base out to its own, the innermost last.
    moved.identity()
    for (const joint of chain) {
      const by = joint.id === 'grip' ? BUILT - look.grip : look[joint.id]
      there.makeTranslation(joint.about.x, joint.about.y, joint.about.z)
      back.makeTranslation(-joint.about.x, -joint.about.y, -joint.about.z)
      turn.makeRotationAxis(joint.axis, joint.way * by * RADIANS)
      moved.multiply(there).multiply(turn).multiply(back)
      turned.set(joint.link, moved.clone())
    }
    for (const part of parts) {
      part.object.matrix
        .copy(turned.get(part.link) ?? still)
        .multiply(there.makeTranslation(
          part.explode.x * look.apart,
          part.explode.y * look.apart,
          part.explode.z * look.apart,
        ))
      part.object.visible = !part.cable || look.cables > 0.01
    }
    for (const material of colours.values())
      if (material.transparent) material.opacity = look.cables
    cableInk.opacity = 0.85 * look.cables
    ground.show(look.grid)

    const around = look.azimuth * RADIANS
    const above = look.elevation * RADIANS
    eye.set(
      Math.cos(around) * Math.cos(above),
      Math.sin(around) * Math.cos(above),
      Math.sin(above),
    )
    camera.position.copy(middle).addScaledVector(eye, radius * look.distance)
    camera.near = radius * 0.2
    camera.far = radius * (look.distance + 8)
    camera.lookAt(middle)
    // the model's middle is not the window's: the conversation is over one side of it
    camera.setViewOffset(
      WINDOW.width,
      WINDOW.height,
      WINDOW.width / 2 - look.x,
      WINDOW.height / 2 - look.y,
      WINDOW.width,
      WINDOW.height,
    )
    // lit from over the eye's left shoulder, and a little from behind on the right
    right.crossVectors(eye, camera.up).normalize()
    key.position.copy(eye).multiplyScalar(0.7).addScaledVector(right, 0.5).add(new THREE.Vector3(0, 0, 0.9))
    fill.position.copy(eye).multiplyScalar(-0.6).addScaledVector(right, -0.7).add(new THREE.Vector3(0, 0, 0.4))
    renderer.render(scene, camera)
  }

  return {
    draw,
    sharpen(next) {
      ground.sharpen(next)
      renderer.setPixelRatio(next)
      renderer.setSize(WINDOW.width, WINDOW.height, false)
    },
    dispose() {
      for (const part of parts)
        part.object.traverse((node) => (node as THREE.Mesh).geometry?.dispose())
      for (const material of colours.values()) material.dispose()
      edgeInk.dispose()
      cableInk.dispose()
      ground.dispose()
      renderer.dispose()
    },
  }
}
