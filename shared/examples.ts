// The projects the app has to start from, for someone with none of their own yet. They
// are not in the app, which would be six times the size for them: each is one archive,
// kept with the app's releases, fetched when it is asked for and unpacked where new
// projects go. What the app has of them is this list (scripts/examples.mjs writes the
// sizes and the sums into examples.json as it packs them) and a picture of each.
import packed from "./examples.json"

export type Example = {
  /** the folder it is in examples/, and what its archive is named after */
  id: string
  /** what the project made of it is called */
  name: string
  /** how big its archive is, in bytes: what there is to fetch */
  bytes: number
  /** the archive's SHA-256: what is fetched is the example only if this is its sum */
  sha256: string
}

export const EXAMPLES: Example[] = packed.examples

/**
 * Where the archives are kept: with a release of the app's repository that is named for
 * them and never changed. Examples that change are another release, and an app made
 * before it goes on fetching the ones it was made with.
 */
export const EXAMPLES_URL = `https://github.com/glauberxyz/enclose/releases/download/${packed.release}/`

/** What an example's archive is called, where they are kept. */
export const archiveOf = (example: Example) => `${example.id}.tar.br`
