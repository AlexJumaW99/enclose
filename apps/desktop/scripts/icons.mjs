// The app's icon in the sizes each system asks for, made from icons/icon.png, and the
// picture behind the installer's window, made from installer/background.svg. And the
// icon the app has when it is run from a checkout, made from icons/icon-dev.png: the
// same mark on another colour, so that the app being worked on is told at a glance from
// the one that is installed. Run it again when a drawing changes. It needs a Mac: sips
// and iconutil come with one.
//   npm run icons
import { execFileSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const icons = resolve(import.meta.dirname, "../icons")
const drawing = join(icons, "icon.png")
const work = mkdtempSync(join(tmpdir(), "enclose-icons-"))

const sips = (...args) => execFileSync("sips", args, { stdio: "ignore" })

/** The picture in `from`, `size` pixels across, written to `to`. */
function scale(from, size, to) {
  sips("-z", String(size), String(size), from, "--out", to)
  return to
}

// macOS: one file holding five sizes, each at one pixel to the point and at two
for (const name of ["icon", "icon-dev"]) {
  const iconset = join(work, `${name}.iconset`)
  mkdirSync(iconset)
  for (const points of [16, 32, 128, 256, 512]) {
    const size = `icon_${points}x${points}`
    scale(join(icons, `${name}.png`), points, join(iconset, `${size}.png`))
    scale(
      join(icons, `${name}.png`),
      points * 2,
      join(iconset, `${size}@2x.png`)
    )
  }
  execFileSync("iconutil", [
    "--convert",
    "icns",
    iconset,
    "--output",
    join(icons, `${name}.icns`),
  ])
}

// Everywhere else an icon fills its square. The drawing is on Apple's grid, a tile of
// 824 in a square of 1024: cut the margin away, down to where the tile's shadow ends.
const tile = join(work, "tile.png")
sips("--cropToHeightWidth", "870", "870", drawing, "--out", tile)

// Linux: one picture, which the desktop scales
scale(tile, 512, join(icons, "icon-512.png"))

// Windows: one file again, a list of what is in it and then the pictures themselves
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pictures = sizes.map((size) =>
  readFileSync(scale(tile, size, join(work, `${size}.png`)))
)
const list = Buffer.alloc(6 + 16 * sizes.length)
list.writeUInt16LE(1, 2) // icons, not cursors
list.writeUInt16LE(sizes.length, 4)
let at = list.length
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i
  list.writeUInt8(size % 256, entry) // width, where 256 is written as 0
  list.writeUInt8(size % 256, entry + 1) // height
  list.writeUInt16LE(1, entry + 4) // colour planes
  list.writeUInt16LE(32, entry + 6) // bits to the pixel
  list.writeUInt32LE(pictures[i].length, entry + 8)
  list.writeUInt32LE(at, entry + 12)
  at += pictures[i].length
})
writeFileSync(join(icons, "icon.ico"), Buffer.concat([list, ...pictures]))

// The installer: what the disk image's window shows behind the app and the folder it is
// dragged to, at one pixel to the point and at two (scripts/dist.mjs says what stands
// where on it). It is a drawing in lines, so each size is drawn afresh and not scaled.
const installer = resolve(import.meta.dirname, "../installer")
const behind = join(installer, "background.svg")
const [, wide, high] = /width="(\d+)" height="(\d+)"/.exec(
  readFileSync(behind, "utf8")
)
for (const [times, name] of [
  [1, "background.png"],
  [2, "background@2x.png"],
])
  sips(
    "--setProperty",
    "format",
    "png",
    "--resampleHeightWidth",
    String(high * times),
    String(wide * times),
    behind,
    "--out",
    join(installer, name)
  )

rmSync(work, { recursive: true })
