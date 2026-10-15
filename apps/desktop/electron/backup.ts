// A project's history, kept in git: every project the app makes, and every folder it
// opens that was no repository yet, is one. After each turn of the agent's, and each
// thing taken back or put back, what the folder holds is committed: on a branch of the
// conversation's own, where each conversation has its own version of the project (see
// versions.ts), and on main where there is only the one.
//
// A folder that was a repository already is somebody's own, kept their own way: the app
// commits nothing in it. What it set up itself it marks so (enclose.managed, in the
// repository's own config), and goes by that.
//
// Nothing here goes to GitHub: github.ts does that, with what is committed here.
import fs from "node:fs"
import path from "node:path"

/** Runs git in a folder: what it printed, and how it ended. */
export type Git = (
  args: string[],
  cwd: string,
  env?: Record<string, string>
) => Promise<{ code: number; stdout: string; stderr: string }>

/** Who a commit is by: the user, as GitHub knows them, or the app where it does not. */
export type Author = { name: string; email: string }
export const APP_AUTHOR: Author = {
  name: "Enclose",
  email: "noreply@enclose.dev",
}

/** A file this big or bigger goes to Git LFS, which GitHub keeps apart from the rest. */
export const BIG = 50 * 1024 * 1024

/**
 * What is never kept: made again from what is, a Python of the project's own, or where
 * keys and passwords are kept, which have no business on GitHub, private or not.
 */
const NOT_KEPT = [
  ".venv/",
  "venv/",
  "__pycache__/",
  ".DS_Store",
  ".env",
  ".env.*",
]

/** What the app adds to a project's .gitignore, under this line. */
const IGNORED_SAYS = "# Enclose: made again from the project's own files"

/**
 * A project's .gitignore, with what the app leaves out of it added: what the build
 * writes (`built`, the folder of its manifest, where there is a build to write it again)
 * and what is never kept. What the file says already stays as it is.
 */
export function ignoreText(existing: string | null, built: string | null) {
  const lines = (existing ?? "").split(/\r?\n/).map((line) => line.trim())
  const wanted = [...(built ? [`${built}/`] : []), ...NOT_KEPT].filter(
    (pattern) =>
      !lines.includes(pattern) && !lines.includes(pattern.replace(/\/$/, ""))
  )
  if (wanted.length === 0) return existing ?? ""
  const before = (existing ?? "").replace(/\s*$/, "")
  return `${before ? `${before}\n\n` : ""}${IGNORED_SAYS}\n${wanted.join("\n")}\n`
}

/** Lower case, with dashes: what a name is made into for a branch or a repository. */
export function slugged(text: string, longest = 60): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, longest)
      .replace(/-+$/, "") || "project"
  )
}

/** What a conversation's branch is called: after what it began with, and its own id. */
export function branchFor(what: string, conversationId: string): string {
  return `version/${slugged(what, 40)}-${conversationId.slice(0, 6)}`
}

const run = async (
  git: Git,
  args: string[],
  cwd: string,
  env?: Record<string, string>
) => {
  const done = await git(args, cwd, env)
  if (done.code !== 0)
    throw new Error(
      `git ${args[0]} failed: ${(done.stderr || done.stdout).trim().split("\n").at(-1) ?? ""}`
    )
  return done.stdout
}

/** Whether a folder is a repository of its own (and not inside some other). */
export const isRepository = (dir: string) =>
  fs.existsSync(path.join(dir, ".git"))

/** Whether the app keeps a folder's history: a repository it set up itself. */
export async function managed(git: Git, dir: string): Promise<boolean> {
  if (!isRepository(dir)) return false
  const said = await git(["config", "--get", "enclose.managed"], dir)
  return said.stdout.trim() === "true"
}

/** The same, read straight from the repository's config: for where there is no waiting. */
export function managedNow(dir: string): boolean {
  try {
    const config = fs.readFileSync(path.join(dir, ".git", "config"), "utf8")
    return /\[enclose\][^[]*\bmanaged\s*=\s*true\b/.test(config)
  } catch {
    return false
  }
}

/**
 * Make a folder a repository the app keeps, unless it is one already: with a
 * .gitignore, and nothing committed yet. Whether it is the app's to keep, after: a
 * repository that was somebody's own before stays theirs.
 */
export async function setUp(
  git: Git,
  dir: string,
  /** the folder the build writes, within the project; null where nothing is built */
  built: string | null
): Promise<boolean> {
  if (isRepository(dir)) return managed(git, dir)
  await run(git, ["init", "--quiet", "--initial-branch=main"], dir)
  await run(git, ["config", "enclose.managed", "true"], dir)
  // the repository's own: and so nothing the user has elsewhere moves a file in it
  await run(git, ["config", "core.autocrlf", "false"], dir)
  const ignore = path.join(dir, ".gitignore")
  const existing = fs.existsSync(ignore)
    ? fs.readFileSync(ignore, "utf8")
    : null
  const next = ignoreText(existing, built)
  if (next !== existing) fs.writeFileSync(ignore, next)
  return true
}

/** The branch HEAD is on, or null where it is on none. */
async function onBranch(git: Git, dir: string): Promise<string | null> {
  const said = await git(["symbolic-ref", "--quiet", "--short", "HEAD"], dir)
  return said.code === 0 ? said.stdout.trim() : null
}

const hasCommits = async (git: Git, dir: string) =>
  (await git(["rev-parse", "--verify", "--quiet", "HEAD"], dir)).code === 0

/**
 * Put HEAD on a branch without touching a file: the folder is that branch's already,
 * as versions.ts put it. A branch there is none of yet begins where HEAD is.
 */
async function moveTo(git: Git, dir: string, branch: string) {
  if ((await onBranch(git, dir)) === branch) return
  const there =
    (
      await git(
        ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
        dir
      )
    ).code === 0
  if (!there && (await hasCommits(git, dir)))
    await run(git, ["branch", branch], dir)
  await run(git, ["symbolic-ref", "HEAD", `refs/heads/${branch}`], dir)
}

/**
 * Have Git LFS keep the files too big for a repository to keep well: those at least BIG,
 * not ignored, and not kept by it yet. (GitHub takes none bigger than 100 MB in a
 * repository itself, and keeps what Git LFS has apart from it.)
 */
async function bigOnes(git: Git, dir: string): Promise<void> {
  const listed = await run(
    git,
    ["ls-files", "--others", "--modified", "--exclude-standard", "-z"],
    dir
  )
  const big = listed
    .split("\0")
    .filter(Boolean)
    .filter((file) => {
      try {
        return fs.statSync(path.join(dir, file)).size >= BIG
      } catch {
        return false
      }
    })
  if (big.length === 0) return
  // (what Git LFS keeps already says so, in the repository's attributes)
  const said = await run(git, ["check-attr", "-z", "filter", "--", ...big], dir)
  const fields = said.split("\0")
  const kept = new Set<string>()
  for (let i = 0; i + 2 < fields.length; i += 3)
    if (fields[i + 2] === "lfs") kept.add(fields[i])
  const fresh = big.filter((file) => !kept.has(file))
  if (fresh.length === 0) return
  await run(git, ["lfs", "install", "--local"], dir)
  await run(git, ["lfs", "track", "--filename", ...fresh], dir)
}

export type Committed = {
  /** the commit made, or null where there was nothing to commit */
  commit: string | null
  branch: string
}

/**
 * Commit what the folder holds, all of it, on `branch`: what changed since that branch
 * was last committed to, by whatever changed it. Nothing is committed where nothing
 * changed. Throws where git does.
 */
export async function commitAll(
  git: Git,
  dir: string,
  {
    branch,
    message,
    author,
  }: { branch: string; message: string; author: Author }
): Promise<Committed> {
  await moveTo(git, dir, branch)
  await bigOnes(git, dir)
  await run(git, ["add", "--all"], dir)
  const staged = await git(["diff", "--cached", "--quiet"], dir)
  if (staged.code === 0 && (await hasCommits(git, dir)))
    return { commit: null, branch }
  const env = {
    GIT_AUTHOR_NAME: author.name,
    GIT_AUTHOR_EMAIL: author.email,
    GIT_COMMITTER_NAME: author.name,
    GIT_COMMITTER_EMAIL: author.email,
  }
  await run(
    git,
    ["commit", "--quiet", "--allow-empty", "--no-verify", "--message", message],
    dir,
    env
  )
  const commit = (await run(git, ["rev-parse", "HEAD"], dir)).trim()
  return { commit, branch }
}

/** What a commit says: the first line of what was asked, and the conversation it was in. */
export function messageOf(what: string, conversation: string | null): string {
  const line = what.replace(/\s+/g, " ").trim()
  const subject = line.length > 72 ? `${line.slice(0, 71)}…` : line || "Changes"
  return conversation && conversation !== line
    ? `${subject}\n\nConversation: ${conversation}`
    : subject
}
