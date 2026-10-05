import * as React from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  CameraControls,
  CameraControlsImpl,
  Edges,
  PivotControls,
} from "@react-three/drei"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { acceleratedRaycast } from "three-mesh-bvh"

import type { PartRef, Vec3 } from "@shared/api"
import { useThemeColors, type ThemeColors } from "@/lib/css-color"
import type { Keepout } from "@/lib/model"
import { nearestTurn, viewFrom, type Turn } from "@/lib/orient"
import type { Section, Selection, View } from "@/lib/store"
import { bridge, publishOrientation } from "./bridge"
import type { LoadedModel, LoadedPart } from "./load"

// The model is Z-up; three.js is Y-up. Everything inside the root group is in model mm.
const MODEL_TO_WORLD: [number, number, number] = [-Math.PI / 2, 0, 0]
const MODEL_TO_WORLD_TURN = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(...MODEL_TO_WORLD)
)
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
const ONE = new THREE.Vector3(1, 1, 1)
/** A shell part smaller than this share of the model stays solid in glass mode: buttons, feet. */
const GLASS_FROM = 0.25
// drawn in this order, so what is behind glass is tinted by it and the glass keeps its outline
const ORDER = { solid: 0, edges: 1, glass: 2, glassEdges: 3, keepouts: 4 }

/** solid: opaque. glass: see-through. wire: edges only. */
type Look = "solid" | "glass" | "wire"

/** Whether a part is drawn at all, and how, under the current view. */
export function appearance(
  loaded: LoadedPart,
  model: LoadedModel,
  view: View
): { shown: boolean; look: Look } {
  const shown = !view.hidden[loaded.part.id]
  if (view.mode === "wireframe") return { shown, look: "wire" }
  if (view.mode === "solid") return { shown, look: "solid" }
  // Glass is for seeing inside: only the outside goes see-through. A model that does
  // not say which parts are its outside goes see-through as a whole.
  const shells = model.model.layers.filter((layer) => layer.shell)
  if (shells.length === 0) return { shown, look: "glass" }
  const outside =
    shells.some((layer) => layer.id === loaded.part.layer) &&
    (loaded.part.glass ??
      loaded.box.getSize(new THREE.Vector3()).length() >=
        model.box.getSize(new THREE.Vector3()).length() * GLASS_FROM)
  return { shown, look: outside ? "glass" : "solid" }
}

const PartModel = React.memo(function PartModel({
  loaded,
  look,
  hovered,
  selected,
  explode,
  plane,
  colors,
}: {
  loaded: LoadedPart
  look: Look
  hovered: boolean
  selected: boolean
  /** how far along its way out the part is: 0 assembled, 1 the model's own distance */
  explode: number
  plane: THREE.Plane
  colors: ThemeColors
}) {
  const { part } = loaded
  const group = React.useRef<THREE.Group>(null)
  const invalidate = useThree((state) => state.invalidate)
  const glass = look === "glass"
  const wire = look === "wire"

  const home = React.useMemo(() => {
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    loaded.home.decompose(position, quaternion, new THREE.Vector3())
    return { position, quaternion }
  }, [loaded.home])

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
      lines.geometry.dispose()
      lines.material.dispose()
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
      .addScaledVector(loaded.away, current.current)
    group.current.quaternion.copy(home.quaternion)
    if (moving) invalidate()
  })

  // With no surfaces drawn there is nothing light for a dark line to show against, so in
  // wireframe the edges take the text colour instead.
  const lit = selected || (wire && hovered)
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
          {/* hover and selection only retint what is already there; in wireframe the
              surfaces are not drawn, but are still what a click lands on */}
          <meshStandardMaterial
            visible={!wire}
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
      <primitive
        object={lines}
        renderOrder={glass ? ORDER.glassEdges : ORDER.edges}
      >
        <primitive
          object={lines.material}
          attach="material"
          color={lit ? colors.selection : wire ? colors.foreground : EDGE}
          opacity={selected ? 1 : glass ? 0.28 : wire ? 0.6 : 0.85}
        />
      </primitive>
    </group>
  )
})

function KeepoutBox({
  keepout,
  plane,
  colors,
}: {
  keepout: Keepout
  plane: THREE.Plane
  colors: ThemeColors
}) {
  const planes = React.useMemo(() => [plane], [plane])
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
        clippingPlanes={planes}
      />
      <Edges
        color={color}
        lineWidth={keepout.blocked ? 1.5 : 1}
        clippingPlanes={planes}
      />
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

  // Holding Shift turns orbiting into panning: for a drag, and for a two-finger scroll
  // on a trackpad, which otherwise zooms.
  const gl = useThree((state) => state.gl)
  React.useEffect(() => {
    const around = gl.domElement.parentElement
    if (!around) return
    const { ACTION } = CameraControlsImpl
    const choose = (event: WheelEvent | PointerEvent) => {
      const { mouseButtons } = controls.current ?? {}
      if (!mouseButtons) return
      mouseButtons.left = event.shiftKey ? ACTION.TRUCK : ACTION.ROTATE
      mouseButtons.wheel = event.shiftKey ? ACTION.TRUCK : ACTION.DOLLY
    }
    // capturing, one element up: this runs before the controls' own listeners on the canvas
    around.addEventListener("wheel", choose, { capture: true, passive: true })
    around.addEventListener("pointerdown", choose, { capture: true })
    return () => {
      around.removeEventListener("wheel", choose, { capture: true })
      around.removeEventListener("pointerdown", choose, { capture: true })
    }
  }, [gl])

  // what the axis gizmo and the section planes, drawn outside the view, turn the camera with
  React.useEffect(() => {
    bridge.lookFrom = (axis, sign) => {
      const camera = controls.current
      if (!camera) return
      const { azimuth, polar } = viewFrom(axis, sign)
      atHome.current = false
      void camera.rotateTo(
        nearestTurn(camera.azimuthAngle, azimuth),
        polar,
        true
      )
    }
    bridge.orbit = (dx, dy) => {
      atHome.current = false
      void controls.current?.rotate(-dx * 0.012, -dy * 0.012, false)
    }
    bridge.eye = () => {
      const camera = controls.current
      if (!camera) return [0, -1, 0]
      const eye = camera
        .getPosition(new THREE.Vector3())
        .sub(camera.getTarget(new THREE.Vector3()))
        .normalize()
      return [eye.x, -eye.z, eye.y]
    }
    return () => {
      bridge.lookFrom = bridge.orbit = bridge.eye = null
    }
  }, [])

  // tell those widgets how the camera is turned, every frame it is drawn
  const scratch = React.useMemo(() => new THREE.Quaternion(), [])
  useFrame(({ camera }) => {
    publishOrientation(
      scratch.copy(camera.quaternion).invert().multiply(MODEL_TO_WORLD_TURN)
    )
  })

  return (
    <CameraControls
      ref={controls}
      makeDefault
      onControl={() => {
        atHome.current = false
      }}
      minDistance={radius * 0.15}
      maxDistance={radius * 14}
      smoothTime={0.3}
      draggingSmoothTime={0.08}
    />
  )
}

/** Hides everything on one side of the section, by setting the plane every part clips against. */
function Cut({
  plane,
  section,
}: {
  plane: THREE.Plane
  section: Section | null
}) {
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => {
    if (!section) plane.set(NO_CLIP.normal, NO_CLIP.constant)
    else {
      const kept = new THREE.Vector3(
        0,
        0,
        section.flipped ? -1 : 1
      ).applyQuaternion(new THREE.Quaternion(...section.turn))
      plane.setFromNormalAndCoplanarPoint(
        toWorld(kept),
        toWorld(new THREE.Vector3(...section.position))
      )
    }
    invalidate()
  }, [section, plane, invalidate])
  return null
}

/**
 * The section's handle, where it cuts: an arrow to push the cut through the model, and
 * two arcs to tilt it. Drawn at a constant size on screen, over everything.
 */
function SectionHandle({
  section,
  reach,
  colors,
  onChange,
}: {
  section: Section
  reach: number
  colors: ThemeColors
  onChange: (moved: { position: Vec3; turn: Turn }) => void
}) {
  const matrix = React.useMemo(
    () =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(...section.position),
        new THREE.Quaternion(...section.turn),
        ONE
      ),
    [section.position, section.turn]
  )
  const drag = React.useMemo(() => {
    const position = new THREE.Vector3()
    const turn = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    return (local: THREE.Matrix4) => {
      local.decompose(position, turn, scale)
      onChange({
        position: position.toArray(),
        turn: [turn.x, turn.y, turn.z, turn.w],
      })
    }
  }, [onChange])

  const line = `#${colors.foreground.getHexString()}`
  const shared = {
    matrix,
    autoTransform: false,
    fixed: true,
    scale: 78,
    lineWidth: 3,
    depthTest: false,
    disableSliders: true,
    disableScaling: true,
    axisColors: [line, line, line] as [string, string, string],
    hoveredColor: `#${colors.selection.getHexString()}`,
    onDrag: drag,
    onDragStart: () => {
      bridge.handling = true
    },
    // the click that ends the drag is still on its way
    onDragEnd: () => {
      setTimeout(() => {
        bridge.handling = false
      }, 0)
    },
  }
  return (
    <>
      {/* a faint square where the cut is, so its tilt can be read at a glance */}
      <mesh
        matrix={matrix}
        matrixAutoUpdate={false}
        renderOrder={ORDER.keepouts}
        raycast={() => {}}
      >
        <planeGeometry args={[reach * 0.85, reach * 0.85]} />
        <meshBasicMaterial
          color={colors.selection}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
        <Edges color={colors.selection} lineWidth={1} />
      </mesh>
      {/* three handles sharing one position: along the cut's normal, and about each of
          the two directions that lie in it */}
      <PivotControls
        {...shared}
        activeAxes={[false, false, true]}
        disableRotations
      />
      <PivotControls {...shared} activeAxes={[false, true, true]} disableAxes />
      <PivotControls {...shared} activeAxes={[true, false, true]} disableAxes />
    </>
  )
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
      // orbiting, or dragging the section's handle: not pointing at a part
      if (event.buttons !== 0 || bridge.handling) return
      const hit = cast(event)
      onHover((hit?.object.userData.partId as string | undefined) ?? null)
    }
    const leave = () => onHover(null)
    const click = (event: MouseEvent) => {
      // the end of a drag is not a click
      if (
        bridge.handling ||
        (pressed &&
          Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 4)
      )
        return
      const hit = cast(event)
      const part = hit && describe(hit)
      onPick(part ? { part, at: { x: event.clientX, y: event.clientY } } : null)
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

/**
 * The view is only redrawn when something asks for it. Most changes ask by themselves;
 * a part being taken out of the scene does not, so every change of view asks here.
 */
function Redraw({ on }: { on: unknown }) {
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => {
    invalidate()
  }, [on, invalidate])
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
  hoveredId,
  homeKey,
  onPick,
  onHover,
  onSection,
}: {
  loaded: LoadedModel
  view: View
  selectedId: string | null
  hoveredId: string | null
  /** changes when the camera should go back to its home view */
  homeKey: string
  onPick: (selection: Selection | null) => void
  onHover: (partId: string | null) => void
  /** the section's handle was dragged */
  onSection: (moved: { position: Vec3; turn: Turn }) => void
}) {
  const colors = useThemeColors()
  const root = React.useRef<THREE.Group>(null)
  const plane = React.useMemo(
    () => new THREE.Plane(NO_CLIP.normal.clone(), NO_CLIP.constant),
    []
  )
  const radius = loaded.box.getSize(new THREE.Vector3()).length() / 2
  const explode = view.exploded ? view.spread : 0

  return (
    <Canvas
      className={hoveredId ? "cursor-pointer" : undefined}
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
      <Cut plane={plane} section={view.section} />
      <Picker
        root={root}
        loaded={loaded}
        plane={plane}
        onHover={onHover}
        onPick={onPick}
      />
      <Camera />
      <Redraw on={view} />
      <group ref={root} rotation={MODEL_TO_WORLD}>
        {loaded.parts.map((part) => {
          const { shown, look } = appearance(part, loaded, view)
          if (!shown) return null
          return (
            <PartModel
              key={part.part.id}
              loaded={part}
              look={look}
              hovered={hoveredId === part.part.id}
              selected={selectedId === part.part.id}
              explode={explode}
              plane={plane}
              colors={colors}
            />
          )
        })}
        {/* keep-outs mark where things sit assembled; pulled apart they'd mislead */}
        {view.keepouts &&
          !view.exploded &&
          loaded.model.keepouts.map((keepout) => (
            <KeepoutBox
              key={keepout.id}
              keepout={keepout}
              plane={plane}
              colors={colors}
            />
          ))}
        {view.section && (
          <SectionHandle
            section={view.section}
            reach={radius}
            colors={colors}
            onChange={onSection}
          />
        )}
      </group>
    </Canvas>
  )
}
