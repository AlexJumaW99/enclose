// Connecting GitHub, from the button in the settings: a code to type on GitHub's site,
// then Enclose's app installed on the account where it is not yet, and the account kept.
// From then on the app is signed in to it, until it is disconnected or GitHub will no
// longer have it.
import type { GitHubConnection } from "../shared/api"
import {
  deviceCode,
  GITHUB_APP,
  GitHub,
  installUrl,
  signedIn,
  type Account,
  type Code,
  type Tokens,
} from "./github"

export type ConnectionDeps = {
  /** the account kept, and what signs in to it */
  saved: () => { account: Account; tokens: Tokens } | null
  save: (github: { account: Account; tokens: Tokens } | null) => boolean
  open: (url: string) => void
  copy: (text: string) => void
  get: typeof fetch
  onChange: (connection: GitHubConnection) => void
  /** an account is connected, newly: every project is to be backed up to it */
  onConnected: () => void
}

/** How often it is asked whether Enclose's app has been installed, ms, and for how long. */
const INSTALL_EVERY_MS = 3000
const INSTALL_FOR_MS = 20 * 60_000

export class Connection {
  private readonly deps: ConnectionDeps
  private now: GitHubConnection
  private github: { client: GitHub; account: Account } | null = null
  private code: Code | null = null
  private stop: AbortController | null = null

  constructor(deps: ConnectionDeps) {
    this.deps = deps
    const saved = deps.saved()
    if (!GITHUB_APP.clientId) this.now = { state: "unavailable" }
    else if (saved) {
      this.github = {
        client: this.client(saved.account, saved.tokens),
        account: saved.account,
      }
      this.now = {
        state: "on",
        login: saved.account.login,
        name: saved.account.name,
      }
    } else this.now = { state: "off", trouble: null }
  }

  get state(): GitHubConnection {
    return this.now
  }

  /** GitHub, where it is connected. */
  connected(): { client: GitHub; account: Account } | null {
    return this.now.state === "on" ? this.github : null
  }

  private set(next: GitHubConnection) {
    this.now = next
    this.deps.onChange(next)
  }

  private client(account: Account, tokens: Tokens): GitHub {
    // a new pair is kept at once, once connected: the old one is no good from then on
    return new GitHub(
      tokens,
      (fresh) => {
        if (this.github?.account.id === account.id)
          this.deps.save({ account, tokens: fresh })
      },
      this.deps.get
    )
  }

  async connect(): Promise<void> {
    if (this.now.state === "unavailable" || this.stop) return
    const stop = (this.stop = new AbortController())
    try {
      const code = (this.code = await deviceCode(this.deps.get))
      this.set({ state: "code", code: code.user, uri: code.uri })
      const tokens = await signedIn(this.deps.get, code, stop.signal)
      const account = await new GitHub(
        tokens,
        () => {},
        this.deps.get
      ).account()
      const client = this.client(account, tokens)
      if (!(await client.installed(account))) {
        this.set({ state: "install", login: account.login, url: installUrl() })
        this.deps.open(installUrl())
        const until = Date.now() + INSTALL_FOR_MS
        for (;;) {
          await new Promise((done) => setTimeout(done, INSTALL_EVERY_MS))
          if (stop.signal.aborted) throw new Error("Stopped.")
          if (await client.installed(account)) break
          if (Date.now() > until)
            throw new Error(
              "Enclose's app was not installed on GitHub. Connect again."
            )
        }
      }
      // kept only now, with Enclose installed: an app quit before that is not connected
      if (!this.deps.save({ account, tokens: client.current }))
        throw new Error("This Mac would not keep the account safely.")
      this.github = { client, account }
      this.set({ state: "on", login: account.login, name: account.name })
      this.deps.onConnected()
    } catch (error) {
      this.github = null
      this.set({
        state: "off",
        trouble:
          stop.signal.aborted || !(error instanceof Error)
            ? null
            : error.message,
      })
    } finally {
      this.stop = null
      this.code = null
    }
  }

  /** Copy the code to be typed, and open the page it is typed on. */
  openCode() {
    if (!this.code) return
    this.deps.copy(this.code.user)
    this.deps.open(this.code.uri)
  }

  openInstall() {
    this.deps.open(installUrl())
  }

  cancel() {
    this.stop?.abort()
  }

  /** Forget the account. What is on GitHub stays there, and each project's history in it. */
  disconnect() {
    this.cancel()
    this.github = null
    this.deps.save(null)
    if (this.now.state !== "unavailable")
      this.set({ state: "off", trouble: null })
  }

  /** GitHub will no longer have the app signed in: it is to be connected again. */
  signedOut() {
    if (this.now.state !== "on") return
    this.github = null
    this.deps.save(null)
    this.set({
      state: "off",
      trouble: "GitHub signed Enclose out. Connect again to go on backing up.",
    })
  }
}
