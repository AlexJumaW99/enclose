// The reference scenes a model can be seen in: things of a known real size, drawn round
// it so that how big it is can be told. A desk for it to stand on, a room to stand in.
// The app has some of its own, and a project can have one in its folder (see
// electron/reference.ts); kit/enclose.py writes them, and says what is in one.
import type { ReferenceSource, Vec3 } from "@shared/api"

export type ReferenceScene = {
  /** what it is known by: the name of one of the app's own, or "own" for the project's */
  id: string
  /** the project's own, and not one of the app's */
  own: boolean
  /** what the list of scenes calls it */
  name: string
  /** what the list says under that: the sizes that make it something to measure by */
  detail: string
  /**
   * Where a model stands in it, in the scene's own frame (mm, Z up): the middle of the
   * model's underside is put there. The top of a table, a place on a floor.
   */
  stand: Vec3
  /**
   * Which side of the model is put there in place of its middle, along x and along y:
   * -1 the side it has towards the low end of the axis, 1 the one towards the high end,
   * 0 its middle. A model that is to stand beside something in the scene stands
   * against it, and so is clear of it whatever its own size.
   */
  against: [x: number, y: number]
  /** how high up the ground is that the scene itself stands on, in its own frame */
  floor: number
  /** how big a model it is for, at the most, along x, y and z: null for any size */
  upTo: Vec3 | null
  /** its meshes, each as an address to load it from */
  files: string[]
  /**
   * Those of them that are the figure of a person, there to be shown or not: left out
   * until whoever is looking asks for one (see `withFigure`).
   */
  figures: string[]
}

const text = (v: unknown): string => (typeof v === "string" ? v : "")
const vec3 = (v: unknown): Vec3 | null =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every((n) => typeof n === "number" && Number.isFinite(n))
    ? (v as Vec3)
    : null

/** Which side of a model a scene has it stand by, each way: its middle where none is said. */
const sides = (v: unknown): [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number")
    ? [Math.sign(v[0] as number), Math.sign(v[1] as number)]
    : [0, 0]

/**
 * A scene as the view uses it, from its manifest as the app's own process handed it
 * over. `revision` is stamped on each of its files, so that one built again is never
 * drawn from a stale copy. Null where the manifest names nothing to draw.
 */
export function readReference(
  source: ReferenceSource,
  revision = 0
): ReferenceScene | null {
  const manifest = source.manifest as Record<string, unknown> | null
  if (!manifest || !Array.isArray(manifest.parts)) return null
  const parts = manifest.parts.flatMap(
    (part: { file?: unknown; figure?: unknown } | null) =>
      typeof part?.file === "string" && part.file
        ? [
            {
              file: `${source.baseUrl}${part.file}?r=${revision}`,
              figure: part.figure === true,
            },
          ]
        : []
  )
  const files = parts.map((part) => part.file)
  if (files.length === 0) return null
  const figures = parts.filter((part) => part.figure).map((part) => part.file)
  const upTo = vec3(manifest.upTo)
  return {
    id: source.id,
    own: source.own,
    name: text(manifest.name) || (source.own ? "This project's" : source.id),
    detail: text(manifest.detail),
    stand: vec3(manifest.stand) ?? [0, 0, 0],
    against: sides(manifest.against),
    floor: typeof manifest.floor === "number" ? manifest.floor : 0,
    upTo: upTo && upTo.every((n) => n > 0) ? upTo : null,
    files,
    // a scene that is nothing but a figure has it as what it is, not as one to be asked for
    figures: figures.length < files.length ? figures : [],
  }
}

/**
 * A scene as it is to be drawn: with the figure of a person that it has, where one is
 * asked for, or with none of its files that are one.
 */
export function withFigure(
  scene: ReferenceScene,
  shown: boolean
): ReferenceScene {
  if (shown || scene.figures.length === 0) return scene
  return {
    ...scene,
    files: scene.files.filter((file) => !scene.figures.includes(file)),
  }
}

/** Whether a figure of a person is among what is drawn of a scene. */
export const hasFigure = (scene: ReferenceScene): boolean =>
  scene.figures.some((file) => scene.files.includes(file))

/**
 * Where a scene is put for a model to stand in it: what the scene is moved by, in the
 * model's frame, so that the place in it where a model stands is under the model. Under
 * its middle, or under the side of it that the scene has it stand by.
 */
export function placed(
  scene: Pick<ReferenceScene, "stand" | "against">,
  model: { min: Vec3; max: Vec3 }
): Vec3 {
  const by = (axis: 0 | 1) => {
    const side = scene.against[axis]
    return side < 0
      ? model.min[axis]
      : side > 0
        ? model.max[axis]
        : (model.min[axis] + model.max[axis]) / 2
  }
  return [
    by(0) - scene.stand[0],
    by(1) - scene.stand[1],
    model.min[2] - scene.stand[2],
  ]
}

/** Whether a model of this size is no bigger than a scene is for, whichever way it is turned on its base. */
function holds(upTo: Vec3 | null, size: Vec3): boolean {
  if (!upTo) return true
  const [long, short] = [size[0], size[1]].sort((a, b) => b - a)
  const [most, least] = [upTo[0], upTo[1]].sort((a, b) => b - a)
  return long <= most && short <= least && size[2] <= upTo[2]
}

/**
 * The scene a model is shown in when none is asked for by name. The one the user last
 * picked for the project, if it is still there. Failing that the project's own, which
 * was made for it. Failing that the one the model itself names, which whoever built the
 * model chose by where the thing is used. And failing all of them, by size: the first
 * of the app's that the model is not too big for, in the order they come, which is from
 * the one for the smallest things up.
 */
export function sceneFor(
  scenes: ReferenceScene[],
  model: { reference: string | null; size: Vec3 },
  picked: string | null = null
): ReferenceScene | null {
  const known = (id: string | null) =>
    id === null ? undefined : scenes.find((scene) => scene.id === id)
  const apps = scenes.filter((scene) => !scene.own)
  return (
    known(picked) ??
    scenes.find((scene) => scene.own) ??
    apps.find((scene) => scene.id === model.reference) ??
    apps.find((scene) => holds(scene.upTo, model.size)) ??
    apps.at(-1) ??
    null
  )
}
