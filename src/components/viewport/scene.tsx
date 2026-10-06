import * as React from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Edges } from "@react-three/drei"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { acceleratedRaycast } from "three-mesh-bvh"

import type { PartRef, Vec3 } from "@shared/api"
import { useThemeColors, type ThemeColors } from "@/lib/css-color"
import type { Keepout } from "@/lib/model"
import type { Turn } from "@/lib/orient"
import type { Section, Selection, View } from "@/lib/store"
import { bridge } from "./bridge"
import type { LoadedModel, LoadedPart } from "./load"
import { EDGE, finish, skinColour } from "./paint"
import { FOV, MODEL_TO_WORLD, REACH, Rig, toWorld } from "./rig"
import { SectionHandle } from "./section-handle"

// surfaces sit a hair back in the depth buffer so their own edges win cleanly
const BEHIND_EDGES = {
  polygonOffset: true,
  polygonOffsetFactor: 1.5,
  polygonOffsetUnits: 1.5,
}
const NO_CLIP = { normal: new THREE.Vector3(0, 1, 0), constant: 1e6 }
const ONE = new THREE.Vector3(1, 1, 1)
const WHITE = new THREE.Color("#ffffff")
const NOT_PICKED = () => {}
/** A shell part smaller than this share of the model stays solid in glass mode: buttons, feet. */
const GLASS_FROM = 0.25
// drawn in this order, so what is behind glass is tinted by it and the glass keeps its outline
const ORDER = {
  solid: 0,
  cut: 0.5,
  edges: 1,
  glass: 2,
  glassEdges: 3,
  keepouts: 4,
}

/**
 * solid: opaque. glass: see-through. wire: its lines, and its surfaces not seen but
 * hiding what is behind them. outline: its lines and nothing else, so all of them show.
 */
type Look = "solid" | "glass" | "wire" | "outline"

// Glass is not drawn into the picture with everything else: its layers are added up on
// their own and laid over the picture afterwards (see Glass). Each thing is drawn on the
// occasions it is marked for.
const only = (occasion: number) => {
  const layers = new THREE.Layers()
  layers.set(occasion)
  return layers
}
/** In the picture itself. */
const SEEN = only(0)
/** Among the layers of glass. */
const GLASS = only(1)
/** In front of glass: drawn with it only as far as how near it is, to hide what is behind. */
const COVER = only(2)
/** Lights fall on whatever is being drawn. */
const EVERY = new THREE.Layers()
EVERY.enableAll()

/** How see-through glass is: untouched, pointed at, and picked. */
const GLASS_OPACITY = { plain: 0.2, hovered: 0.28, selected: 0.4 }
/**
 * How much a layer of glass of some opacity counts for when the layers are added up.
 * Counted this way, the sum says exactly how much the layers let through between them.
 */
const weight = (opacity: number) => -Math.log(1 - opacity)
/**
 * How much more a layer of glass counts for, the more colour it has. Plain glass around
 * a coloured part would otherwise grey it: this way the part's colour comes through, and
 * the part with it.
 */
const COLOUR_COUNTS = 2
/** How much the colour the layers come to is deepened, so that it holds up at a glance. */
const DEEPENED = 1.35
/** How much colour a colour has, from none (a grey) to 1. */
function chroma(color: THREE.Color): number {
  const { s, l } = color.getHSL({ h: 0, s: 0, l: 0 })
  return s * (1 - Math.abs(2 * l - 1))
}
/** Layers of glass add up: each puts in its colour, and how much it counts for. */
const ADDED_UP = {
  transparent: true,
  depthWrite: false,
  premultipliedAlpha: true,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
}

// How a cut through a solid part is filled in.
//
// Each pixel has a number that is not seen, to count in. A part that the cut has opened
// is drawn with nothing but that counting: its far sides add one, its near sides take
// one off. Whole, the two cancel. Opened, the count is left off nought exactly where the
// cut passes through the part, and that is where its cut face is drawn, on the plane of
// the cut. The parts are done one after another, and two marks are kept in the same
// number: where this part's cut face is, and where any earlier part's was. A part whose
// cut face lands on an earlier one's is in the same place as that part: there it is red.
/** The bits the counting is done in. */
const COUNT = 0x3f
/** Marks where the cut face of the part being drawn is. */
const OWN = 0x40
/** Marks where the cut face of a part drawn earlier is. */
const TAKEN = 0x80
/**
 * How far a part is drawn in, in mm, before it is looked for inside another. A round
 * surface is made of flat pieces, and two that fit each other exactly overlap by slivers
 * where the pieces fall differently: this is more than those come to.
 */
const CLEARANCE = 0.1
/** What is drawn for each part's cut face, in this order. */
const STEP = { count: 0, face: 1, own: 2, drawnIn: 3, clash: 4, taken: 5 }
const cutOrder = (index: number, step: number) =>
  ORDER.cut + index * 1e-3 + step * 1e-4

/** A part drawn only to be counted: its far sides, or its near ones. */
function counting(plane: THREE.Plane, far: boolean, drawnIn: boolean) {
  const turn = far ? THREE.IncrementWrapStencilOp : THREE.DecrementWrapStencilOp
  const material = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    side: far ? THREE.BackSide : THREE.FrontSide,
    clippingPlanes: [plane],
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilWriteMask: COUNT,
    stencilFail: turn,
    stencilZFail: turn,
    stencilZPass: turn,
  })
  if (drawnIn)
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec3 inward;"
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\ntransformed += inward * ${CLEARANCE.toFixed(3)};`
        )
    }
  return material
}

/** Changes a mark wherever the count, or a mark, is off nought, and draws nothing. */
function marking(mark: number, where: number, changed: number) {
  return new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilRef: mark,
    stencilFuncMask: where,
    stencilWriteMask: changed,
    stencilZFail: THREE.ReplaceStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  })
}

/** How far apart the lines across a cut face are kept on the screen, about, in pixels. */
const HATCH_PIXELS = 12
/** How far apart they are in the model for that, in mm: set as the view is drawn. */
const HATCH_GAP = { value: 1 }
const HATCH_INK = new THREE.Color(EDGE)
/** What two parts in the same place are drawn in, where the cut shows it: not a part's colour. */
const CLASH = new THREE.Color("#e5343b")

/**
 * Draws lines across a cut face, the way a drawing marks what a cut has gone through.
 * `way` is the direction across them, and how many there are to the usual gap.
 */
const hatched =
  (way: THREE.Vector2) =>
  (shader: {
    uniforms: Record<string, { value: unknown }>
    vertexShader: string
    fragmentShader: string
  }) => {
    shader.uniforms.hatchGap = HATCH_GAP
    shader.uniforms.hatchWay = { value: way }
    shader.uniforms.hatchInk = { value: HATCH_INK }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 onCut;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nonCut = position.xy;"
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec2 onCut;
        uniform float hatchGap;
        uniform vec2 hatchWay;
        uniform vec3 hatchInk;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float across = dot(onCut, hatchWay) / hatchGap;
        float ink = 1.0 - smoothstep(0.0, fwidth(across) * 1.2, abs(fract(across - 0.5) - 0.5));
        diffuseColor.rgb = mix(diffuseColor.rgb, hatchInk, ink * 0.45);`
      )
  }

/**
 * Makes a line be drawn only where the surface it lies in turns away from the eye: where,
 * of the two triangles that meet at it, one faces the eye and the other does not.
 */
function onlyWhereItTurns(shader: { vertexShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace(
      "attribute vec3 instanceEnd;",
      "attribute vec3 instanceEnd;\nattribute vec3 wayA;\nattribute vec3 wayB;"
    )
    .replace(
      "#include <fog_vertex>",
      `#include <fog_vertex>
      vec3 middle = (modelViewMatrix * vec4(0.5 * (instanceStart + instanceEnd), 1.0)).xyz;
      // in a flat view the eye is straight out of the screen, wherever the line is
      vec3 toEye = projectionMatrix[2][3] == 0.0 ? vec3(0.0, 0.0, 1.0) : -middle;
      if (dot(normalMatrix * wayA, toEye) * dot(normalMatrix * wayB, toEye) > 0.0)
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`
    )
}

/** Whether a part is drawn at all, and how, under the current view. */
export function appearance(
  loaded: LoadedPart,
  model: LoadedModel,
  view: View
): { shown: boolean; look: Look } {
  // with something picked out in the parts list, only that is drawn
  const { only } = view
  const shown =
    !only ||
    (only.kind === "part" && only.id === loaded.part.id) ||
    (only.kind === "group" && only.id === loaded.part.group)
  if (view.mode === "wireframe") return { shown, look: "wire" }
  if (view.mode === "outline") return { shown, look: "outline" }
  if (view.mode === "solid") return { shown, look: "solid" }
  // Glass is for seeing inside: only the outside goes see-through. A model that does
  // not say which parts are its outside goes see-through as a whole.
  const shells = model.model.groups.filter((group) => group.shell)
  if (shells.length === 0) return { shown, look: "glass" }
  const outside =
    shells.some((group) => group.id === loaded.part.group) &&
    (loaded.part.glass ??
      loaded.box.getSize(new THREE.Vector3()).length() >=
        model.box.getSize(new THREE.Vector3()).length() * GLASS_FROM)
  return { shown, look: outside ? "glass" : "solid" }
}

const PartModel = React.memo(function PartModel({
  loaded,
  look,
  cover,
  cut,
  hovered,
  selected,
  explode,
  plane,
  colors,
}: {
  loaded: LoadedPart
  look: Look
  /** there is glass about, which this part hides whatever of it is behind */
  cover: boolean
  /** its place among the parts whose cut faces are filled in, if it is one of them */
  cut: number | null
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
  // drawn by its lines alone, which then have to show against the background
  const lined = look === "wire" || look === "outline"

  const home = React.useMemo(() => {
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    loaded.home.decompose(position, quaternion, new THREE.Vector3())
    return { position, quaternion }
  }, [loaded.home])

  const planes = React.useMemo(() => [plane], [plane])
  const skinColors = React.useMemo(
    () => loaded.skins.map((skin) => skinColour(loaded, skin, colors.dark)),
    [loaded, colors.dark]
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

  // what it is drawn with to be counted, as it is and drawn in a little
  const counted = cut !== null
  const counts = React.useMemo(
    () =>
      counted
        ? [false, true].flatMap((drawnIn) =>
            [true, false].map((far) => ({
              step: drawnIn ? STEP.drawnIn : STEP.count,
              material: counting(plane, far, drawnIn),
            }))
          )
        : [],
    [counted, plane]
  )
  React.useEffect(
    () => () => {
      for (const { material } of counts) material.dispose()
    },
    [counts]
  )

  // the outlines of its curved faces, which are wherever they happen to be seen from
  const turns = React.useMemo(() => {
    const { ends, ways } = loaded.contours
    if (ends.length === 0) return null
    const geometry = new LineSegmentsGeometry().setPositions(ends)
    const each = new THREE.InstancedInterleavedBuffer(ways, 6, 1)
    geometry.setAttribute(
      "wayA",
      new THREE.InterleavedBufferAttribute(each, 3, 0)
    )
    geometry.setAttribute(
      "wayB",
      new THREE.InterleavedBufferAttribute(each, 3, 3)
    )
    const material = new LineMaterial({
      linewidth: 1,
      transparent: true,
      depthWrite: false,
      clippingPlanes: [plane],
    })
    material.onBeforeCompile = onlyWhereItTurns
    const object = new LineSegments2(geometry, material)
    object.raycast = NOT_PICKED
    return object
  }, [loaded.contours, plane])
  React.useEffect(
    () => () => {
      turns?.geometry.dispose()
      turns?.material.dispose()
    },
    [turns]
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

  // With no surfaces seen there is nothing light for a dark line to show against, so a
  // part drawn by its lines has them in the text colour instead.
  const lit = selected || (lined && hovered)
  const line = {
    color: lit ? colors.selection : lined ? colors.foreground : EDGE,
    opacity: selected ? 1 : glass ? 0.28 : look === "outline" ? 0.6 : 0.85,
  }
  const opacity = selected
    ? GLASS_OPACITY.selected
    : hovered
      ? GLASS_OPACITY.hovered
      : GLASS_OPACITY.plain
  return (
    <group ref={group}>
      {loaded.skins.map((skin, index) => (
        <React.Fragment key={index}>
          <mesh
            geometry={skin.geometry}
            raycast={acceleratedRaycast}
            layers={glass ? GLASS : SEEN}
            userData={{ partId: part.id, skin: index, glass }}
          >
            {/* Hover and selection only retint what is already there. As an outline the
                surfaces are not drawn at all, and as wireframe they hide what is behind
                them without being seen themselves: either way they are still what a
                click lands on. Each look is a material of its own, since they differ
                in more than a material can change once it is in use. */}
            <meshStandardMaterial
              key={look}
              visible={look !== "outline"}
              colorWrite={look !== "wire"}
              color={skinColors[index]}
              {...finish(loaded)}
              side={THREE.DoubleSide}
              clippingPlanes={planes}
              {...BEHIND_EDGES}
              {...(glass ? ADDED_UP : null)}
              opacity={
                glass
                  ? weight(opacity) *
                    (1 + COLOUR_COUNTS * chroma(skinColors[index]))
                  : 1
              }
              emissive={colors.selection}
              emissiveIntensity={selected ? 0.16 : hovered ? 0.07 : 0}
            />
          </mesh>
          {cut !== null &&
            counts.map(({ step, material }, count) => (
              <mesh
                key={count}
                geometry={skin.geometry}
                material={material}
                renderOrder={cutOrder(cut, step)}
                raycast={NOT_PICKED}
              />
            ))}
          {cover && !glass && (
            <mesh geometry={skin.geometry} layers={COVER} raycast={NOT_PICKED}>
              <meshBasicMaterial
                colorWrite={false}
                side={THREE.DoubleSide}
                clippingPlanes={planes}
                {...BEHIND_EDGES}
              />
            </mesh>
          )}
        </React.Fragment>
      ))}
      <primitive
        object={lines}
        renderOrder={glass ? ORDER.glassEdges : ORDER.edges}
      >
        <primitive object={lines.material} attach="material" {...line} />
      </primitive>
      {/* a solid part shows where it curves by how the light falls on it */}
      {turns && look !== "solid" && (
        <primitive
          object={turns}
          renderOrder={glass ? ORDER.glassEdges : ORDER.edges}
        >
          <primitive object={turns.material} attach="material" {...line} />
        </primitive>
      )}
    </group>
  )
})

/** One triangle that covers the screen, whichever way the camera looks. */
const SCREEN = new THREE.BufferGeometry()
  .setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)
  )
  .setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))

/**
 * The glass, drawn so that it looks the same from every side.
 *
 * Laid over one another in the usual way, layers of glass come out differently according
 * to which is laid last, and which that is changes as the model is turned: a colour seen
 * from one side is gone from the next. So they are not laid over one another. Every layer
 * that nothing solid is in front of is added to a picture of its own, in any order: its
 * colour, and how much it counts for. That picture is then laid over the view once, as
 * the colour the layers come to between them, as strongly as they block what is behind.
 */
function Glass() {
  const layers = React.useMemo(
    () =>
      // wide enough numbers to add many layers up in, and as smooth at its edges as the view
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: 4,
      }),
    []
  )
  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          layers: { value: layers.texture },
          deepened: { value: DEEPENED },
        },
        vertexShader: `
          varying vec2 at;
          void main() {
            at = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }`,
        fragmentShader: `
          uniform sampler2D layers;
          uniform float deepened;
          varying vec2 at;
          void main() {
            vec4 sum = texture2D(layers, at);
            if (sum.a < 0.0001) discard;
            vec3 colour = sum.rgb / sum.a;
            // further from the grey of the same brightness
            float grey = dot(colour, vec3(0.2126, 0.7152, 0.0722));
            colour = max(mix(vec3(grey), colour, deepened), 0.0);
            gl_FragColor = vec4(colour, 1.0 - exp(-sum.a));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [layers]
  )
  React.useEffect(
    () => () => {
      layers.dispose()
      material.dispose()
    },
    [layers, material]
  )

  // whenever the view is drawn, by whoever draws it, the layers are added up first
  const addUp = React.useMemo(() => {
    const size = new THREE.Vector2()
    const cleared = new THREE.Color()
    return (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera
    ) => {
      renderer.getDrawingBufferSize(size)
      if (layers.width !== size.x || layers.height !== size.y)
        layers.setSize(size.x, size.y)
      const was = {
        target: renderer.getRenderTarget(),
        autoClear: renderer.autoClear,
        alpha: renderer.getClearAlpha(),
        background: scene.background,
        occasions: camera.layers.mask,
      }
      renderer.getClearColor(cleared)
      // it starts from nothing, which what was last drawn may have left it unable to do
      renderer.state.buffers.depth.setMask(true)
      renderer.state.buffers.color.setMask(true)
      renderer.setClearColor(0x000000, 0)
      renderer.autoClear = true
      scene.background = null
      camera.layers.mask = GLASS.mask | COVER.mask
      renderer.setRenderTarget(layers)
      renderer.render(scene, camera)
      renderer.setRenderTarget(was.target)
      camera.layers.mask = was.occasions
      scene.background = was.background
      renderer.autoClear = was.autoClear
      renderer.setClearColor(cleared, was.alpha)
    }
  }, [layers])

  return (
    <mesh
      geometry={SCREEN}
      material={material}
      frustumCulled={false}
      renderOrder={ORDER.glass}
      raycast={NOT_PICKED}
      onBeforeRender={addUp}
    />
  )
}

/** The face a cut leaves on one part, on the plane of the cut. */
function CutFace({
  index,
  geometry,
  matrix,
  color,
  hovered,
  selected,
  colors,
}: {
  /** its place among the parts whose cut faces are filled in */
  index: number
  geometry: THREE.BufferGeometry
  matrix: THREE.Matrix4
  color: THREE.Color
  hovered: boolean
  selected: boolean
  colors: ThemeColors
}) {
  const made = React.useMemo(() => {
    // neighbours are told apart by which way their lines lean, and how close they are
    const lean = index % 2 === 0 ? 1 : -1
    const close = (index >> 1) % 2 === 0 ? 1 : 1.5
    const way = new THREE.Vector2(1, lean).normalize().multiplyScalar(close)
    const face = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.62,
      stencilWrite: true,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilRef: 0,
      stencilFuncMask: COUNT,
    })
    face.onBeforeCompile = hatched(way)
    const clash = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      stencilWrite: true,
      // an earlier part's cut face is here, and so is this part, drawn in a little
      stencilFunc: THREE.LessStencilFunc,
      stencilRef: TAKEN,
      stencilFuncMask: TAKEN | COUNT,
    })
    return {
      face,
      clash,
      // where the count is off nought is this part's cut face: marked, and the count cleared
      own: marking(OWN, COUNT, OWN | COUNT),
      // and once it has been looked for in the others, it is one of the earlier ones
      taken: marking(TAKEN, OWN | COUNT, 0xff),
    }
  }, [index])
  React.useEffect(
    () => () => {
      for (const material of Object.values(made)) material.dispose()
    },
    [made]
  )

  const layer = (step: number, material: THREE.Material) => (
    <mesh
      geometry={geometry}
      matrix={matrix}
      matrixAutoUpdate={false}
      renderOrder={cutOrder(index, step)}
      raycast={NOT_PICKED}
    >
      <primitive object={material} attach="material" />
    </mesh>
  )
  return (
    <>
      <mesh
        geometry={geometry}
        matrix={matrix}
        matrixAutoUpdate={false}
        renderOrder={cutOrder(index, STEP.face)}
        raycast={NOT_PICKED}
      >
        <primitive
          object={made.face}
          attach="material"
          color={color}
          emissive={colors.selection}
          emissiveIntensity={selected ? 0.16 : hovered ? 0.07 : 0}
        />
      </mesh>
      {layer(STEP.own, made.own)}
      <mesh
        geometry={geometry}
        matrix={matrix}
        matrixAutoUpdate={false}
        renderOrder={cutOrder(index, STEP.clash)}
        raycast={NOT_PICKED}
      >
        <primitive object={made.clash} attach="material" color={CLASH} />
      </mesh>
      {layer(STEP.taken, made.taken)}
    </>
  )
}

/**
 * The faces a cut leaves, one to each solid part it passes through, and the spacing of
 * the lines across them: kept about the same on the screen however near the model is,
 * in steps, so that they hold still while it is only turned.
 */
function CutFaces({
  section,
  reach,
  faces,
  colors,
}: {
  section: Section
  reach: number
  faces: {
    key: string
    color: THREE.Color
    hovered: boolean
    selected: boolean
  }[]
  colors: ThemeColors
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
  // wide enough to cross the whole model wherever the cut is, and however it is pulled apart
  const geometry = React.useMemo(
    () => new THREE.PlaneGeometry(reach * 8, reach * 8),
    [reach]
  )
  React.useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ camera, size }) => {
    const flat = camera as THREE.OrthographicCamera
    const lens = camera as THREE.PerspectiveCamera
    const perPixel = flat.isOrthographicCamera
      ? (flat.top - flat.bottom) / flat.zoom / size.height
      : (2 *
          Math.tan(THREE.MathUtils.degToRad(lens.fov) / 2) *
          camera.position.distanceTo(
            toWorld(new THREE.Vector3(...section.position))
          )) /
        size.height
    HATCH_GAP.value = 2 ** Math.round(Math.log2(perPixel * HATCH_PIXELS))
  })

  return faces.map((face, index) => (
    <CutFace
      key={face.key}
      index={index}
      geometry={geometry}
      matrix={matrix}
      color={face.color}
      hovered={face.hovered}
      selected={face.selected}
      colors={colors}
    />
  ))
}

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
    // glass is not in the picture the way the rest is, but is there to be pointed at
    raycaster.layers.enable(1)

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
  const looks = loaded.parts.map((part) => appearance(part, loaded, view))
  const anyGlass = looks.some(({ shown, look }) => shown && look === "glass")
  // The parts a cut leaves a face on: the solid ones, drawn as such. Each has its place
  // among them, which is the order their cut faces are drawn in.
  const cuts = loaded.parts.map((part, index) =>
    view.section && looks[index].shown && looks[index].look === "solid"
      ? part.solid
      : false
  )
  const place = (index: number) =>
    cuts[index] ? cuts.slice(0, index).filter(Boolean).length : null

  return (
    <Canvas
      className={hoveredId ? "cursor-pointer" : undefined}
      frameloop="demand"
      // Keep to the view's size as it changes, not once it has stopped changing. Left
      // alone, the canvas waits for a pause whenever it is not the window that is
      // resized, and so would lag behind the conversation's edge as that is dragged.
      resize={{ debounce: 0 }}
      camera={{
        fov: FOV,
        // drawn from just in front of the nearest the camera gets, to past the furthest
        near: (radius * REACH.nearest) / 4,
        far: radius * REACH.furthest * 2,
        position: [radius * 3, radius * 3, radius * 3],
      }}
      dpr={[1, 2]}
      // the number each pixel counts in, for filling in what a cut leaves (see COUNT)
      gl={{ antialias: true, alpha: true, stencil: true }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
      }}
    >
      <ambientLight layers={EVERY} intensity={0.55} />
      <hemisphereLight layers={EVERY} args={["#ffffff", "#7d828c", 0.7]} />
      <directionalLight
        layers={EVERY}
        position={[180, 320, 220]}
        intensity={1.7}
      />
      <directionalLight
        layers={EVERY}
        position={[-240, 160, -180]}
        intensity={0.55}
      />
      {anyGlass && <Glass />}
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
        {loaded.parts.map((part, index) => {
          const { shown, look } = looks[index]
          if (!shown) return null
          return (
            <PartModel
              key={part.part.id}
              loaded={part}
              look={look}
              cover={anyGlass}
              cut={place(index)}
              hovered={hoveredId === part.part.id}
              selected={selectedId === part.part.id}
              explode={explode}
              plane={plane}
              colors={colors}
            />
          )
        })}
        {/* keep-outs mark where things sit assembled; pulled apart they'd mislead */}
        {(!view.only || view.only.kind === "keepouts") &&
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
          <CutFaces
            section={view.section}
            reach={radius}
            colors={colors}
            faces={loaded.parts.flatMap((part, index) =>
              cuts[index]
                ? [
                    {
                      key: part.part.id,
                      // a little lighter than the part: what a cut shows is not its outside
                      color: skinColour(part, part.skins[0], colors.dark).lerp(
                        WHITE,
                        0.14
                      ),
                      hovered: hoveredId === part.part.id,
                      selected: selectedId === part.part.id,
                    },
                  ]
                : []
            )}
          />
        )}
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
