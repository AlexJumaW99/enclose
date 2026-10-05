// The icons lucide has no drawing for. Same grid and stroke as lucide's, so they sit
// beside its icons without looking like visitors.
import * as React from "react"

type IconProps = React.ComponentProps<"svg">

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

// a cube seen corner-on, as lucide draws its box: the outline, then its three faces
const CUBE =
  "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
const TOP = "M12 12 3.3 7 12 2l8.7 5Z"
const LEFT = "M12 12v10l-8.7-5V7Z"
const RIGHT = "M12 12l8.7-5v10L12 22Z"
const NEAR_EDGES = "m3.3 7 8.7 5 8.7-5M12 22V12"
const FAR_EDGES = "M12 12V2.5M12 12l-8.7 5M12 12l8.7 5"

/** Parts drawn as they are: opaque. */
export function SolidIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g stroke="none" fill="currentColor">
        <path d={TOP} fillOpacity="0.95" />
        <path d={LEFT} fillOpacity="0.6" />
        <path d={RIGHT} fillOpacity="0.32" />
      </g>
      <path d={CUBE} />
    </Icon>
  )
}

/** The outside drawn see-through, so what is inside it shows. */
export function GlassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={CUBE} strokeOpacity="0.55" />
      <path
        d="M12 7.4 16 9.7v4.6l-4 2.3-4-2.3V9.7Z"
        fill="currentColor"
        stroke="none"
      />
    </Icon>
  )
}

/** Edges only, the hidden ones included. */
export function WireframeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={CUBE} />
      <path d={NEAR_EDGES} />
      <path d={FAR_EDGES} strokeWidth="1.25" strokeDasharray="1.5 2.5" />
    </Icon>
  )
}

/** A body cut through: one half whole, the other showing its hatched cut face. */
export function SectionIcon(props: IconProps) {
  const clip = React.useId()
  return (
    <Icon {...props}>
      <defs>
        <clipPath id={clip}>
          <path d="M5 12V9a7 7 0 0 1 14 0v3Z" />
        </clipPath>
      </defs>
      <path d="M5 12v3a7 7 0 0 0 14 0v-3Z" fill="currentColor" />
      <path d="M5 12V9a7 7 0 0 1 14 0v3" />
      <path
        clipPath={`url(#${clip})`}
        strokeWidth="1.75"
        d="M3 9.5 10.5 2M5 13 16 2M10 13.5 20.5 3M15.5 13.5l6-6"
      />
    </Icon>
  )
}
