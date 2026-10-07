// Reading a model's files into something that draws fast.
//
// CAD exporters write one mesh per face: tens of thousands of them for a circuit board,
// each one a separate draw. Here every face that wears the same colour is joined into one
// mesh per part (a frame of the first test model went from ~160 ms to ~6 ms), and the
// face each triangle came from is kept, so a click can still be traced to a face.
import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { MeshBVH } from "three-mesh-bvh"

import type { Model, Part } from "@/lib/model"
import { piecesOf, waysOut } from "./apart"
import { contoursOf, type Contours } from "./contours"
import { shellOf } from "./shell"

/** The faces of one part that share a colour, as a single mesh. */
export type Skin = {
  /** in the part's own frame, model mm */
  geometry: THREE.BufferGeometry
  /** the colour the file gave these faces; null if it gave none */
  color: THREE.Color | null
  /** for each triangle, the face of the part it belongs to */
  faceOf: Uint32Array
}

export type LoadedPart = {
  part: Part
  skins: Skin[]
  /** x1 y1 z1 x2 y2 z2 per segment, model mm */
  edges: Float32Array
  /** where its curved faces may show their outline, which no edge marks */
  contours: Contours
  /** its surfaces close a volume, so a cut through it leaves a face to fill in */
  solid: boolean
  /** its group's place among the model's groups: what gives a part with no colour one */
  turn: number
  /** in the part's own frame */
  box: THREE.Box3
  /** where the part sits in the model */
  home: THREE.Matrix4
  /** where it moves to when the model is exploded, mm: with the rest of its piece */
  away: THREE.Vector3
  faces: number
}

export type LoadedModel = {
  model: Model
  parts: LoadedPart[]
  /** the assembled model, model mm */
  box: THREE.Box3
  /** not a model of the project's: the cube shown until it has one */
  standIn?: true
}

// glTF is Y-up metres; the model is Z-up millimetres
const TO_MODEL = new THREE.Matrix4()
  .makeRotationX(Math.PI / 2)
  .multiply(new THREE.Matrix4().makeScale(1000, 1000, 1000))

function float3(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
) {
  const out = new Float32Array(attribute.count * 3)
  const direct =
    !("isInterleavedBufferAttribute" in attribute) &&
    attribute.array instanceof Float32Array &&
    attribute.itemSize === 3
  if (direct) out.set(attribute.array.subarray(0, out.length))
  else {
    for (let i = 0; i < attribute.count; i++) {
      out[i * 3] = attribute.getX(i)
      out[i * 3 + 1] = attribute.getY(i)
      out[i * 3 + 2] = attribute.getZ(i)
    }
  }
  return new THREE.BufferAttribute(out, 3)
}

/** Position, normal and index only, moved into the part's frame, so faces can be joined. */
function plain(source: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", float3(source.attributes.position))
  if (source.attributes.normal)
    geometry.setAttribute("normal", float3(source.attributes.normal))
  const count = source.attributes.position.count
  geometry.setIndex(
    source.index
      ? Array.from(source.index.array)
      : Array.from({ length: count }, (_, i) => i)
  )
  geometry.applyMatrix4(matrix)
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  return geometry
}

/** The colour a face came with, unless it is the loader's stand-in for "none given". */
function fileColor(
  material: THREE.Material | THREE.Material[]
): THREE.Color | null {
  const one = Array.isArray(material) ? material[0] : material
  const color = (one as THREE.MeshStandardMaterial).color
  if (!color || (color.getHex() === 0xffffff && !one.name)) return null
  return color.clone()
}

function join(
  scene: THREE.Object3D,
  part: Part
): { skins: Skin[]; faces: number } {
  scene.updateMatrixWorld(true)
  type Bucket = {
    color: THREE.Color | null
    faces: THREE.BufferGeometry[]
    faceOf: number[]
  }
  const buckets = new Map<string, Bucket>()
  let faces = 0

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const color = part.paint === "all" ? null : fileColor(mesh.material)
    const key = color ? color.getHexString() : "none"
    let bucket = buckets.get(key)
    if (!bucket) buckets.set(key, (bucket = { color, faces: [], faceOf: [] }))
    const geometry = plain(
      mesh.geometry,
      TO_MODEL.clone().multiply(mesh.matrixWorld)
    )
    const triangles = (geometry.index?.count ?? 0) / 3
    for (let i = 0; i < triangles; i++) bucket.faceOf.push(faces)
    bucket.faces.push(geometry)
    faces++
  })

  const skins: Skin[] = []
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.faces, false)
    for (const face of bucket.faces) face.dispose()
    if (!geometry)
      throw new Error(`The faces of "${part.label}" could not be joined.`)
    // indirect: leave the triangle order alone, since faceOf is indexed by it
    geometry.boundsTree = new MeshBVH(geometry, { indirect: true })
    geometry.computeBoundingBox()
    skins.push({
      geometry,
      color: bucket.color,
      faceOf: Uint32Array.from(bucket.faceOf),
    })
  }
  return { skins, faces }
}

async function loadPart(
  part: Part,
  url: (file: string) => string
): Promise<LoadedPart> {
  const [gltf, edges] = await Promise.all([
    new GLTFLoader().loadAsync(url(part.file)),
    part.edges
      ? fetch(url(part.edges)).then(async (response) =>
          response.ok ? new Float32Array(await response.arrayBuffer()) : null
        )
      : null,
  ])
  const { skins, faces } = join(gltf.scene, part)
  const box = new THREE.Box3()
  for (const skin of skins)
    if (skin.geometry.boundingBox) box.union(skin.geometry.boundingBox)
  const home = new THREE.Matrix4()
  if (part.matrix)
    home.set(...(part.matrix as Parameters<THREE.Matrix4["set"]>))
  return {
    part,
    skins,
    edges: edges ?? creases(skins),
    contours: contours(skins, edges !== null),
    solid: enclose(skins),
    turn: 0,
    box,
    home,
    away: new THREE.Vector3(...part.explode),
    faces,
  }
}

/**
 * Whether a part's skins close a volume between them. Each is also told which way its
 * points go when the part is drawn in a little, which is how one part is found to be
 * inside another by more than the roughness of their surfaces.
 */
function enclose(skins: Skin[]): boolean {
  const { closed, inward } = shellOf(
    skins.map((skin) => ({
      position: skin.geometry.attributes.position.array,
      index: skin.geometry.index!.array,
    }))
  )
  skins.forEach((skin, index) =>
    skin.geometry.setAttribute(
      "inward",
      new THREE.BufferAttribute(inward[index], 3)
    )
  )
  return closed
}

/** Two triangles that meet at more than this, in degrees, have an edge between them. */
const CREASE = 20

/**
 * Where a part's curved faces may show their outline. With the CAD's own edges to go
 * by, a surface is one of the part's faces: its edges are drawn already, and only the
 * lines within it are in question. Without them, it is as far as the triangles go on
 * meeting at no more than a slight angle, since the sharper meetings are drawn as edges.
 */
function contours(skins: Skin[], exact: boolean): Contours {
  const slight = Math.cos((CREASE * Math.PI) / 180)
  const runs = skins.map((skin) =>
    contoursOf(
      skin.geometry.attributes.position.array,
      skin.geometry.index!.array,
      exact
        ? (triangle, other) => skin.faceOf[triangle] === skin.faceOf[other]
        : (_, __, cos) => cos > slight
    )
  )
  return {
    ends: Float32Array.from(runs.flatMap((run) => run.ends)),
    ways: Float32Array.from(runs.flatMap((run) => run.ways)),
  }
}

/**
 * Edges for a part whose build did not supply any: wherever two triangles meet at more
 * than a slight angle. Not as exact as the CAD's own edges (a smooth blend between two
 * faces leaves no line), but enough to draw the part in outline.
 */
function creases(skins: Skin[]): Float32Array {
  const runs = skins.map((skin) => {
    const edges = new THREE.EdgesGeometry(skin.geometry, CREASE)
    const positions = edges.attributes.position.array as Float32Array
    edges.dispose()
    return positions
  })
  const all = new Float32Array(runs.reduce((sum, run) => sum + run.length, 0))
  let offset = 0
  for (const run of runs) {
    all.set(run, offset)
    offset += run.length
  }
  return all
}

/**
 * Load every part. `revision` is stamped on each request, so a rebuilt model is never
 * served from a stale copy.
 */
/**
 * Where the surfaces of a part are, in the model, taken all together: the middle of
 * them, each triangle counting for its size, and how much of them there is.
 */
function surfaceOf(part: LoadedPart): { centre: THREE.Vector3; area: number } {
  const centre = new THREE.Vector3()
  let area = 0
  const [a, b, c] = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]
  const [ab, ac] = [new THREE.Vector3(), new THREE.Vector3()]
  for (const { geometry } of part.skins) {
    const at = geometry.attributes.position
    const index = geometry.index
    const corners = index ? index.count : at.count
    for (let i = 0; i + 2 < corners; i += 3) {
      a.fromBufferAttribute(at, index ? index.getX(i) : i)
      b.fromBufferAttribute(at, index ? index.getX(i + 1) : i + 1)
      c.fromBufferAttribute(at, index ? index.getX(i + 2) : i + 2)
      const size = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2
      centre.addScaledVector(a.add(b).add(c), size / 3)
      area += size
    }
  }
  if (area > 0) centre.divideScalar(area)
  else part.box.getCenter(centre)
  return { centre: centre.applyMatrix4(part.home), area }
}

export async function loadModel(
  model: Model,
  baseUrl: string,
  revision: number,
  onProgress: (done: number, total: number) => void
): Promise<LoadedModel> {
  const url = (file: string) => `${baseUrl}${file}?r=${revision}`
  let done = 0
  onProgress(0, model.parts.length)
  const parts = await Promise.all(
    model.parts.map(async (part) => {
      const loaded = await loadPart(part, url).catch((error: unknown) => {
        throw new Error(
          `Could not load "${part.label}" (${part.file}): ${error instanceof Error ? error.message : String(error)}`
        )
      })
      onProgress(++done, model.parts.length)
      return loaded
    })
  )
  for (const part of parts)
    part.turn = Math.max(
      0,
      model.groups.findIndex((group) => group.id === part.part.group)
    )
  const box = new THREE.Box3()
  for (const part of parts) box.union(part.box.clone().applyMatrix4(part.home))

  // A model that does not say how it comes apart is pulled out from its middle: not part
  // by part, but piece by piece, where the parts of a group that are one object go
  // together, and each piece clear of the rest (see apart.ts). A part goes as its piece.
  if (parts.every((part) => part.away.lengthSq() === 0)) {
    const middle = box.getCenter(new THREE.Vector3())
    const boxes = parts.map((part) => part.box.clone().applyMatrix4(part.home))
    const pieces = piecesOf(
      parts.map((part, index) => ({
        group: part.part.group,
        box: boxes[index],
      })),
      model.groups,
      box.getSize(new THREE.Vector3()).length()
    )
    // a piece is all of its parts: the box round them, and where their surfaces are,
    // each counting for as much as there is of it
    const wholes = new Map<
      number,
      { box: THREE.Box3; centre: THREE.Vector3; area: number }
    >()
    pieces.forEach((piece, index) => {
      const { centre, area } = surfaceOf(parts[index])
      const whole = wholes.get(piece)
      if (whole) {
        whole.box.union(boxes[index])
        whole.centre.addScaledVector(centre, area)
        whole.area += area
      } else
        wholes.set(piece, {
          box: boxes[index].clone(),
          centre: centre.multiplyScalar(area),
          area,
        })
    })
    for (const whole of wholes.values())
      if (whole.area > 0) whole.centre.divideScalar(whole.area)
      else whole.box.getCenter(whole.centre)
    const ways = waysOut(
      [...wholes.values()],
      middle,
      box.getSize(new THREE.Vector3()).length()
    )
    const way = new Map([...wholes.keys()].map((piece, n) => [piece, ways[n]]))
    parts.forEach((part, index) => part.away.copy(way.get(pieces[index])!))
  }
  return { model, parts, box }
}

/** How big the cube shown for a project with no model is, in mm a side. */
const STAND_IN = 40

/**
 * What a project with no model yet is shown as: a plain cube standing on the ground, the
 * way a 3D program opens. It is in no file. The first model built in the folder takes
 * its place.
 */
export function standInModel(): LoadedModel {
  const geometry = new THREE.BoxGeometry(STAND_IN, STAND_IN, STAND_IN)
  geometry.translate(0, 0, STAND_IN / 2)
  geometry.computeBoundingBox()
  geometry.boundsTree = new MeshBVH(geometry, { indirect: true })
  // a box is drawn as two triangles a side
  const skin: Skin = {
    geometry,
    color: null,
    faceOf: Uint32Array.from({ length: 12 }, (_, triangle) => triangle >> 1),
  }
  const part: Part = {
    id: "stand-in",
    label: "Cube",
    group: "stand-in",
    file: "",
    edges: null,
    // a plain grey: it is nothing yet, and is not to look like something
    color: "#aeb2b9",
    paint: "all",
    matrix: null,
    explode: [0, 0, 0],
    glass: null,
    metal: false,
  }
  const box = geometry.boundingBox!.clone()
  // The view frames a model's box closely. Left to that the cube would fill the window,
  // so it is given room: something to look at in the middle, not a wall.
  const stage = box.clone().expandByScalar(STAND_IN * 0.75)
  return {
    standIn: true,
    model: {
      title: null,
      parts: [part],
      groups: [{ id: "stand-in", label: "Nothing made yet", shell: false }],
      keepouts: [],
      keepoutsLabel: "",
      downloads: [],
    },
    parts: [
      {
        part,
        skins: [skin],
        edges: creases([skin]),
        contours: contours([skin], false),
        solid: enclose([skin]),
        turn: 0,
        box,
        home: new THREE.Matrix4(),
        away: new THREE.Vector3(),
        faces: 6,
      },
    ],
    box: stage,
  }
}

export function disposeModel(loaded: LoadedModel) {
  for (const part of loaded.parts) {
    for (const skin of part.skins) {
      skin.geometry.boundsTree = undefined
      skin.geometry.dispose()
    }
  }
}
