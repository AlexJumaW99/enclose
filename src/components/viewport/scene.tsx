import * as React from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { CameraControls, Edges } from "@react-three/drei"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { acceleratedRaycast } from "three-mesh-bvh"

import type { PartRef, Vec3 } from "@shared/api"
import { useThemeColors, type ThemeColors } from "@/lib/css-color"
import type { Keepout } from "@/lib/model"
import type { Clip, Selection, View } from "@/lib/store"
import { bridge } from "./bridge"
import type { LoadedModel, LoadedPart } from "./load"

// The model is Z-up; three.js is Y-up. Everything inside the root group is in model mm.
const MODEL_TO_WORLD: [number, number, number] = [-Math.PI / 2, 0, 0]
const toWorld = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.z, -v.y)

/** Where the camera sits when a model opens: front right, looking down on it. */
const HOME_DIRECTION = new THREE.Vector3(0.5, -0.62, 0.6).normalize()
const FOV = 30

const UNCOLOURED = "#aeb2b9"
// near-black metal would vanish on the dark theme; it goes steel instead
const STEEL = "#aab0b8"
const EDGE = "#0e1012"
// surfaces sit a hair back in the depth buffer so their own edges win cleanly
const BEHIND_EDGES = {
  polygonOffset: true,
  polygonOffsetFactor: 1.5,
  polygonOffsetUnits: 1.5,
}
const NO_CLIP = { normal: new THREE.Vector3(0, 1, 0), constant: 1e6 }
const AXIS: Record<Clip["axis"], THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 0, -1),
  z: new THREE.Vector3(0, 1, 0),
}
/** A shell part smaller than this share of the model stays solid in glass mode: buttons, feet. */
const GLASS_FROM = 0.25
// drawn in this order, so what is behind glass is tinted by it and the glass keeps its outline
const ORDER = { solid: 0, edges: 1, glass: 2, glassEdges: 3, keepouts: 4 }

/** Whether a part is drawn at all, and whether it is see-through, under the current view. */
export function appearance(loaded: LoadedPart, model: LoadedModel, view: View) {
  const layer = model.model.layers.find((l) => l.id === loaded.part.layer)
  if (layer?.control === "toggle")
    return { shown: !view.off[layer.id], glass: false }
  // the parts of a shell layer that the solid / glass / hidden control acts on
  const shell =
    layer?.control === "shell" &&
    (loaded.part.glass ??
      loaded.box.getSize(new THREE.Vector3()).length() >=
        model.box.getSize(new THREE.Vector3()).length() * GLASS_FROM)
  return {
    shown: !(shell && view.shell === "hidden"),
    glass: shell && view.shell === "glass",
  }
}

const PartModel = React.memo(function PartModel({
  loaded,
  glass,
  hovered,
  selected,
  explode,
  plane,
  colors,
}: {
  loaded: LoadedPart
  glass: boolean
  hovered: boolean
  selected: boolean
  explode: number
  plane: THREE.Plane
  colors: ThemeColors
}) {
  const { part } = loaded
  const group = React.useRef<THREE.Group>(null)
  const invalidate = useThree((state) => state.invalidate)

  const home = React.useMemo(() => {
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    loaded.home.decompose(position, quaternion, new THREE.Vector3())
    return { position, quaternion, away: new THREE.Vector3(...part.explode) }
  }, [loaded.home, part.explode])

  const planes = React.useMemo(() => [plane], [plane])
  const skinColors = React.useMemo(
    () =>
      loaded.skins.map((skin) => {
        const color = new THREE.Color(part.color ?? UNCOLOURED)
        if (part.paint === "bare" && skin.color) color.copy(skin.color)
        if (
          part.metal &&
          colors.dark &&
          color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.25
        )
          color.set(STEEL)
        return color
      }),
    [loaded.skins, part, colors.dark]
  )

  const lines = React.useMemo(() => {
    if (!loaded.edges) return null
    const geometry = new LineSegmentsGeometry().setPositions(loaded.edges)
    const material = new LineMaterial({
      linewidth: 1, // screen pixels
      transparent: true,
      depthWrite: false,
      clippingPlanes: [plane],
    })
    const object = new LineSegments2(geometry, material)
    // edges are for looking at; picking goes by the surfaces
    object.raycast = () => {}
    return object
  }, [loaded.edges, plane])
  React.useEffect(
    () => () => {
      lines?.geometry.dispose()
      lines?.material.dispose()
    },
    [lines]
  )

  // every part eases the explode at the same rate, so they stay in step
  const current = React.useRef(explode)
  React.useEffect(() => invalidate(), [explode, invalidate])
  useFrame((_, delta) => {
    if (!group.current) return
    const next = THREE.MathUtils.damp(
      current.current,
      explode,
      9,
      Math.min(delta, 0.05)
    )
    const moving = Math.abs(next - explode) > 0.0005
    current.current = moving ? next : explode
    group.current.position
      .copy(home.position)
      .addScaledVector(home.away, current.current)
    group.current.quaternion.copy(home.quaternion)
    if (moving) invalidate()
  })

  return (
    <group ref={group}>
      {loaded.skins.map((skin, index) => (
        <mesh
          key={index}
          geometry={skin.geometry}
          raycast={acceleratedRaycast}
          renderOrder={glass ? ORDER.glass : ORDER.solid}
          userData={{ partId: part.id, skin: index, glass }}
        >
          {/* hover and selection only retint what is already there */}
          <meshStandardMaterial
            color={skinColors[index]}
            metalness={part.metal ? 0.55 : 0.1}
            roughness={part.metal ? 0.45 : 0.62}
            side={THREE.DoubleSide}
            clippingPlanes={planes}
            {...BEHIND_EDGES}
            transparent={glass}
            depthWrite={!glass}
            opacity={!glass ? 1 : selected ? 0.4 : hovered ? 0.28 : 0.2}
            emissive={colors.selection}
            emissiveIntensity={selected ? 0.16 : hovered ? 0.07 : 0}
          />
        </mesh>
      ))}
      {lines && (
        <primitive
          object={lines}
          renderOrder={glass ? ORDER.glassEdges : ORDER.edges}
        >
          <primitive
            object={lines.material}
            attach="material"
            color={selected ? colors.selection : EDGE}
            opacity={selected ? 1 : glass ? 0.28 : 0.85}
          />
        </primitive>
      )}
    </group>
  )
})

function KeepoutBox({
  keepout,
  colors,
}: {
  keepout: Keepout
  colors: ThemeColors
}) {
  const size = keepout.max.map((v, i) => v - keepout.min[i]) as Vec3
  const center = keepout.max.map((v, i) => (v + keepout.min[i]) / 2) as Vec3
  const color = keepout.blocked ? colors.destructive : colors.muted
  return (
    <mesh position={center} renderOrder={ORDER.keepouts} raycast={() => {}}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={keepout.blocked ? 0.26 : 0.1}
        depthWrite={false}
      />
      <Edges color={color} lineWidth={keepout.blocked ? 1.5 : 1} />
    </mesh>
  )
}

/** The camera: orbit, pan, zoom, and a home view that frames the whole model. */
function Rig({ box, homeKey }: { box: THREE.Box3; homeKey: string }) {
  const controls = React.useRef<CameraControls>(null)
  const latest = React.useRef(box)
  React.useEffect(() => {
    latest.current = box
  }, [box])
  const radius = box.getSize(new THREE.Vector3()).length() / 2
  const first = React.useRef(true)

  const size = useThree((state) => state.size)
  const aspect = size.width / size.height
  // true until the user moves the camera themselves
  const atHome = React.useRef(true)

  const frame = React.useCallback((animate: boolean, ratio: number) => {
    const reach = latest.current.getSize(new THREE.Vector3()).length() / 2
    const target = toWorld(latest.current.getCenter(new THREE.Vector3()))
    // fit the narrower of the view's two angles, so a tall window does not crop the sides
    const vertical = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const angle = Math.atan(Math.min(vertical, vertical * ratio))
    // a little inside the bounding sphere: models are rarely as tall as they are wide
    const distance = (reach / Math.sin(angle)) * 0.94
    const eye = toWorld(HOME_DIRECTION).multiplyScalar(distance).add(target)
    // sit the model a little above centre, clear of the toolbar along the bottom
    const forward = target.clone().sub(eye).normalize()
    const right = forward
      .clone()
      .cross(new THREE.Vector3(0, 1, 0))
      .normalize()
    const lift = right
      .cross(forward)
      .multiplyScalar(-0.07 * distance * vertical)
    eye.add(lift)
    target.add(lift)
    void controls.current?.setLookAt(
      eye.x,
      eye.y,
      eye.z,
      target.x,
      target.y,
      target.z,
      animate
    )
    atHome.current = true
  }, [])

  // reframes when a different model opens or home is asked for - not when the same
  // model is rebuilt, which should not move the camera
  const shape = React.useRef(aspect)
  React.useEffect(() => {
    frame(!first.current, shape.current)
    first.current = false
  }, [homeKey, frame])

  // the view changed shape (a panel opened, the window was resized): keep the model
  // framed, unless the user has already chosen their own angle
  React.useEffect(() => {
    shape.current = aspect
    if (atHome.current && !first.current) frame(false, aspect)
  }, [aspect, frame])

  return (
    <CameraControls
      ref={controls}
      makeDefault
      onStart={() => {
        atHome.current = false
      }}
      minDistance={radius * 0.15}
      maxDistance={radius * 14}
      smoothTime={0.3}
      draggingSmoothTime={0.08}
    />
  )
}

function Section({ plane, clip }: { plane: THREE.Plane; clip: Clip | null }) {
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => {
    if (!clip) plane.set(NO_CLIP.normal, NO_CLIP.constant)
    else
      plane.set(
        AXIS[clip.axis].clone().multiplyScalar(clip.side),
        -clip.side * clip.at
      )
    invalidate()
  }, [clip, plane, invalidate])
  return null
}

/**
 * Finding the part under the pointer. Glass is see-through for clicks too: what is
 * behind it is picked first, and the glass itself only when nothing else is there.
 */
function Picker({
  root,
  loaded,
  plane,
  onHover,
  onPick,
}: {
  root: React.RefObject<THREE.Group | null>
  loaded: LoadedModel
  plane: THREE.Plane
  onHover: (partId: string | null) => void
  onPick: (selection: Selection | null) => void
}) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const raycaster = useThree((state) => state.raycaster)

  React.useEffect(() => {
    const canvas = gl.domElement
    const pointer = new THREE.Vector2()
    let pressed: { x: number; y: number } | null = null

    const cast = (event: MouseEvent) => {
      if (!root.current) return null
      const rect = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(pointer, camera)
      const meshes: THREE.Object3D[] = []
      root.current.traverse((object) => {
        if ((object as THREE.Mesh).isMesh && object.userData.partId)
          meshes.push(object)
      })
      const hits = raycaster
        .intersectObjects(meshes, false)
        // what the section has cut away is not there to be clicked
        .filter((hit) => plane.distanceToPoint(hit.point) >= 0)
      return hits.find((hit) => !hit.object.userData.glass) ?? hits[0] ?? null
    }

    const describe = (hit: THREE.Intersection): PartRef | null => {
      const part = loaded.parts.find(
        (p) => p.part.id === hit.object.userData.partId
      )
      if (!part) return null
      const skin = part.skins[hit.object.userData.skin as number]
      // out of the exploded, on-screen position and back to where the part really sits
      const point = hit.object
        .worldToLocal(hit.point.clone())
        .applyMatrix4(part.home)
      const normal =
        hit.face?.normal.clone().transformDirection(part.home) ?? null
      const round = (v: THREE.Vector3): Vec3 =>
        [v.x, v.y, v.z].map((n) => Math.round(n * 100) / 100) as Vec3
      return {
        id: part.part.id,
        label: part.part.label,
        point: round(point),
        normal: normal && round(normal),
        face:
          hit.faceIndex == null ? null : (skin?.faceOf[hit.faceIndex] ?? null),
      }
    }

    const down = (event: PointerEvent) => {
      pressed = { x: event.clientX, y: event.clientY }
    }
    const move = (event: PointerEvent) => {
      if (event.buttons !== 0) return // orbiting, not pointing
      const hit = cast(event)
      onHover((hit?.object.userData.partId as string | undefined) ?? null)
    }
    const leave = () => onHover(null)
    const click = (event: MouseEvent) => {
      // the end of a drag is not a click
      if (
        pressed &&
        Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 4
      )
        return
      const hit = cast(event)
      const part = hit && describe(hit)
      onPick(part ? { part, x: event.clientX, y: event.clientY } : null)
    }

    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerleave", leave)
    canvas.addEventListener("click", click)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerleave", leave)
      canvas.removeEventListener("click", click)
    }
  }, [gl, camera, raycaster, root, loaded, plane, onHover, onPick])

  return null
}

/** Lets the rest of the window take a picture of the view. */
function Camera() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  React.useEffect(() => {
    bridge.screenshot = () => {
      gl.render(scene, camera)
      const source = gl.domElement
      // as large as an image needs to be for Claude to read it, and no larger
      const scale = Math.min(1, 1568 / Math.max(source.width, source.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(source.width * scale)
      canvas.height = Math.round(source.height * scale)
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Could not read the viewport.")
      // the view is drawn over the window's background, so the picture needs it too
      context.fillStyle = getComputedStyle(
        document.getElementById("root")!.firstElementChild!
      ).backgroundColor
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      return {
        data: canvas.toDataURL("image/jpeg", 0.85).split(",")[1],
        mimeType: "image/jpeg",
      }
    }
    return () => {
      bridge.screenshot = null
    }
  }, [gl, scene, camera])
  return null
}

export function Scene({
  loaded,
  view,
  selectedId,
  homeKey,
  onPick,
}: {
  loaded: LoadedModel
  view: View
  selectedId: string | null
  /** changes when the camera should go back to its home view */
  homeKey: string
  onPick: (selection: Selection | null) => void
}) {
  const colors = useThemeColors()
  const root = React.useRef<THREE.Group>(null)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const plane = React.useMemo(
    () => new THREE.Plane(NO_CLIP.normal.clone(), NO_CLIP.constant),
    []
  )
  const radius = loaded.box.getSize(new THREE.Vector3()).length() / 2

  return (
    <Canvas
      className={hovered ? "cursor-pointer" : undefined}
      frameloop="demand"
      camera={{
        fov: FOV,
        near: radius / 40,
        far: radius * 80,
        position: [radius * 3, radius * 3, radius * 3],
      }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
      }}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffffff", "#7d828c", 0.7]} />
      <directionalLight position={[180, 320, 220]} intensity={1.7} />
      <directionalLight position={[-240, 160, -180]} intensity={0.55} />
      <Rig box={loaded.box} homeKey={homeKey} />
      <Section plane={plane} clip={view.clip} />
      <Picker
        root={root}
        loaded={loaded}
        plane={plane}
        onHover={setHovered}
        onPick={onPick}
      />
      <Camera />
      <group ref={root} rotation={MODEL_TO_WORLD}>
        {loaded.parts.map((part) => {
          const { shown, glass } = appearance(part, loaded, view)
          if (!shown) return null
          return (
            <PartModel
              key={part.part.id}
              loaded={part}
              glass={glass}
              hovered={hovered === part.part.id}
              selected={selectedId === part.part.id}
              explode={view.explode}
              plane={plane}
              colors={colors}
            />
          )
        })}
        {/* keep-outs mark where things sit assembled; pulled apart they'd mislead */}
        {view.keepouts &&
          view.explode === 0 &&
          loaded.model.keepouts.map((keepout) => (
            <KeepoutBox key={keepout.id} keepout={keepout} colors={colors} />
          ))}
      </group>
    </Canvas>
  )
}
