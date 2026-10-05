// The camera: how it moves under the hand, and the set views it can be sent to.
//
// There are two cameras. The one a model opens with has a lens: things further away
// are smaller, which is how an object looks. The flat views - front, top, from the end
// of an axis - use one with no lens, so that a side is seen exactly side-on, with
// nothing of the top showing. Getting from one to the other is done by narrowing the
// lens while pulling back, until it is so narrow that taking it away changes nothing.
import * as React from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { CameraControls, CameraControlsImpl } from "@react-three/drei"

import type { Vec3 } from "@shared/api"
import { nearestTurn, viewFrom, type Axis, type Sign } from "@/lib/orient"
import { bridge, publishOrientation } from "./bridge"

// The model is Z-up; three.js is Y-up. Everything inside the root group is in model mm.
export const MODEL_TO_WORLD: [number, number, number] = [-Math.PI / 2, 0, 0]
const MODEL_TO_WORLD_TURN = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(...MODEL_TO_WORLD)
)
export const toWorld = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.z, -v.y)

export const FOV = 30
const HALF_FOV = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
/** How close the camera gets to what it looks at, and how far, in model radii. */
export const REACH = { nearest: 0.02, furthest: 40 }

/** Where the camera sits when a model opens: front right, looking down on it. */
const HOME_DIRECTION = new THREE.Vector3(0.5, -0.62, 0.6).normalize()
/** How hard a scroll zooms, against the controls' own pace; and a pinch, against a scroll. */
const ZOOM_SPEED = 3
const PINCH = 2.25
/**
 * Seconds for the camera to settle: quick behind a zoom, unhurried for a turn, a little
 * brisker for a flight to a set view.
 */
const SMOOTH = { zoom: 0.1, turn: 0.3, flight: 0.2 }
/** How narrow the lens gets on the way into a flat view: at this, losing it is not seen. */
const FLATTEN = 24
/** Room left around the model when a flat view is fitted to it. */
const MARGIN = 1.35

const { ACTION } = CameraControlsImpl

/** Everything that moves the camera other than the hand directly on the view. */
function direct(stage: {
  controls: CameraControlsImpl
  lens: THREE.PerspectiveCamera
  flat: THREE.OrthographicCamera
  box: () => THREE.Box3
  size: () => { width: number; height: number }
  /** draw with this camera from now on */
  show: (camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => void
  redraw: () => void
}) {
  const { controls, lens, flat } = stage
  let mode: "lens" | "flat" = "lens"
  /** the lens is narrowed, or on its way to being */
  let narrowed = false
  /** true until the user moves the camera themselves */
  let atHome = true
  /** counts the moves asked for, so that one overtaken by another can tell */
  let flight = 0
  /** the scale the flat view is at, or on its way to, in pixels per mm */
  let goal = 1
  /** a flight into a flat view that is under way: where it is headed */
  let arriving: { flight: number; turn: number; polar: number } | null = null

  const reach = () => stage.box().getSize(new THREE.Vector3()).length() / 2
  const middle = () => toWorld(stage.box().getCenter(new THREE.Vector3()))
  /** How far back the lens has to be to show things at a scale, in pixels per mm. */
  const distanceAt = (scale: number) =>
    stage.size().height / (2 * scale * HALF_FOV)
  /** The scale that what the camera looks at is shown at now, in pixels per mm. */
  const scaleNow = () =>
    mode === "flat"
      ? flat.zoom
      : (stage.size().height * lens.zoom) / (2 * controls.distance * HALF_FOV)

  /** How far the user may zoom, either way. */
  const limits = () => {
    const r = reach()
    if (mode === "flat") {
      controls.minZoom = distanceAt(1) / (r * REACH.furthest)
      controls.maxZoom = distanceAt(1) / (r * REACH.nearest)
      return
    }
    controls.minZoom = 0.01
    controls.maxZoom = Infinity
    controls.minDistance = r * REACH.nearest
    controls.maxDistance = r * REACH.furthest
  }
  /** A move the app makes itself goes where it needs to; `settled` restores the limits. */
  const unbound = () => {
    controls.minZoom = 1e-6
    controls.maxZoom = Infinity
    controls.minDistance = 0
    controls.maxDistance = Infinity
  }

  /** Swap the narrowed lens for none, keeping everything the size it is. */
  const flatten = () => {
    const scale = scaleNow()
    const { width, height } = stage.size()
    const r = reach()
    Object.assign(flat, {
      left: -width / 2,
      right: width / 2,
      top: height / 2,
      bottom: -height / 2,
      near: -r * 50,
      far: r * 50,
    })
    mode = "flat"
    narrowed = false
    controls.camera = flat
    unbound()
    void controls.dollyTo(r * 4, false)
    void controls.zoomTo(scale, false)
    goal = scale
    limits()
    stage.show(flat)
  }

  /** From no lens to one so narrow that it looks the same. */
  const narrow = () => {
    if (mode !== "flat") return
    const distance = distanceAt(scaleNow())
    const { width, height } = stage.size()
    mode = "lens"
    narrowed = true
    lens.aspect = width / height
    controls.camera = lens
    unbound()
    void controls.zoomTo(FLATTEN, false)
    void controls.dollyTo(distance * FLATTEN, false)
    stage.show(lens)
  }

  /** Open the lens back up, keeping what the camera looks at the size it is. */
  const open = (animate: boolean) => {
    const distance = distanceAt(scaleNow())
    narrow()
    narrowed = false
    unbound()
    void controls.zoomTo(1, animate)
    void controls.dollyTo(distance, animate)
  }

  limits()

  return {
    isFlat: () => mode === "flat",

    /** The view a model opens with, framing all of it. */
    home(animate: boolean, ratio: number) {
      ++flight
      narrow()
      narrowed = false
      // fit the narrower of the view's two angles, so a tall window does not crop the sides
      const angle = Math.atan(Math.min(HALF_FOV, HALF_FOV * ratio))
      // a little inside the bounding sphere: models are rarely as tall as they are wide
      const distance = (reach() / Math.sin(angle)) * 0.94
      const target = middle()
      const eye = toWorld(HOME_DIRECTION).multiplyScalar(distance).add(target)
      controls.smoothTime = SMOOTH.turn
      unbound()
      void controls.zoomTo(1, animate)
      void controls.setLookAt(
        eye.x,
        eye.y,
        eye.z,
        target.x,
        target.y,
        target.z,
        animate
      )
      // a move that is not animated never comes to rest, so nothing else restores these
      if (!animate) limits()
      atHome = true
      stage.redraw()
    },

    /** The view changed shape: keep the model framed, unless the user chose their own view. */
    reshape(ratio: number) {
      if (atHome && mode === "lens") this.home(false, ratio)
    },

    /** Look at the model square-on from the end of one of its axes, flat and fitted. */
    lookFrom(axis: Axis, sign: Sign) {
      const { azimuth, polar } = viewFrom(axis, sign)
      const { width, height } = stage.size()
      // what of the model shows from there, and the scale at which it fits the view
      const extent = stage.box().getSize(new THREE.Vector3())
      const [across, up] =
        axis === "x"
          ? [extent.y, extent.z]
          : axis === "y"
            ? [extent.x, extent.z]
            : [extent.x, extent.y]
      const scale = Math.min(width / across, height / up) / MARGIN
      const target = middle()
      const turn = nearestTurn(controls.azimuthAngle, azimuth)

      ++flight
      atHome = false
      controls.smoothTime = SMOOTH.flight
      void controls.rotateTo(turn, polar, true)
      void controls.moveTo(target.x, target.y, target.z, true)
      if (mode === "flat") {
        limits()
        goal = scale
        void controls.zoomTo(scale, true)
        return
      }
      // with the lens narrowing as it goes; `tick` takes it away once it has arrived
      narrowed = true
      arriving = { flight, turn, polar }
      unbound()
      void controls.zoomTo(FLATTEN, true)
      void controls.dollyTo(distanceAt(scale) * FLATTEN, true)
    },

    /**
     * Zoom a flat view by a scroll of `delta` pixels, keeping what is under the pointer
     * (given as -1..1 across and up the view) where it is. With no lens this is a change
     * of scale, like zooming a drawing: it is applied at once, each scroll event on top
     * of the last, so it is as strong as the same scroll is with the lens.
     */
    zoomFlat(delta: number, across: number, up: number) {
      const { width, height } = stage.size()
      const scale = THREE.MathUtils.clamp(
        goal * Math.pow(0.95, (delta / 10) * ZOOM_SPEED),
        controls.minZoom,
        controls.maxZoom
      )
      // the pointer's offset from the middle of the view shrinks as the scale grows;
      // move what the camera looks at by the difference
      const shift = 1 / goal - 1 / scale
      const target = controls
        .getTarget(new THREE.Vector3())
        .addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(flat.matrixWorld, 0),
          ((across * width) / 2) * shift
        )
        .addScaledVector(
          new THREE.Vector3().setFromMatrixColumn(flat.matrixWorld, 1),
          ((up * height) / 2) * shift
        )
      goal = scale
      void controls.zoomTo(scale, false)
      void controls.moveTo(target.x, target.y, target.z, false)
      stage.redraw()
    },

    /** Orbit, as a drag of this many pixels on the view would. */
    orbit(dx: number, dy: number) {
      atHome = false
      if (mode === "flat" || narrowed) {
        ++flight
        open(true)
      }
      void controls.rotate(-dx * 0.012, -dy * 0.012, false)
      stage.redraw()
    },

    /** Where the camera is from what it looks at, as a direction in the model's frame. */
    eye(): Vec3 {
      const eye = controls
        .getPosition(new THREE.Vector3())
        .sub(controls.getTarget(new THREE.Vector3()))
        .normalize()
      return [eye.x, -eye.z, eye.y]
    },

    /** The user has taken hold of the view. */
    taken() {
      atHome = false
      // A flat view is one direction only: turning away from it, or from the way to
      // it, brings the lens back. Panning and zooming keep it.
      const turning =
        (controls.currentAction & (ACTION.ROTATE | ACTION.TOUCH_ROTATE)) !== 0
      if (turning && (mode === "flat" || narrowed)) {
        ++flight
        open(true)
      }
    },

    /** The camera has come to rest: the user's zoom limits apply again. */
    settled() {
      if (mode === "flat" || !narrowed) limits()
    },

    /** Called every frame that is drawn. */
    tick() {
      if (arriving && (arriving.flight !== flight || mode === "flat")) {
        arriving = null
      }
      // The flight into a flat view is as good as over: the lens is nearly as narrow as
      // it gets and the turn is within a quarter of a degree. Finish it here rather than
      // wait for the camera to come fully to rest, which takes seconds longer and during
      // which the view would not yet behave like a flat one.
      if (
        arriving &&
        lens.zoom > FLATTEN * 0.97 &&
        Math.abs(controls.azimuthAngle - arriving.turn) < 0.004 &&
        Math.abs(controls.polarAngle - arriving.polar) < 0.004
      ) {
        void controls.rotateTo(arriving.turn, arriving.polar, false)
        arriving = null
        flatten()
      }
      if (mode === "lens") {
        // A narrowed lens sits far back. Draw only the slice of depth the model is in,
        // or surfaces close together would start to show through one another.
        const r = reach()
        const near =
          lens.zoom > 1.01
            ? Math.max((r * REACH.nearest) / 4, controls.distance - 3 * r)
            : (r * REACH.nearest) / 4
        const far = Math.max(r * REACH.furthest * 2, controls.distance + 3 * r)
        if (lens.near !== near || lens.far !== far) {
          lens.near = near
          lens.far = far
          lens.updateProjectionMatrix()
        }
      }
      publishOrientation(
        controls.camera.quaternion
          .clone()
          .invert()
          .multiply(MODEL_TO_WORLD_TURN)
      )
    },
  }
}

/** The camera: orbit, pan, zoom, a home view that frames the whole model, and flat views. */
export function Rig({ box, homeKey }: { box: THREE.Box3; homeKey: string }) {
  const controls = React.useRef<CameraControls>(null)
  const director = React.useRef<ReturnType<typeof direct> | null>(null)
  const get = useThree((state) => state.get)
  const set = useThree((state) => state.set)
  const invalidate = useThree((state) => state.invalidate)
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const aspect = size.width / size.height

  const latest = React.useRef(box)
  React.useEffect(() => {
    latest.current = box
  }, [box])

  // the camera the view was created with has the lens; the flat one is made here
  const [lens] = React.useState(() => get().camera as THREE.PerspectiveCamera)
  const [flat] = React.useState(() => new THREE.OrthographicCamera())

  React.useEffect(() => {
    if (!controls.current) return
    const made = direct({
      controls: controls.current,
      lens,
      flat,
      box: () => latest.current,
      size: () => get().size,
      show: (camera) => {
        set({ camera })
        invalidate()
      },
      redraw: invalidate,
    })
    director.current = made
    // what the axis gizmo, the section planes and the keyboard move the camera with
    bridge.lookFrom = (axis, sign) => made.lookFrom(axis, sign)
    bridge.orbit = (dx, dy) => made.orbit(dx, dy)
    bridge.eye = () => made.eye()
    bridge.flat = () => made.isFlat()
    return () => {
      director.current = null
      bridge.lookFrom = bridge.orbit = bridge.eye = bridge.flat = null
    }
  }, [lens, flat, get, set, invalidate])

  // reframes when a different model opens or home is asked for - not when the same
  // model is rebuilt, which should not move the camera
  const first = React.useRef(true)
  const shape = React.useRef(aspect)
  React.useEffect(() => {
    director.current?.home(!first.current, shape.current)
    first.current = false
  }, [homeKey])

  // the view changed shape: a panel opened, or the window was resized
  React.useEffect(() => {
    shape.current = aspect
    if (!first.current) director.current?.reshape(aspect)
  }, [aspect])

  // Holding Shift turns orbiting into panning: for a drag, and for a two-finger scroll
  // on a trackpad, which otherwise zooms.
  React.useEffect(() => {
    const canvas = gl.domElement
    const around = canvas.parentElement
    if (!around) return
    const choose = (event: WheelEvent | PointerEvent) => {
      const camera = controls.current
      if (!camera) return
      camera.mouseButtons.left = event.shiftKey ? ACTION.TRUCK : ACTION.ROTATE
      camera.mouseButtons.wheel = event.shiftKey ? ACTION.TRUCK : ACTION.DOLLY
    }
    const wheel = (event: WheelEvent) => {
      const camera = controls.current
      if (!camera) return
      choose(event)
      // a zoom should keep up with the fingers; a turn from a button stays unhurried
      camera.smoothTime = SMOOTH.zoom
      if (event.shiftKey) return
      // a pinch arrives as a scroll with Ctrl held; a mouse wheel may count in lines
      const delta =
        event.deltaY *
        (event.ctrlKey ? PINCH : 1) *
        (event.deltaMode === 1 ? 10 : 1)
      if (director.current?.isFlat()) {
        event.preventDefault()
        event.stopPropagation()
        const rect = canvas.getBoundingClientRect()
        director.current.zoomFlat(
          delta,
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((event.clientY - rect.top) / rect.height) * 2
        )
        return
      }
      // The controls would answer a pinch by changing the lens instead of moving the
      // camera. Pass it on as a plain scroll, so every zoom is the same kind: towards
      // the pointer, within the same limits.
      if (!event.ctrlKey) return
      event.preventDefault()
      event.stopPropagation()
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: event.deltaY * PINCH,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          bubbles: true,
          cancelable: true,
        })
      )
    }
    // capturing, one element up: these run before the controls' own listeners on the canvas
    around.addEventListener("wheel", wheel, { capture: true, passive: false })
    around.addEventListener("pointerdown", choose, { capture: true })
    return () => {
      around.removeEventListener("wheel", wheel, { capture: true })
      around.removeEventListener("pointerdown", choose, { capture: true })
    }
  }, [gl])

  useFrame(() => director.current?.tick())

  return (
    <CameraControls
      ref={controls}
      // always this one: the flat camera is handed to the same controls when it is wanted
      camera={lens}
      makeDefault
      onControl={() => director.current?.taken()}
      onRest={() => director.current?.settled()}
      dollySpeed={ZOOM_SPEED}
      dollyToCursor
      smoothTime={SMOOTH.turn}
      draggingSmoothTime={0.08}
    />
  )
}
