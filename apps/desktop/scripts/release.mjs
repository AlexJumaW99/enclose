// A release, start to finish: what docs/development.md sets out under "A release", as
// one command. It gives the app its new version and commits that, builds, signs and
// notarizes the app for both kinds of Mac, sees that a Mac will take it, tags the commit,
// pushes it, and publishes the release with what an installed app updates itself from.
// It needs a Mac, and what notarizes the app: see scripts/dist.mjs.
//   npm run release                the next version: 0.0.4 after 0.0.3
//   npm run release -- 0.1.0       that version
//   npm run release -- --dry       see that everything is ready, and change nothing
//   npm run release -- --yes       without asking first
//
// Before it changes anything it sees that a release can be made at all: that nothing is
// uncommitted, that this is main and has all that the remote has, that the version is
// one nobody has, that the tests pass, and that a project's tool is shut in, in the app
// as it is built (scripts/sandbox.mjs). Nothing is published until the app has been
// built and a Mac has been seen to take it. If it stops after the version was committed,
// a build that failed say, run it again with that version and it goes on from there.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline/promises"

const ROOT = path.resolve(import.meta.dirname, "..")
const RELEASE = path.join(ROOT, "release")

const flags = process.argv.slice(2).filter((arg) => arg.startsWith("--"))
const [asked] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
const dry = flags.includes("--dry")
const sure = flags.includes("--yes")

/** Run a command and wait for it: what it said, where that is wanted, and how it ended. */
function run(command, args, { quiet = false, env } = {}) {
  const done = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: env ?? process.env,
    stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
  })
  return {
    ok: done.status === 0,
    said: `${done.stdout ?? ""}${done.stderr ?? ""}`.trim(),
  }
}

/** The same, for a step the release cannot go on without. */
function must(command, args, options) {
  const done = run(command, args, options)
  if (!done.ok) stop(`"${command} ${args.join(" ")}" failed.`, done.said)
  return done.said
}

function stop(why, more = "") {
  console.error(`\n[release] ${why}${more ? `\n${more}` : ""}`)
  process.exit(1)
}

const step = (what) => console.log(`\n[release] ${what}`)

const pkg = () =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))

// --- what is to be released -------------------------------------------------------------

const { version: current, productName } = pkg()
const NUMBERED = /^\d+\.\d+\.\d+$/
if (asked !== undefined && !NUMBERED.test(asked))
  stop(`"${asked}" is not a version: three numbers, as in 0.1.0.`)
const next =
  asked ?? current.replace(/\d+$/, (patch) => String(Number(patch) + 1))
// the version is this one already: it was committed by a run that then stopped
const resumed = next === current
const numbers = (version) => version.split(".").map(Number)
const later = numbers(next).some(
  (number, place) =>
    number > numbers(current)[place] &&
    numbers(next)
      .slice(0, place)
      .every((earlier, at) => earlier === numbers(current)[at])
)
if (!resumed && !later)
  stop(`${next} is not after ${current}, which is the version now.`)
const tag = `v${next}`
/** the version before, which is where what has changed is listed from */
const before = resumed
  ? run("git", ["describe", "--tags", "--abbrev=0", "--match", "v*", "HEAD^"], {
      quiet: true,
    }).said
  : `v${current}`

// --- that a release can be made ---------------------------------------------------------

step(
  `Enclose ${next}${resumed ? ", going on from where it stopped" : ` (now ${current})`}`
)
const wrong = []
if (process.platform !== "darwin") wrong.push("This is not a Mac.")
const notarized =
  process.env.APPLE_KEYCHAIN_PROFILE ||
  (process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER)
if (!notarized)
  wrong.push(
    "Nothing to notarize the app with: set APPLE_KEYCHAIN_PROFILE to a profile kept by `xcrun notarytool store-credentials`."
  )
if (run("git", ["status", "--porcelain"], { quiet: true }).said)
  wrong.push("There are uncommitted changes: commit what is to go out first.")
if (run("git", ["branch", "--show-current"], { quiet: true }).said !== "main")
  wrong.push("This is not the main branch.")
if (
  !run("git", ["fetch", "--quiet", "origin", "main", "--tags"], { quiet: true })
    .ok
)
  wrong.push("The remote could not be reached.")
else if (
  run("git", ["rev-list", "--count", "HEAD..origin/main"], { quiet: true })
    .said !== "0"
)
  wrong.push("The remote's main has commits this one has not: pull first.")
if (run("git", ["tag", "--list", tag], { quiet: true }).said)
  wrong.push(`There is a ${tag} already.`)
if (!run("gh", ["auth", "status"], { quiet: true }).ok)
  wrong.push("The GitHub CLI is not signed in: gh auth login.")
if (resumed && !before) wrong.push("No version before this one was found.")
if (wrong.length > 0) stop(wrong.join("\n[release] "))

console.log(
  `[release] ready: main is clean and up to date, and there is no ${tag} yet`
)
if (dry) {
  console.log(
    `[release] (dry) would test, see that a tool is shut in, ${resumed ? "" : `commit "chore: ${next}", `}build and notarize, tag ${tag}, push, and publish with notes since ${before}`
  )
  process.exit(0)
}
if (!sure) {
  const ask = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const answer = await ask.question(
    `[release] Build, push and publish Enclose ${next}? [y/N] `
  )
  ask.close()
  if (!/^y(es)?$/i.test(answer.trim())) stop("Nothing was done.")
}

// --- the release ------------------------------------------------------------------------

step("the tests")
must("npm", ["test"])

// A project's tool is run without anyone having read it, and what keeps it in can only
// be seen to hold in the app as it is built: so it is built, and a tool that tries to
// get out is run in it. (What is given out is built again below, from the same files
// with their new version.)
step("that a project's tool is shut in")
must("npm", ["run", "build"])
must("npm", ["run", "sandbox"])

if (!resumed) {
  step(`the version: ${next}`)
  must("npm", ["version", next, "--no-git-tag-version"])
  must("git", ["commit", "-am", `chore: ${next}`])
}
const again = `Run it again to go on from here: npm run release -- ${next}`

step("the app, signed and notarized: this takes a few minutes")
if (!run("npm", ["run", "dist"]).ok)
  stop("The app was not made. Nothing has been pushed or published.", again)

step("that a Mac will take it")
for (const folder of ["mac-arm64", "mac"]) {
  const app = path.join(RELEASE, folder, `${productName}.app`)
  const { said } = run("spctl", ["-a", "-t", "exec", "-vv", app], {
    quiet: true,
  })
  console.log(said)
  if (!/: accepted/.test(said) || !/Notarized Developer ID/.test(said))
    stop(
      `A Mac would not take ${folder}. Nothing has been pushed or published.`,
      again
    )
}

// what goes up: the disk images, under the names the site's download goes to, and what
// an installed app updates itself from
const archives = fs
  .readdirSync(RELEASE)
  .filter(
    (file) =>
      file.startsWith(`Enclose-${next}-`) && /\.zip(\.blockmap)?$/.test(file)
  )
const files = [
  "Enclose-arm64.dmg",
  "Enclose-x64.dmg",
  ...archives,
  "latest-mac.yml",
]
const missing = [
  ...files.filter((file) => !fs.existsSync(path.join(RELEASE, file))),
  ...(archives.length === 4
    ? []
    : ["the four archives an installed app updates from"]),
]
if (missing.length > 0)
  stop(
    `Not everything was made: ${missing.join(", ")}. Nothing has been pushed or published.`,
    again
  )

step(`${tag}, pushed`)
must("git", ["tag", tag])
must("git", ["push", "origin", "main", tag])

step("the release, published")
must("gh", [
  "release",
  "create",
  tag,
  ...files.map((file) => path.join("release", file)),
  "--title",
  `Enclose ${next}`,
  "--generate-notes",
  "--notes-start-tag",
  before,
])

console.log(`\n[release] Enclose ${next} is out.`)
