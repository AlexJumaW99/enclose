// An example as it is fetched: its folder in one file. The files are put one after
// another, each behind a header that names it (a tar archive, which anything opens),
// and the whole is squeezed with Brotli, which Node has of its own: meshes of the same
// screw twenty times over come out a twelfth the size.
//
// Nothing here is the app's alone: scripts/examples.mjs packs with it what the app
// unpacks with it. It is read by Node as it is, so it asks for nothing but Node's own.
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

/** A file of an example: where it is in the example's folder, and what is in it. */
export type Filed = { path: string; data: Buffer }

/** What is never an example's: what a build or a Mac leaves lying in a folder. */
export const LEFT_BEHIND = new Set(["__pycache__", ".DS_Store"])

/** What an archive is cut into: a header is one of these, and a file fills whole ones. */
const BLOCK = 512
/** Where a header keeps a file's name, its size, the sum of the header, and its kind. */
const NAME = { at: 0, length: 100 }
const SIZE = { at: 124, length: 12 }
const SUM = { at: 148, length: 8 }
const KIND = 156
const FILE = "0"
/** The most an example may come to, unpacked: nothing fetched is let grow past it. */
const MOST = 1024 ** 3

/** Every file in a folder, however deep, in an order that is the same every time. */
export function filesIn(dir: string, under = ""): Filed[] {
  return fs
    .readdirSync(path.join(dir, under), { withFileTypes: true })
    .filter((entry) => !LEFT_BEHIND.has(entry.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      const at = under ? `${under}/${entry.name}` : entry.name
      if (entry.isDirectory()) return filesIn(dir, at)
      return entry.isFile()
        ? [{ path: at, data: fs.readFileSync(path.join(dir, at)) }]
        : []
    })
}

/** A number as a header writes it: in eights, with a nothing after it. */
const eights = (n: number, length: number) =>
  n.toString(8).padStart(length - 1, "0") + "\0"

/**
 * Files as one archive. Nothing of when or by whom it was made goes in, so the same
 * files make the same archive, byte for byte, whoever packs them.
 */
export function tar(files: Filed[]): Buffer {
  const blocks: Buffer[] = []
  for (const file of files) {
    const name = Buffer.from(file.path)
    if (name.length > NAME.length)
      throw new Error(`"${file.path}" is too long a name for an archive`)
    const header = Buffer.alloc(BLOCK)
    name.copy(header, NAME.at)
    header.write(eights(0o644, 8), 100) // who may read it
    header.write(eights(0, 8), 108) // whose it is
    header.write(eights(0, 8), 116)
    header.write(eights(file.data.length, SIZE.length), SIZE.at)
    header.write(eights(0, 12), 136) // when it was written
    header.write(FILE, KIND)
    header.write("ustar\0" + "00", 257)
    // the sum is of the header with spaces where the sum goes
    header.fill(" ", SUM.at, SUM.at + SUM.length)
    const sum = header.reduce((total, byte) => total + byte, 0)
    header.write(eights(sum, 7) + " ", SUM.at)
    blocks.push(header, file.data)
    const over = file.data.length % BLOCK
    if (over > 0) blocks.push(Buffer.alloc(BLOCK - over))
  }
  // two empty blocks say that is all
  blocks.push(Buffer.alloc(BLOCK * 2))
  return Buffer.concat(blocks)
}

const text = (header: Buffer, at: number, length: number) =>
  header
    .subarray(at, at + length)
    .toString()
    .replace(/\0.*$/s, "")

/**
 * The files in an archive. Only files are taken from it, and only ones that name a place
 * inside the folder they are unpacked to: not one that climbs out of it.
 */
export function untar(archive: Buffer): Filed[] {
  const files: Filed[] = []
  for (let at = 0; at + BLOCK <= archive.length;) {
    const header = archive.subarray(at, at + BLOCK)
    if (header.every((byte) => byte === 0)) break
    const name = text(header, NAME.at, NAME.length)
    const size = parseInt(text(header, SIZE.at, SIZE.length).trim(), 8)
    const kind = String.fromCharCode(header[KIND])
    at += BLOCK
    if (!Number.isInteger(size) || size < 0 || at + size > archive.length)
      throw new Error("The archive is cut short")
    if (kind === FILE || kind === "\0") {
      const parts = name.split("/")
      if (
        name === "" ||
        path.isAbsolute(name) ||
        name.includes("\\") ||
        parts.some((part) => part === "" || part === "." || part === "..")
      )
        throw new Error(`The archive has a file out of place: "${name}"`)
      files.push({ path: name, data: archive.subarray(at, at + size) })
    }
    at += Math.ceil(size / BLOCK) * BLOCK
  }
  return files
}

/** A folder as the archive an example is fetched as. It takes its time: it is done once. */
export function pack(dir: string): Buffer {
  const whole = tar(filesIn(dir))
  return zlib.brotliCompressSync(whole, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      // far enough back to find a mesh that is in the folder twice
      [zlib.constants.BROTLI_PARAM_LGWIN]:
        zlib.constants.BROTLI_MAX_WINDOW_BITS,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: whole.length,
    },
  })
}

/** The files of an example, from the archive it was fetched as. */
export function unpack(packed: Buffer): Promise<Filed[]> {
  return new Promise((resolve, reject) => {
    zlib.brotliDecompress(packed, { maxOutputLength: MOST }, (error, whole) => {
      if (error) return reject(error)
      try {
        resolve(untar(whole))
      } catch (thrown) {
        reject(thrown instanceof Error ? thrown : new Error(String(thrown)))
      }
    })
  })
}
