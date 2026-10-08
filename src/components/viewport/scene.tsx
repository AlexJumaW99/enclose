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
import type { Finds, Found } from "@/lib/find"
import type { Keepout } from "@/lib/model"
import type { Turn } from "@/lib/orient"
import { MAC } from "@/lib/platform"
import type { Note, Section, Selection, View } from "@/lib/store"
import { bridge } from "./bridge"
import { FoundTags, namesOf, Place, type Named } from "./found-tags"
import { Ground } from "./ground"
import { UNDER_FROM, underlit } from "./light"
import type { LoadedModel, LoadedPart } from "./load"
import { DRAG_FROM, Marquee } from "./marquee"
import { EDGE, finish, skinColour } from "./paint"
import { NoteMark, PartMarks } from "./part-marks"
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
const NOT_HINTED: string[] = []
const NOT_NAMED: Named[] = []
/** A shell part smaller than this share of the model stays solid in glass mode: buttons, feet. */
const GLASS_FROM = 0.25
// drawn in this order, so what is behind glass is tinted by it and the glass keeps its outline
const ORDER = {
  solid: 0,
  cut: 0.5,
  ground: 0.9,
  edges: 1,
  glass: 2,
  glassEdges: 3,
  keepouts: 4,
  // over all of the model: where the parts picked out together are, and where the ones
  // Claude is at work on are; and then their own lines, which the hint of them is not to
  // dim
  hint: 5,
  changing: 5.5,
  hinted: 6,
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
/** In the picture of where the parts picked out together are (see Hint). */
const HINT = only(3)
/** In the picture of where the parts Claude is at work on are (see Hint). */
const CHANGING = only(4)
/** Lights fall on whatever is being drawn. */
const EVERY = new THREE.Layers()
EVERY.enableAll()

/** How see-through glass is: untouched, pointed at, and picked. */
const GLASS_OPACITY = { plain: 0.2, hovered: 0.28, selected: 0.4 }
/**
 * How wide the lines of a part are, in pixels, when it is picked out; and, drawn by its
 * lines alone, when the pointer is on it. The rest are 1.
 */
const PICKED_LINE = 2
const HOVERED_LINE = 1.5
/**
 * How strongly the parts picked out together show through what is in front of them: the
 * veil over where each is, and the line round it. And how wide that line is, in pixels.
 */
const HINTED = { veil: 0.4, line: 0.7, width: 1.5, glint: 0, dim: 0, rim: 0 }
/**
 * The same for the parts Claude is at work on, which show only faintly: and how many
 * times as strongly again where the light that goes across them is.
 */
const CHANGED = {
  veil: 0.1,
  line: 0.22,
  width: 1.5,
  glint: 2.2,
  dim: 0,
  rim: 0,
}
/**
 * The same for a model Claude is looking over, all of its parts at once, where the light
 * is to be seen going across whatever colour they are, and plainly. Away from the light
 * the parts are dimmed, by this much, the way the words that say so are. And the line
 * round each is not ink but light (`rim`): faint away from the light, and bright in it,
 * over a wider stretch than the parts themselves are.
 */
const READ = { veil: 0.06, line: 0.09, width: 2.5, glint: 9, dim: 0.46, rim: 1 }
/**
 * That light as the lines of the parts have it, which are drawn each on its own: which
 * way it goes and how far along it is (kept by the Hint that draws the light), and
 * whether it is on. And how much of itself a line is away from the light, and in it.
 */
const LIGHT = {
  going: { value: new THREE.Vector3(0, 0, 0.25) },
  on: { value: 0 },
}
const LINE_LIT = { away: 0.28, in: 1.25 }
/**
 * The light that goes across the parts Claude is at work on, the way one goes across the
 * words that say so in the conversation: how often it comes by, in seconds, how far it
 * leans, in degrees, and how far one is from the next, in pixels. And how many times a
 * second the view is drawn for it, when nothing else has it drawn.
 */
const GLINT = { every: 2, lean: 20, apart: 640, rate: 30 }
/**
 * What a part is drawn in where parts that are hinted at together are told apart: a
 * colour of its own, none of them near another, for as many as sixty-four of them.
 */
const tell = (place: number) =>
  new THREE.Color().setRGB(
    ((place & 3) + 1) / 4,
    (((place >> 2) & 3) + 1) / 4,
    (((place >> 4) & 3) + 1) / 4
  )
/** How much of its own light a part gives off, picked out and under the pointer. */
const GLOW = { picked: 0.3, hovered: 0.07 }
/** How fast a part takes the selection's colour and gives it up again. */
const TINT_RATE = 16
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

/**
 * Makes a line fainter away from the light that goes across a model being looked over,
 * and plainer in it; and as it ever is, while there is no such light.
 */
function inTheLight(shader: {
  fragmentShader: string
  uniforms: Record<string, THREE.IUniform>
}) {
  shader.uniforms.lightGoing = LIGHT.going
  shader.uniforms.lightOn = LIGHT.on
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "void main() {",
      "uniform vec3 lightGoing;\nuniform float lightOn;\nvoid main() {"
    )
    .replace(
      "gl_FragColor = vec4( diffuseColor.rgb, alpha );",
      `gl_FragColor = vec4( diffuseColor.rgb, alpha );
      float lightAt = 0.5 + 0.5 * cos(6.2831853 * (dot(gl_FragCoord.xy, lightGoing.xy) - lightGoing.z));
      gl_FragColor.a = min(1.0, gl_FragColor.a * mix(1.0, mix(${LINE_LIT.away}, ${LINE_LIT.in}, pow(lightAt, 2.0)), lightOn));`
    )
}
/** Both, for the lines that are drawn only where a surface turns from the eye. */
function turningInTheLight(
  shader: Parameters<typeof inTheLight>[0] & {
    vertexShader: string
  }
) {
  onlyWhereItTurns(shader)
  inTheLight(shader)
}

/** Whether a part is drawn at all, and how, under the current view. */
export function appearance(
  loaded: LoadedPart,
  model: LoadedModel,
  view: View
): { shown: boolean; look: Look } {
  // with something picked out to be shown on its own, only that is drawn: and nothing
  // that has been put out of sight
  const { only, hidden } = view
  const shown =
    !hidden.includes(loaded.part.id) &&
    (!only ||
      (only.kind === "part" && only.id === loaded.part.id) ||
      (only.kind === "parts" && only.ids.includes(loaded.part.id)) ||
      (only.kind === "group" && only.id === loaded.part.group))
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
  hint,
  changing,
  plain,
  explode,
  plane,
  colors,
  colour,
  children,
}: {
  loaded: LoadedPart
  look: Look
  /** the colour the user has given it, if they have */
  colour: string | null
  /** what is shown with the part, and goes where it goes */
  children?: React.ReactNode
  /** there is glass about, which this part hides whatever of it is behind */
  cover: boolean
  /** its place among the parts whose cut faces are filled in, if it is one of them */
  cut: number | null
  hovered: boolean
  selected: boolean
  /**
   * Its place among the parts picked out together, which are hinted at through whatever
   * is in front of them; null if it is not one of them.
   */
  hint: number | null
  /** Its place among the parts Claude is at work on, which are hinted at likewise. */
  changing: number | null
  /** picked out, but to be seen in its own colour: one is being chosen for it */
  plain: boolean
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
  // what it is drawn in to be told apart, on each occasion it is hinted at for
  const told = React.useMemo(
    () =>
      [
        { occasion: HINT, place: hint },
        { occasion: CHANGING, place: changing },
      ].flatMap(({ occasion, place }) =>
        place === null ? [] : [{ occasion, colour: tell(place) }]
      ),
    [hint, changing]
  )
  const skinColors = React.useMemo(
    () =>
      loaded.skins.map((skin) => skinColour(loaded, skin, colors.dark, colour)),
    [loaded, colors.dark, colour]
  )

  const lines = React.useMemo(() => {
    const geometry = new LineSegmentsGeometry().setPositions(loaded.edges)
    const material = new LineMaterial({
      linewidth: 1, // screen pixels
      transparent: true,
      depthWrite: false,
      clippingPlanes: [plane],
    })
    material.onBeforeCompile = inTheLight
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
    material.onBeforeCompile = turningInTheLight
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
  // A part that is picked out turns the selection's colour, and turns back, by degrees.
  const filled = selected && !plain
  const tint = React.useRef(filled ? 1 : 0)
  const surfaces = React.useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const paint = (material: THREE.MeshStandardMaterial, index: number) =>
    material.color.copy(skinColors[index]).lerp(colors.picked, tint.current)

  const current = React.useRef(explode)
  React.useEffect(() => invalidate(), [explode, filled, invalidate])
  useFrame((_, delta) => {
    const to = filled ? 1 : 0
    if (tint.current !== to) {
      const next = THREE.MathUtils.damp(
        tint.current,
        to,
        TINT_RATE,
        Math.min(delta, 0.05)
      )
      tint.current = Math.abs(next - to) < 0.01 ? to : next
      surfaces.current.forEach(
        (material, index) => material && paint(material, index)
      )
      invalidate()
    }
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
  // part drawn by its lines has them in the text colour instead. Picked out, a part
  // has heavier lines, drawn in full: dark ones wherever its surfaces are seen, which
  // they are in wireframe too, once it has turned the selection's colour.
  const bodied = !lined || (look === "wire" && filled)
  const line = {
    color: bodied ? EDGE : colors.foreground,
    opacity: selected ? 1 : glass ? 0.28 : look === "outline" ? 0.6 : 0.85,
    linewidth: selected ? PICKED_LINE : lined && hovered ? HOVERED_LINE : 1,
  }
  const opacity = selected
    ? GLASS_OPACITY.selected
    : hovered
      ? GLASS_OPACITY.hovered
      : GLASS_OPACITY.plain
  // its own lines go over the hint of it, where they are seen at all
  const lineOrder =
    told.length > 0 ? ORDER.hinted : glass ? ORDER.glassEdges : ORDER.edges
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
              // its colour is set here, and each frame that it is changing
              ref={(material) => {
                surfaces.current[index] = material
                if (material) paint(material, index)
              }}
              visible={look !== "outline"}
              colorWrite={look !== "wire" || filled}
              // the selection's colour is seen as it is: the view's lens would grey it
              toneMapped={!filled}
              {...finish(loaded)}
              side={THREE.DoubleSide}
              clippingPlanes={planes}
              {...BEHIND_EDGES}
              {...(glass ? ADDED_UP : null)}
              opacity={
                glass
                  ? weight(opacity) *
                    (1 +
                      COLOUR_COUNTS *
                        chroma(filled ? colors.picked : skinColors[index]))
                  : 1
              }
              emissive={WHITE}
              emissiveIntensity={
                filled ? GLOW.picked : hovered && !selected ? GLOW.hovered : 0
              }
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
          {told.map(({ occasion, colour }) => (
            <mesh
              key={occasion.mask}
              geometry={skin.geometry}
              layers={occasion}
              raycast={NOT_PICKED}
            >
              <meshBasicMaterial
                color={colour}
                toneMapped={false}
                side={THREE.DoubleSide}
                clippingPlanes={planes}
              />
            </mesh>
          ))}
        </React.Fragment>
      ))}
      <primitive object={lines} renderOrder={lineOrder}>
        <primitive object={lines.material} attach="material" {...line} />
      </primitive>
      {/* A solid part shows where it curves by how the light falls on it: unless it is
          picked out, when it is all of a colour. */}
      {turns && (look !== "solid" || filled) && (
        <primitive object={turns} renderOrder={lineOrder}>
          <primitive object={turns.material} attach="material" {...line} />
        </primitive>
      )}
      {children}
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

/**
 * A hint of some of the parts, laid over the view: where each of them is, whatever is in
 * front of it. It is how the parts picked out together are shown: a box takes in what is
 * inside other parts as readily as what is not, and what it took would otherwise be
 * nowhere to be seen. And it is how the parts Claude is at work on are shown, for as long
 * as it is: more faintly, with a light going across them over and over.
 *
 * The parts are drawn on their own into a picture that is not shown, each all of one
 * colour that is no other's, the nearer in front of the further. Where the picture has a
 * part, the view is veiled in the selection's colour; where one colour gives way to
 * another, or to none, is the edge of a part as it is seen from here, and gets a line.
 */
function Hint({
  colors,
  occasion,
  order,
  how,
}: {
  colors: ThemeColors
  /** the occasion the parts are drawn on to be in the picture */
  occasion: THREE.Layers
  /** where among all that is drawn it is laid over the view */
  order: number
  how: typeof HINTED
}) {
  const invalidate = useThree((state) => state.invalidate)
  // Nothing goes across them for whoever has asked for less to move: they show evenly.
  const moving = React.useMemo(
    () =>
      how.glint > 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [how]
  )
  React.useEffect(() => {
    if (!moving) return
    const drawn = setInterval(() => invalidate(), 1000 / GLINT.rate)
    return () => clearInterval(drawn)
  }, [moving, invalidate])

  const picture = React.useMemo(
    // as smooth at its edges as the view, which is what keeps the line smooth
    () => new THREE.WebGLRenderTarget(1, 1, { samples: 4 }),
    []
  )
  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          picture: { value: picture.texture },
          reach: { value: new THREE.Vector2() },
          veil: { value: new THREE.Color() },
          ink: { value: new THREE.Color(EDGE) },
          veiled: { value: how.veil },
          inked: { value: how.line },
          glint: { value: how.glint },
          dimmed: { value: how.dim },
          rimmed: { value: how.rim },
          // the way the light goes across, to a pixel, and how far along it is: none
          // and a quarter is no light going anywhere, and all of it lit a little
          going: { value: new THREE.Vector3(0, 0, 0.25) },
        },
        vertexShader: `
          varying vec2 at;
          void main() {
            at = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }`,
        fragmentShader: `
          uniform sampler2D picture;
          uniform vec2 reach;
          uniform vec3 veil;
          uniform vec3 ink;
          uniform float veiled;
          uniform float inked;
          uniform float glint;
          uniform float dimmed;
          uniform float rimmed;
          uniform vec3 going;
          varying vec2 at;
          float unlike(vec4 here, vec2 by) {
            return distance(here, texture2D(picture, at + by * reach));
          }
          void main() {
            vec4 here = texture2D(picture, at);
            // a line goes where a place is unlike what is round it, any way from it
            float edge = max(
              max(unlike(here, vec2(1.0, 0.0)), unlike(here, vec2(-1.0, 0.0))),
              max(unlike(here, vec2(0.0, 1.0)), unlike(here, vec2(0.0, -1.0))));
            edge = max(edge, max(
              max(unlike(here, vec2(0.7, 0.7)), unlike(here, vec2(-0.7, 0.7))),
              max(unlike(here, vec2(0.7, -0.7)), unlike(here, vec2(-0.7, -0.7)))));
            // where the light going across is, all of it shows the more
            float light = 0.5 + 0.5 * cos(6.2831853 * (dot(gl_FragCoord.xy, going.xy) - going.z));
            float beam = pow(light, 4.0);
            float lit = 1.0 + glint * beam;
            // a line that is light and not ink is lit over a wider stretch than the rest
            float lineLit = 1.0 + glint * mix(beam, pow(light, 2.0), rimmed);
            float line = smoothstep(0.02, 0.2, edge) * min(inked * lineLit, 1.0);
            float fill = here.a * min(veiled * lit, 1.0) * (1.0 - line);
            // and away from it, what is to be dimmed is: a shade over it instead
            float shade = here.a * dimmed * (1.0 - beam) * (1.0 - line) * (1.0 - fill);
            float alpha = line + fill + shade;
            if (alpha < 0.002) discard;
            gl_FragColor = vec4((mix(ink, veil, rimmed) * line + ink * shade + veil * fill) / alpha, alpha);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [picture, how]
  )
  React.useEffect(() => {
    material.uniforms.veil.value.copy(colors.picked)
  }, [material, colors.picked])
  // the lines of the parts take the same light, for as long as it goes across them
  const shared = moving && how.rim > 0
  React.useEffect(() => {
    if (!shared) return
    LIGHT.on.value = 1
    return () => {
      LIGHT.on.value = 0
    }
  }, [shared])
  React.useEffect(
    () => () => {
      picture.dispose()
      material.dispose()
    },
    [picture, material]
  )

  // whenever the view is drawn, by whoever draws it, the picture is drawn first
  const draw = React.useMemo(() => {
    const size = new THREE.Vector2()
    const cleared = new THREE.Color()
    return (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera
    ) => {
      renderer.getDrawingBufferSize(size)
      if (picture.width !== size.x || picture.height !== size.y)
        picture.setSize(size.x, size.y)
      // half the line's width either side of an edge, in the picture's own measure
      const half = (how.width * renderer.getPixelRatio()) / 2
      material.uniforms.reach.value.set(half / size.x, half / size.y)
      if (moving) {
        // across the view and a little down it, as far along as the time makes it
        const lean = THREE.MathUtils.degToRad(GLINT.lean)
        const apart = GLINT.apart * renderer.getPixelRatio()
        material.uniforms.going.value.set(
          Math.cos(lean) / apart,
          -Math.sin(lean) / apart,
          (performance.now() / 1000 / GLINT.every) % 1
        )
        if (shared) LIGHT.going.value.copy(material.uniforms.going.value)
      }
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
      camera.layers.mask = occasion.mask
      renderer.setRenderTarget(picture)
      renderer.render(scene, camera)
      renderer.setRenderTarget(was.target)
      camera.layers.mask = was.occasions
      scene.background = was.background
      renderer.autoClear = was.autoClear
      renderer.setClearColor(cleared, was.alpha)
    }
  }, [picture, material, occasion, how, moving, shared])

  return (
    <mesh
      geometry={SCREEN}
      material={material}
      frustumCulled={false}
      renderOrder={order}
      raycast={NOT_PICKED}
      // what goes across it is for whoever is at the view, not for a picture of it
      userData={{ passing: how.glint > 0 }}
      onBeforeRender={draw}
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
}: {
  /** its place among the parts whose cut faces are filled in */
  index: number
  geometry: THREE.BufferGeometry
  matrix: THREE.Matrix4
  color: THREE.Color
  hovered: boolean
  selected: boolean
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
          emissive={WHITE}
          emissiveIntensity={
            selected ? GLOW.picked : hovered ? GLOW.hovered : 0
          }
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
}: {
  section: Section
  reach: number
  faces: {
    key: string
    color: THREE.Color
    hovered: boolean
    selected: boolean
  }[]
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
  /**
   * The pointer is over a part, or over none: and whether a key is held that a click
   * would pick out the part by itself with, and not the piece it is of.
   */
  onHover: (partId: string | null, alone: boolean) => void
  /**
   * A part was clicked, or nothing was: with Shift held, to add the part to what is
   * picked out, or take it back out; and clicked twice, or with Cmd held (Ctrl, off a
   * Mac), for the part by itself and not the piece it is of. With Shift held a click
   * is for the part by itself as it is, and it is the second of two that is for all of
   * the piece.
   */
  onPick: (selection: Selection | null, add: boolean, alone: boolean) => void
}) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const raycaster = useThree((state) => state.raycaster)

  React.useEffect(() => {
    const canvas = gl.domElement
    const pointer = new THREE.Vector2()
    let pressed: { x: number; y: number } | null = null
    /** where the pointer is, while it is over the view and pointing at it */
    let over: { clientX: number; clientY: number } | null = null
    // glass is not in the picture the way the rest is, but is there to be pointed at
    raycaster.layers.enable(1)

    /** A click with these held is for the part itself. */
    const alone = (event: MouseEvent | KeyboardEvent) =>
      event.shiftKey || (MAC ? event.metaKey : event.ctrlKey)

    const cast = (event: { clientX: number; clientY: number }) => {
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
    const point = (event: MouseEvent | KeyboardEvent) => {
      const hit = over && cast(over)
      onHover(
        (hit?.object.userData.partId as string | undefined) ?? null,
        alone(event)
      )
    }
    const move = (event: PointerEvent) => {
      // turning the view, drawing a box across it, or dragging the section's handle:
      // not pointing at a part
      if (event.buttons !== 0 || bridge.handling) return
      over = { clientX: event.clientX, clientY: event.clientY }
      point(event)
    }
    const leave = () => {
      over = null
      onHover(null, false)
    }
    // one of those keys goes down or comes up while the pointer rests on a part: what
    // is lit up under it is what a click would now pick out
    const key = (event: KeyboardEvent) => {
      if (over && ["Shift", "Meta", "Control"].includes(event.key)) point(event)
    }
    const click = (event: MouseEvent) => {
      // the end of a drag is not a click
      if (
        bridge.handling ||
        (pressed &&
          Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) >
            DRAG_FROM)
      )
        return
      const hit = cast(event)
      const part = hit && describe(hit)
      onPick(
        part ? { part, at: { x: event.clientX, y: event.clientY } } : null,
        event.shiftKey,
        event.shiftKey ? event.detail < 2 : event.detail > 1 || alone(event)
      )
    }

    canvas.addEventListener("pointerdown", down)
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerleave", leave)
    canvas.addEventListener("click", click)
    window.addEventListener("keydown", key)
    window.addEventListener("keyup", key)
    return () => {
      canvas.removeEventListener("pointerdown", down)
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerleave", leave)
      canvas.removeEventListener("click", click)
      window.removeEventListener("keydown", key)
      window.removeEventListener("keyup", key)
    }
  }, [gl, camera, raycaster, root, loaded, plane, onHover, onPick])

  return null
}

/** The light from under the model, as strong as where the camera is makes it (see light.ts). */
function Underlight() {
  const light = React.useRef<THREE.DirectionalLight>(null)
  useFrame(({ camera }) => {
    if (light.current) light.current.intensity = underlit(camera)
  })
  return (
    <directionalLight
      ref={light}
      layers={EVERY}
      position={UNDER_FROM}
      intensity={0}
    />
  )
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
  const invalidate = useThree((state) => state.invalidate)
  React.useEffect(() => {
    bridge.screenshot = () => {
      // The picture is of the model, as it is: not of what only goes across it while
      // Claude is at work, which is who the picture is for.
      const passing: THREE.Object3D[] = []
      scene.traverse((object) => {
        if (object.userData.passing && object.visible) passing.push(object)
      })
      for (const object of passing) object.visible = false
      const lit = LIGHT.on.value
      LIGHT.on.value = 0
      gl.render(scene, camera)
      LIGHT.on.value = lit
      for (const object of passing) object.visible = true
      invalidate()
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
  }, [gl, scene, camera, invalidate])
  return null
}

export function Scene({
  loaded,
  projectId,
  view,
  selectedId,
  selectedWith,
  several,
  changing,
  reading = false,
  sweep,
  hoveredId,
  hoveredWith,
  seeking,
  found,
  plain,
  notes,
  colours,
  homeKey,
  onPick,
  onSweep,
  onTake,
  onHover,
  onShow,
  onSection,
}: {
  loaded: LoadedModel
  projectId: string
  view: View
  /** what has been said of parts and not yet sent */
  notes: Note[]
  /** the colours the user has given parts, by part */
  colours: Record<string, string>
  selectedId: string | null
  /**
   * The part picked out with the rest of its piece, where it is the piece that is
   * picked out: all of them are drawn as picked out, and what goes with that is shown
   * on the one that was clicked. Just that part, where it was picked out by itself.
   */
  selectedWith: string[]
  /** the parts picked out together, with a box or with Shift: hinted at through the rest */
  several: string[]
  /** the parts Claude is at work on: hinted at likewise, with a light going across them */
  changing: string[]
  /**
   * They are the whole model, which Claude is looking over. The light is plainer to see,
   * the camera goes slowly round the model, and the view is not the hand's to move or
   * to pick from until it is through.
   */
  reading?: boolean
  /** what a box being drawn across the view takes in so far; null while none is drawn */
  sweep: string[] | null
  hoveredId: string | null
  /**
   * What is lit up for the part under the pointer: in the view, what a click there
   * would pick out, which is all of its piece, or just the part while Shift or Cmd is
   * held; in the list of parts, the one part.
   */
  hoveredWith: string[]
  /** a part is being looked for by name: the one lit up is shown through all the rest */
  seeking: boolean
  /**
   * What has been found, while parts and groups are looked for by name from the view;
   * null while none are. All of the model is on show to be looked through, see-through
   * but for what was found: that is drawn as what is picked out is, each thing with its
   * name beside it.
   */
  found: Finds | null
  /** the part picked out is to be seen in its own colour: one is being chosen for it */
  plain: boolean
  /** changes when the camera should go back to its home view */
  homeKey: string
  onPick: (selection: Selection | null, add: boolean, alone: boolean) => void
  /** a box is being drawn across the view, and takes these in so far; null once it is not */
  onSweep: (partIds: string[] | null, add: boolean) => void
  /** the box was let go, having taken these in */
  onTake: (partIds: string[], add: boolean) => void
  onHover: (partId: string | null, alone: boolean) => void
  /** the name beside something found was pressed: it is to be shown on its own */
  onShow: (thing: Found) => void
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
  // What is lit as picked out: the one part or piece, or the several; or, while parts
  // are looked for by name, what was found; or, while a box is being drawn across the
  // view, what it takes in so far.
  const sweeping = sweep !== null
  const finding = found !== null
  const lit = React.useMemo(
    () =>
      new Set(
        sweep ?? found?.parts ?? (several.length > 0 ? several : selectedWith)
      ),
    [sweep, found, several, selectedWith]
  )
  const under = React.useMemo(() => new Set(hoveredWith), [hoveredWith])
  const named = React.useMemo(
    () => (found ? namesOf(loaded, found.things) : NOT_NAMED),
    [loaded, found]
  )
  /** The names of what was found, by the part that carries each. */
  const carried = React.useMemo(() => {
    const by = new Map<string, Named[]>()
    for (const name of named)
      by.set(name.on, [...(by.get(name.on) ?? []), name])
    return by
  }, [named])
  const looks = loaded.parts.map((part): ReturnType<typeof appearance> => {
    // looked for by name, a part is looked for in all of the model: what the view was
    // cut down to is on show again meanwhile, and what was put out of sight
    const seen = finding
      ? { ...appearance(part, loaded, view), shown: true }
      : appearance(part, loaded, view)
    // While a part is looked for, it alone is solid and all the rest is see-through,
    // whatever the shading: it is found wherever it is, inside another part or behind.
    // It is the same while a box is drawn: what it takes in so far is seen through all
    // the rest, since it takes in what is inside other parts as readily as what is not.
    if (seeking)
      return { ...seen, look: part.part.id === hoveredId ? "solid" : "glass" }
    // And while parts are looked for by name from the view: what is found is solid,
    // and seen through all the rest wherever it is.
    if (sweeping || finding)
      return { ...seen, look: lit.has(part.part.id) ? "solid" : "glass" }
    return seen
  })
  // Once the box is let go the model is drawn as it was, and the parts picked out
  // together are hinted at through whatever of it is in front of them (see Hint).
  const hinted = seeking || sweeping ? NOT_HINTED : several
  // And so are the parts Claude is at work on, those of them that are there to be seen.
  const changed = seeking || sweeping ? NOT_HINTED : changing
  const anyChanged = loaded.parts.some(
    (part, index) => looks[index].shown && changed.includes(part.part.id)
  )
  /** Picked out, and drawn in the selection's colour for it. */
  const filled = (id: string) =>
    lit.has(id) && !(plain && !sweeping && selectedWith.includes(id))
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
      className={hoveredId && !sweeping ? "cursor-pointer" : undefined}
      // (the view says of itself that the pointer is its own: that has to be unsaid)
      style={reading ? { pointerEvents: "none" } : undefined}
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
      {hinted.length > 0 && (
        <Hint colors={colors} occasion={HINT} order={ORDER.hint} how={HINTED} />
      )}
      {anyChanged && (
        <Hint
          colors={colors}
          occasion={CHANGING}
          order={ORDER.changing}
          how={reading ? READ : CHANGED}
        />
      )}
      <Rig box={loaded.box} homeKey={homeKey} circling={reading} />
      {/* after the camera has been moved for the frame: it goes by where that is */}
      <Underlight />
      {named.length > 0 && <FoundTags named={named} onShow={onShow} />}
      <Cut plane={plane} section={view.section} />
      <Picker
        root={root}
        loaded={loaded}
        plane={plane}
        onHover={onHover}
        onPick={onPick}
      />
      <Marquee
        root={root}
        plane={plane}
        cut={view.section !== null}
        onSweep={onSweep}
        onTake={onTake}
      />
      <Camera />
      <Redraw on={view} />
      <Redraw on={changed} />
      <Redraw on={found} />
      <group ref={root} rotation={MODEL_TO_WORLD}>
        {view.grid && <Ground colors={colors} order={ORDER.ground} />}
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
              // the part that is looked for is the one thing picked out, while it is
              hovered={!seeking && !sweeping && under.has(part.part.id)}
              selected={
                seeking ? hoveredId === part.part.id : lit.has(part.part.id)
              }
              hint={
                hinted.includes(part.part.id)
                  ? hinted.indexOf(part.part.id)
                  : null
              }
              changing={
                changed.includes(part.part.id)
                  ? changed.indexOf(part.part.id)
                  : null
              }
              plain={
                plain &&
                !seeking &&
                !sweeping &&
                selectedWith.includes(part.part.id)
              }
              explode={explode}
              plane={plane}
              colors={colors}
              colour={colours[part.part.id] ?? null}
            >
              {selectedId === part.part.id && !sweeping && (
                <PartMarks
                  loaded={part}
                  model={loaded.model}
                  projectId={projectId}
                  onPick={onPick}
                  shown={`#${skinColour(part, part.skins[0], colors.dark, colours[part.part.id]).getHexString()}`}
                />
              )}
              {notes.map(
                (note) =>
                  note.part.id === part.part.id && (
                    <NoteMark key={note.id} loaded={part} note={note} />
                  )
              )}
              {carried.get(part.part.id)?.map(({ key, at }) => (
                <Place key={key} name={key} at={at} />
              ))}
            </PartModel>
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
            faces={loaded.parts.flatMap((part, index) =>
              cuts[index]
                ? [
                    {
                      key: part.part.id,
                      // a little lighter than the part: what a cut shows is not its
                      // outside. Picked out, it is the selection's colour as the part is.
                      color: filled(part.part.id)
                        ? colors.picked
                        : skinColour(
                            part,
                            part.skins[0],
                            colors.dark,
                            colours[part.part.id]
                          ).lerp(WHITE, 0.14),
                      hovered: !sweeping && under.has(part.part.id),
                      selected: filled(part.part.id),
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
