import * as THREE from "three"
import { cn } from "cn"

import type { Vec3 } from "@shared/api"
import { nearestAxis, normalOf, turnTo, type Axis } from "@/lib/orient"
import { useStore } from "@/lib/store"
import { bridge, useOrientation } from "./bridge"

const COLOR: Record<Axis, string> = {
  x: "var(--axis-x)",
  y: "var(--axis-y)",
  z: "var(--axis-z)",
}
/** Half the side of each square, on a cube of side 1; a little short, so they stay apart. */
const H = 0.4
/** How large the cube is drawn in the widget's 100-unit square. */
const SIZE = 50

// Three walls of a box, meeting at the corner furthest from where the camera starts:
// one square across each axis.
const WALLS: { axis: Axis; corners: Vec3[] }[] = [
  {
    axis: "x",
    corners: [
      [-0.5, -H, -H],
      [-0.5, H, -H],
      [-0.5, H, H],
      [-0.5, -H, H],
    ],
  },
  {
    axis: "y",
    corners: [
      [-H, 0.5, -H],
      [H, 0.5, -H],
      [H, 0.5, H],
      [-H, 0.5, H],
    ],
  },
  {
    axis: "z",
    corners: [
      [-H, -H, -0.5],
      [H, -H, -0.5],
      [H, H, -0.5],
      [-H, H, -0.5],
    ],
  },
]

/** A section through the middle of the model across one axis, with the near half cut away. */
export function sectionAcross(axis: Axis, middle: Vec3) {
  const index = { x: 0, y: 1, z: 2 }[axis]
  const eye = bridge.eye?.() ?? [0, -1, 0]
  // keep the half further from the camera, so the cut face is what you see
  return {
    position: middle,
    turn: turnTo(axis, eye[index] > 0 ? -1 : 1),
    flipped: false,
  }
}

/**
 * The section to start with: across the axis the camera faces most squarely, which opens
 * the model up towards you.
 */
export function sectionFacing(box: THREE.Box3) {
  const { axis } = nearestAxis(bridge.eye?.() ?? [0, -1, 0])
  return sectionAcross(axis, box.getCenter(new THREE.Vector3()).toArray())
}

/**
 * Shown while a section is on: the three ways to cut, turning with the camera so each
 * square lies the way its cut would.
 */
export function SectionPlanes({
  middle,
  className,
}: {
  /** the middle of the model, where a newly chosen cut passes */
  middle: Vec3
  className?: string
}) {
  const turn = useOrientation()
  const section = useStore((state) => state.view.section)
  const setView = useStore((state) => state.setView)
  if (!section) return null

  const across = nearestAxis(normalOf(section.turn))
  const walls = WALLS.map(({ axis, corners }) => {
    const seen = corners.map((corner) =>
      new THREE.Vector3(...corner).applyQuaternion(turn)
    )
    return {
      axis,
      points: seen.map((p) => `${p.x * SIZE},${-p.y * SIZE}`).join(" "),
      depth: seen.reduce((sum, p) => sum + p.z, 0) / seen.length,
      x: (seen.reduce((sum, p) => sum + p.x, 0) / seen.length) * SIZE,
      y: (-seen.reduce((sum, p) => sum + p.y, 0) / seen.length) * SIZE,
    }
  }).sort((a, b) => a.depth - b.depth)

  return (
    <svg
      viewBox="-50 -50 100 100"
      role="group"
      aria-label="Section plane"
      // the same size as the axes it stands beside
      className={cn("pointer-events-auto size-22 select-none", className)}
    >
      {walls.map(({ axis, points, x, y }) => {
        const chosen = across.exact && across.axis === axis
        return (
          <g
            key={axis}
            className="group/wall cursor-pointer"
            onClick={() => setView({ section: sectionAcross(axis, middle) })}
          >
            <title>{`Cut across ${axis.toUpperCase()} (${axis.toUpperCase()})`}</title>
            <polygon
              points={points}
              fill={COLOR[axis]}
              stroke={COLOR[axis]}
              strokeWidth={chosen ? 2 : 1}
              strokeLinejoin="round"
              className={cn(
                "transition-[fill-opacity,stroke-opacity]",
                chosen
                  ? "[fill-opacity:0.55] [stroke-opacity:1]"
                  : "[fill-opacity:0.14] [stroke-opacity:0.45] group-hover/wall:[fill-opacity:0.3]"
              )}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fontWeight={700}
              className={cn(
                "fill-foreground",
                chosen ? "opacity-100" : "opacity-60"
              )}
            >
              {axis.toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
