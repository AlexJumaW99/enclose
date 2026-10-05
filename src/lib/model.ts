// A project's model as the app uses it, read from whatever manifest the project wrote.
// The format is described in shared/manifest-format.ts.
import type { Vec3 } from "@shared/api"

/**
 * A named group of parts, as the layers panel lists them. `shell` marks the outside of
 * the thing: the parts that go see-through in glass mode, so what they enclose shows.
 */
export type Layer = { id: string; label: string; shell: boolean }

export type Part = {
  id: string
  label: string
  layer: string
  file: string
  edges: string | null
  color: string | null
  /** all: the whole part wears `color`. bare: only faces the file left uncoloured do. */
  paint: "all" | "bare"
  /** 16 numbers, row-major */
  matrix: number[] | null
  explode: Vec3
  /** see-through in glass mode; null leaves it to the part's size */
  glass: boolean | null
  /** drawn as bare metal rather than plastic */
  metal: boolean
}

export type Keepout = {
  id: string
  label: string
  min: Vec3
  max: Vec3
  blocked: boolean
}

export type Download = {
  file: string
  name: string
  label: string
  detail: string
  kind: "full" | "set" | "part"
  bytes: number
  /** the part this file is, when it is one part */
  part: string | null
}

export type Model = {
  title: string | null
  parts: Part[]
  layers: Layer[]
  keepouts: Keepout[]
  keepoutsLabel: string
  downloads: Download[]
}

// The first project this app opened wrote its manifest before layers could be declared:
// parts carry a `group`, and the viewer it came with knew what each group meant. A
// manifest without `layers` is read the way that viewer read it.
const UNDECLARED: Record<string, Omit<Layer, "id">> = {
  enclosure: { label: "Enclosure", shell: true },
  inside: { label: "Electronics", shell: false },
  screws: { label: "Screws", shell: false },
}
const UNDECLARED_KEEPOUTS = "Cables"

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const text = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null
const vec3 = (v: unknown): Vec3 | null =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number")
    ? (v as Vec3)
    : null
const titled = (id: string) =>
  id.charAt(0).toUpperCase() + id.slice(1).replaceAll("_", " ")

/** Turn a parsed manifest into a Model, or throw saying what is wrong with it. */
export function readModel(manifest: unknown): Model {
  if (!isObject(manifest) || !Array.isArray(manifest.parts)) {
    throw new Error("The manifest has no list of parts.")
  }
  const declared = Array.isArray(manifest.layers)

  const parts: Part[] = manifest.parts.map((raw: unknown, index) => {
    if (!isObject(raw)) throw new Error(`Part ${index + 1} is not an object.`)
    const id = text(raw.id)
    const file = text(raw.file)
    if (!id || !file)
      throw new Error(`Part ${index + 1} needs an "id" and a "file".`)
    const layer = text(raw.layer) ?? text(raw.group) ?? "model"
    const color = text(raw.color)
    const matrix =
      Array.isArray(raw.matrix) && raw.matrix.length === 16
        ? (raw.matrix as number[])
        : null
    return {
      id,
      label: text(raw.label) ?? id,
      layer,
      file,
      edges: text(raw.edges),
      color,
      paint: color && (declared || layer !== "inside") ? "all" : "bare",
      matrix,
      explode: vec3(raw.explode) ?? [0, 0, 0],
      glass: typeof raw.glass === "boolean" ? raw.glass : null,
      metal: raw.finish === "metal" || (!declared && layer === "screws"),
    }
  })
  if (parts.length === 0) throw new Error("The manifest lists no parts.")
  const ids = new Set<string>()
  for (const part of parts) {
    if (ids.has(part.id))
      throw new Error(`Two parts share the id "${part.id}".`)
    ids.add(part.id)
  }

  const used = [...new Set(parts.map((p) => p.layer))]
  let layers: Layer[]
  if (declared) {
    layers = (manifest.layers as unknown[]).filter(isObject).flatMap((raw) => {
      const id = text(raw.id)
      if (!id) return []
      // "control": "shell" is how the first version of the format spelled it
      const shell = raw.shell === true || raw.control === "shell"
      return [{ id, label: text(raw.label) ?? titled(id), shell }]
    })
    // a part may name a layer nobody declared: it still gets listed
    for (const id of used) {
      if (!layers.some((l) => l.id === id))
        layers.push({ id, label: titled(id), shell: false })
    }
  } else {
    layers = used.map((id) => ({
      id,
      ...(UNDECLARED[id] ?? { label: titled(id), shell: false }),
    }))
  }

  const keepouts: Keepout[] = (
    Array.isArray(manifest.keepouts) ? manifest.keepouts : []
  )
    .filter(isObject)
    .flatMap((raw) => {
      const id = text(raw.id)
      const min = vec3(raw.min)
      const max = vec3(raw.max)
      if (!id || !min || !max) return []
      return [
        {
          id,
          label: text(raw.label) ?? id,
          min,
          max,
          blocked: Array.isArray(raw.hits) && raw.hits.length > 0,
        },
      ]
    })

  const downloads: Download[] = (
    Array.isArray(manifest.downloads) ? manifest.downloads : []
  )
    .filter(isObject)
    .flatMap((raw) => {
      const file = text(raw.file)
      if (!file) return []
      const name = text(raw.name) ?? file.split("/").at(-1) ?? file
      return [
        {
          file,
          name,
          label: text(raw.label) ?? name,
          detail: text(raw.detail) ?? "",
          kind:
            raw.kind === "full" || raw.kind === "set"
              ? raw.kind
              : ("part" as const),
          bytes: typeof raw.bytes === "number" ? raw.bytes : 0,
          part: text(raw.part),
        },
      ]
    })

  return {
    title: text(manifest.title),
    parts,
    layers,
    keepouts,
    keepoutsLabel:
      text(manifest.keepoutsLabel) ??
      (declared ? "Keep-outs" : UNDECLARED_KEEPOUTS),
    downloads,
  }
}
