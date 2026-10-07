// The handle of a section, where it cuts: what the cut is pushed through the model by,
// and tilted by. It is drawn the same size on the screen wherever the cut is, and over
// everything, so that it can always be got at.
import * as React from "react"
import * as THREE from "three"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { calculateScaleFactor, Edges, Line } from "@react-three/drei"

import type { Vec3 } from "@shared/api"
import type { ThemeColors } from "@/lib/css-color"
import type { Turn } from "@/lib/orient"
import type { Section } from "@/lib/store"
import { bridge } from "./bridge"
import { dragAlong, seenAs } from "./drag"

/** How long the arrow is on the screen, in pixels. The rest is in parts of that. */
const SIZE = 78
const LINE = 3
/** Drawn after everything else, and whatever is in front of it. */
const OVER = { depthTest: false, transparent: true, renderOrder: 20 }
/** How far out from the middle the tilts are drawn. */
const RING = 0.65
/** The part of each ring that is taken hold of, in degrees round it. */
const ARC = { from: 24, to: 66 }
const HEAD = { length: 0.17, radius: 0.06 }
/** How thick the handle is to the pointer, which is thicker than it is to the eye. */
const GRIP = 0.09
/** The tip of the arrow: the one part of the handle that says which way is which. */
const TIP = "#e5484d"
/** With Shift held, a tilt goes by steps of this many degrees. */
const NOTCH = 10
const NOT_PICKED = () => {}

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
/** A tilt is about one of the two directions that lie in the cut: the ring it is drawn
 *  as runs from `from` round to `to`, the way a turn about `about` goes. */
const TILTS = [
  { about: X, from: Y, to: Z },
  { about: Y, from: Z, to: X },
]

type Moved = { position: Vec3; turn: Turn }
type Press = ThreeEvent<PointerEvent>

/** Somewhere round a ring, in the handle's own measure. */
const round = (tilt: (typeof TILTS)[number], degrees: number) => {
  const angle = THREE.MathUtils.degToRad(degrees)
  return new THREE.Vector3()
    .addScaledVector(tilt.from, Math.cos(angle) * RING)
    .addScaledVector(tilt.to, Math.sin(angle) * RING)
}
/** The way the ring is going there: the way a turn carries a point on it. */
const onward = (tilt: (typeof TILTS)[number], degrees: number) => {
  const angle = THREE.MathUtils.degToRad(degrees)
  return new THREE.Vector3()
    .addScaledVector(tilt.from, -Math.sin(angle))
    .addScaledVector(tilt.to, Math.cos(angle))
}

/**
 * Taking hold of a piece of the handle and dragging it. `begin` is told where it was
 * taken hold of, and gives back what to do as the pointer moves: it is told how far the
 * pointer has gone since, in pixels.
 */
function useGrip(
  begin: (
    press: Press,
    size: { width: number; height: number }
  ) => (dx: number, dy: number, press: Press) => void
) {
  const get = useThree((state) => state.get)
  // lit while the pointer is on it, and for as long as it is held, wherever that takes it
  const [over, setOver] = React.useState(false)
  const [holding, setHolding] = React.useState(false)
  const held = React.useRef<{
    x: number
    y: number
    move: (dx: number, dy: number, press: Press) => void
  } | null>(null)
  const canvas = (press: Press) => press.nativeEvent.target as HTMLElement
  return {
    over: over || holding,
    grip: {
      onPointerOver: (press: Press) => {
        press.stopPropagation()
        setOver(true)
      },
      onPointerOut: (press: Press) => {
        setOver(false)
        if (!held.current) canvas(press).style.cursor = ""
      },
      onPointerDown: (press: Press) => {
        press.stopPropagation()
        held.current = {
          x: press.nativeEvent.clientX,
          y: press.nativeEvent.clientY,
          move: begin(press, get().size),
        }
        setHolding(true)
        canvas(press).style.cursor = "grabbing"
        // not the moment to turn the view, or to pick the part behind
        bridge.handling = true
        const { controls } = get()
        if (controls)
          (controls as unknown as { enabled: boolean }).enabled = false
        ;(press.target as Element).setPointerCapture(press.pointerId)
      },
      onPointerMove: (press: Press) => {
        if (!held.current) {
          canvas(press).style.cursor = "grab"
          return
        }
        press.stopPropagation()
        held.current.move(
          press.nativeEvent.clientX - held.current.x,
          press.nativeEvent.clientY - held.current.y,
          press
        )
      },
      onPointerUp: (press: Press) => {
        if (!held.current) return
        press.stopPropagation()
        held.current = null
        setHolding(false)
        canvas(press).style.cursor = ""
        const { controls } = get()
        if (controls)
          (controls as unknown as { enabled: boolean }).enabled = true
        // the click that ends the drag is still on its way
        setTimeout(() => {
          bridge.handling = false
        }, 0)
        ;(press.target as Element).releasePointerCapture(press.pointerId)
      },
    },
  }
}

type Piece = {
  section: Section
  /** the handle as it stands in the scene: where it is, and how it is turned */
  frame: React.RefObject<THREE.Group | null>
  colors: ThemeColors
  onChange: (moved: Moved) => void
}

/** The arrow: drag it to push the cut through the model, along the way it faces. */
function Push({ section, frame, colors, onChange }: Piece) {
  const { over, grip } = useGrip((press, size) => {
    const standing = frame.current!.matrixWorld
    const along = dragAlong(
      press.camera,
      size,
      new THREE.Vector3().setFromMatrixPosition(standing),
      new THREE.Vector3().setFromMatrixColumn(standing, 2).normalize()
    )
    const from = new THREE.Vector3(...section.position)
    const way = Z.clone().applyQuaternion(new THREE.Quaternion(...section.turn))
    return (dx, dy) =>
      onChange({
        position: from.clone().addScaledVector(way, along(dx, dy)).toArray(),
        turn: section.turn,
      })
  })
  const shaft = 1 - HEAD.length * 1.2
  return (
    <>
      <Line
        points={[
          [0, 0, 0],
          [0, 0, shaft],
        ]}
        color={over ? colors.section : colors.foreground}
        lineWidth={LINE}
        raycast={NOT_PICKED}
        {...OVER}
      />
      <mesh
        position={[0, 0, shaft + (HEAD.length * 1.2) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={OVER.renderOrder}
        raycast={NOT_PICKED}
      >
        <coneGeometry args={[HEAD.radius * 1.2, HEAD.length * 1.2, 20]} />
        <meshBasicMaterial color={TIP} depthTest={false} transparent />
      </mesh>
      <mesh
        position={[0, 0, 0.5]}
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
        {...grip}
      >
        <cylinderGeometry args={[GRIP, GRIP, 1, 8]} />
      </mesh>
    </>
  )
}

/**
 * One of the two tilts: a faint ring to show the turn it makes, and on it an arc with an
 * arrowhead at each end, which is what is dragged, either way round.
 */
function Tilt({
  tilt,
  section,
  frame,
  sized,
  colors,
  onChange,
}: Piece & {
  tilt: (typeof TILTS)[number]
  /** the part of the handle that is kept the same size on the screen */
  sized: React.RefObject<THREE.Group | null>
}) {
  const { over, grip } = useGrip((press, size) => {
    const standing = frame.current!.matrixWorld
    const middle = new THREE.Vector3().setFromMatrixPosition(standing)
    const stood = (way: THREE.Vector3) =>
      way.clone().transformDirection(standing)
    const [from, to] = [stood(tilt.from), stood(tilt.to)]
    // where on the ring it was taken hold of, and which way the ring goes there
    const out = press.point.clone().sub(middle)
    const angle = Math.atan2(out.dot(to), out.dot(from))
    const radius = RING * sized.current!.scale.x
    // It turns as far as the pointer goes the way the ring runs on the screen where it
    // was taken hold of, as if that were seen from the side: a ring seen edge-on then
    // turns no faster under the hand than one seen full on.
    const seen = seenAs(
      press.camera,
      size,
      middle
        .clone()
        .addScaledVector(from, Math.cos(angle) * radius)
        .addScaledVector(to, Math.sin(angle) * radius),
      from
        .clone()
        .multiplyScalar(-Math.sin(angle))
        .addScaledVector(to, Math.cos(angle))
    )
    const turn = new THREE.Quaternion(...section.turn)
    return (dx, dy, moved) => {
      if (!seen) return
      let by = (dx * seen.direction.x + dy * seen.direction.y) / (RING * SIZE)
      if (moved.shiftKey) {
        const notch = THREE.MathUtils.degToRad(NOTCH)
        by = Math.round(by / notch) * notch
      }
      const next = turn
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(tilt.about, by))
      onChange({
        position: section.position,
        turn: [next.x, next.y, next.z, next.w],
      })
    }
  })

  const drawn = React.useMemo(() => {
    const between = (from: number, to: number, steps: number) =>
      Array.from({ length: steps + 1 }, (_, step) =>
        round(tilt, from + ((to - from) * step) / steps)
      )
    const head = (degrees: number, forward: boolean) => {
      const way = onward(tilt, degrees).multiplyScalar(forward ? 1 : -1)
      return {
        position: round(tilt, degrees).addScaledVector(way, HEAD.length / 2),
        quaternion: new THREE.Quaternion().setFromUnitVectors(Y, way),
      }
    }
    return {
      ring: between(0, 360, 72),
      arc: between(ARC.from, ARC.to, 16),
      heads: [head(ARC.from, false), head(ARC.to, true)],
      // what the pointer takes hold of: the arc and its heads, and a little to spare
      grip: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(between(ARC.from - 20, ARC.to + 20, 12)),
        12,
        GRIP,
        6
      ),
    }
  }, [tilt])
  React.useEffect(() => () => drawn.grip.dispose(), [drawn])

  const color = over ? colors.section : colors.foreground
  return (
    <>
      <Line
        points={drawn.ring}
        color={color}
        lineWidth={1.25}
        opacity={over ? 0.55 : 0.3}
        raycast={NOT_PICKED}
        {...OVER}
      />
      <Line
        points={drawn.arc}
        color={color}
        lineWidth={LINE}
        raycast={NOT_PICKED}
        {...OVER}
      />
      {drawn.heads.map((head, index) => (
        <mesh
          key={index}
          position={head.position}
          quaternion={head.quaternion}
          renderOrder={OVER.renderOrder}
          raycast={NOT_PICKED}
        >
          <coneGeometry args={[HEAD.radius, HEAD.length, 20]} />
          <meshBasicMaterial color={color} depthTest={false} transparent />
        </mesh>
      ))}
      <mesh geometry={drawn.grip} visible={false} {...grip} />
    </>
  )
}

/**
 * The section's handle: an arrow to push the cut through the model, and two rings to
 * tilt it about the two directions that lie in it. With it, a faint square where the cut
 * is, so that its tilt can be read at a glance.
 */
export function SectionHandle({
  section,
  reach,
  colors,
  onChange,
}: {
  section: Section
  reach: number
  colors: ThemeColors
  onChange: (moved: Moved) => void
}) {
  const frame = React.useRef<THREE.Group>(null)
  const sized = React.useRef<THREE.Group>(null)
  const matrix = React.useMemo(
    () =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(...section.position),
        new THREE.Quaternion(...section.turn),
        new THREE.Vector3(1, 1, 1)
      ),
    [section.position, section.turn]
  )

  const at = React.useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    if (!frame.current || !sized.current) return
    sized.current.scale.setScalar(
      calculateScaleFactor(
        frame.current.getWorldPosition(at),
        SIZE,
        camera,
        size
      )
    )
  })

  const piece = { section, frame, colors, onChange }
  return (
    <group ref={frame} matrix={matrix} matrixAutoUpdate={false}>
      <mesh renderOrder={4} raycast={NOT_PICKED}>
        <planeGeometry args={[reach * 0.85, reach * 0.85]} />
        <meshBasicMaterial
          color={colors.section}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
        <Edges color={colors.section} lineWidth={1} />
      </mesh>
      <group ref={sized}>
        <Push {...piece} />
        {TILTS.map((tilt, index) => (
          <Tilt key={index} tilt={tilt} sized={sized} {...piece} />
        ))}
      </group>
    </group>
  )
}
