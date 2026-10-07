import * as React from "react"
import * as THREE from "three"

// The theme's tokens are oklch(), which THREE.Color can't parse. A 2D canvas can:
// paint the colour and read the pixel back.
let ctx: CanvasRenderingContext2D | null = null

function resolve(css: string): THREE.Color {
  if (!ctx) {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    ctx = canvas.getContext("2d", { willReadFrequently: true })
  }
  if (!ctx) return new THREE.Color("#888")
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return new THREE.Color().setRGB(
    r / 255,
    g / 255,
    b / 255,
    THREE.SRGBColorSpace
  )
}

export type ThemeColors = {
  foreground: THREE.Color
  muted: THREE.Color
  destructive: THREE.Color
  /** what the surfaces of a picked part turn */
  picked: THREE.Color
  /** the plane a model is cut open along */
  section: THREE.Color
  dark: boolean
}

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => resolve(style.getPropertyValue(name).trim())
  return {
    foreground: token("--foreground"),
    muted: token("--muted-foreground"),
    destructive: token("--destructive"),
    picked: token("--selection-fill"),
    section: token("--section"),
    dark: document.documentElement.classList.contains("dark"),
  }
}

/** The theme's colours as THREE.Colors, re-read whenever light/dark flips. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = React.useState(read)
  React.useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])
  return colors
}
