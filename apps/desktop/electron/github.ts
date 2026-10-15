// GitHub, as the app backs projects up to it: the user's own account, signed in to with
// a code they type on GitHub's site (the device flow), through Enclose's GitHub App. The
// app is let make repositories, private ones, and keep them; nothing else of the
// account's is open to it. It holds no secret of its own: what it is given is a token
// that runs out in hours, and another that gets a new one, for months.

/**
 * Enclose's GitHub App: what it is known by, and where it is installed from. A build
 * that has none (`ENCLOSE_GITHUB_CLIENT_ID` overrides it) cannot connect.
 */
export const GITHUB_APP = {
  clientId: process.env.ENCLOSE_GITHUB_CLIENT_ID ?? "Iv23liAe5DFtoTwOSFB8",
  slug: process.env.ENCLOSE_GITHUB_APP ?? "enclose-cad",
}

const SITE = "https://github.com"
const API = "https://api.github.com"

type Get = typeof fetch

/** What GitHub gives for having been signed in to, as the app keeps it. */
export type Tokens = {
  access: string
  /** what gets a new one, where they run out; null where they do not */
  refresh: string | null
  /** when the access token runs out, ms since 1970; null where it does not */
  expires: number | null
}

/** Who is signed in. */
export type Account = { id: number; login: string; name: string | null }

/** What the user is to type on GitHub's site, and where. */
export type Code = {
  device: string
  user: string
  uri: string
  /** how often to ask whether it was typed, in seconds */
  interval: number
  /** when it can no longer be typed, ms since 1970 */
  until: number
}

const form = async (get: Get, url: string, fields: Record<string, string>) => {
  const response = await get(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields).toString(),
  })
  // (what went wrong comes back as an answer like any other: its `error` says so)
  return (await response.json()) as Record<string, unknown>
}

/** Ask GitHub for a code for the user to type, to sign in with. */
export async function deviceCode(get: Get, now = Date.now()): Promise<Code> {
  const said = await form(get, `${SITE}/login/device/code`, {
    client_id: GITHUB_APP.clientId,
  })
  if (
    typeof said.device_code !== "string" ||
    typeof said.user_code !== "string"
  )
    throw new Error(
      `GitHub would not give a code to sign in with${said.error ? ` (${String(said.error)})` : ""}.`
    )
  return {
    device: said.device_code,
    user: said.user_code,
    uri:
      typeof said.verification_uri === "string"
        ? said.verification_uri
        : `${SITE}/login/device`,
    interval: Number(said.interval) || 5,
    until: now + (Number(said.expires_in) || 900) * 1000,
  }
}

const tokensOf = (said: Record<string, unknown>, now: number): Tokens => ({
  access: String(said.access_token),
  refresh: typeof said.refresh_token === "string" ? said.refresh_token : null,
  expires:
    typeof said.expires_in === "number" ? now + said.expires_in * 1000 : null,
})

/**
 * Wait for the code to be typed on GitHub's site, asking as often as GitHub lets it be
 * asked. Throws where it was turned down, ran out, or was stopped.
 */
export async function signedIn(
  get: Get,
  code: Code,
  signal: AbortSignal,
  wait = (ms: number) => new Promise((done) => setTimeout(done, ms))
): Promise<Tokens> {
  let interval = code.interval
  for (;;) {
    await wait(interval * 1000)
    if (signal.aborted) throw new Error("Stopped.")
    if (Date.now() > code.until)
      throw new Error("The code ran out. Connect again.")
    const said = await form(get, `${SITE}/login/oauth/access_token`, {
      client_id: GITHUB_APP.clientId,
      device_code: code.device,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    })
    if (typeof said.access_token === "string") return tokensOf(said, Date.now())
    switch (said.error) {
      case "authorization_pending":
        continue
      case "slow_down":
        interval = Number(said.interval) || interval + 5
        continue
      case "access_denied":
        throw new Error("It was turned down on GitHub.")
      case "expired_token":
      case "token_expired":
        throw new Error("The code ran out. Connect again.")
      default:
        throw new Error(`GitHub would not sign in (${String(said.error)}).`)
    }
  }
}

/** A new access token for the one that is running out. Throws where it cannot be had. */
export async function refreshed(get: Get, refresh: string): Promise<Tokens> {
  const said = await form(get, `${SITE}/login/oauth/access_token`, {
    client_id: GITHUB_APP.clientId,
    grant_type: "refresh_token",
    refresh_token: refresh,
  })
  if (typeof said.access_token !== "string")
    throw new SignedOut(
      `GitHub would not keep the app signed in (${String(said.error)}).`
    )
  return tokensOf(said, Date.now())
}

/** What is thrown where the app is no longer signed in, and has to be connected again. */
export class SignedOut extends Error {}

/** A repository the app keeps a project in: "owner/name". */
export type Repository = { full: string; url: string }

/**
 * GitHub, signed in to. `tokens` are had afresh for each request, and `keep` is told of
 * a new pair as soon as there is one: the old pair is no good from then on.
 */
export class GitHub {
  private refreshing: Promise<Tokens> | null = null
  private tokens: Tokens
  private readonly keep: (tokens: Tokens) => void
  private readonly get: Get

  constructor(
    tokens: Tokens,
    keep: (tokens: Tokens) => void,
    get: Get = fetch
  ) {
    this.tokens = tokens
    this.keep = keep
    this.get = get
  }

  /** The tokens as they are now: the newest pair, where a new one was had. */
  get current(): Tokens {
    return this.tokens
  }

  /** An access token that has a while yet to run: a new one, where it had not. */
  async token(): Promise<string> {
    const { expires, refresh } = this.tokens
    if (expires === null || Date.now() < expires - 5 * 60_000)
      return this.tokens.access
    if (!refresh)
      throw new SignedOut("The app is no longer signed in to GitHub.")
    // one at a time: a refresh token is good for one new pair, and no more
    this.refreshing ??= refreshed(this.get, refresh).finally(() => {
      this.refreshing = null
    })
    this.tokens = await this.refreshing
    this.keep(this.tokens)
    return this.tokens.access
  }

  private async request(method: string, route: string, body?: unknown) {
    const response = await this.get(`${API}${route}`, {
      method,
      // never what was had before: whether the app is installed yet, say, changes
      // while it is asked over and over, and GitHub lets an answer be kept a minute
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${await this.token()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (response.status === 401)
      throw new SignedOut("The app is no longer signed in to GitHub.")
    return {
      status: response.status,
      data: (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null,
    }
  }

  async account(): Promise<Account> {
    const { status, data } = await this.request("GET", "/user")
    if (status !== 200 || !data) throw new Error(`GitHub said ${status}.`)
    return {
      id: Number(data.id),
      login: String(data.login),
      name: typeof data.name === "string" && data.name ? data.name : null,
    }
  }

  /** Whether Enclose's app is installed on the account, which it has to be to keep anything there. */
  async installed(account: Account): Promise<boolean> {
    const { status, data } = await this.request("GET", "/user/installations")
    const found = (data?.installations ?? []) as {
      account?: { id?: number; login?: string }
    }[]
    // (said, for when it never comes: on which accounts GitHub has it installed)
    console.log(
      `[github] installations ${status}: ${found.map((one) => one.account?.login).join(", ") || "none"}; looking for ${account.login}`
    )
    if (status !== 200) return false
    return found.some((one) => one.account?.id === account.id)
  }

  /**
   * Make a private repository on the account: called `name`, or numbered after it where
   * that is taken. Throws where none can be made.
   */
  async createRepository(
    name: string,
    description: string
  ): Promise<Repository> {
    for (let n = 1; n <= 20; n++) {
      const called = n === 1 ? name : `${name}-${n}`
      const { status, data } = await this.request("POST", "/user/repos", {
        name: called,
        description,
        private: true,
        has_issues: false,
        has_projects: false,
        has_wiki: false,
        auto_init: false,
      })
      if (status === 201 && data) return repositoryOf(data)
      // taken: the next number
      if (status === 422) continue
      throw new Error(
        status === 403
          ? "Enclose's GitHub app is not let make repositories on this account."
          : `GitHub would not make the repository (${status}).`
      )
    }
    throw new Error(`Every name like "${name}" is taken.`)
  }

  /** Call a repository something else, or say something else of it. Null where it is gone. */
  async changeRepository(
    full: string,
    change: { name?: string; description?: string }
  ): Promise<Repository | null> {
    const { status, data } = await this.request(
      "PATCH",
      `/repos/${full}`,
      change
    )
    if (status === 200 && data) return repositoryOf(data)
    if (status === 404) return null
    // the name is taken: it stays as it was called
    if (status === 422) return { full, url: `${SITE}/${full}.git` }
    throw new Error(`GitHub would not change the repository (${status}).`)
  }

  /**
   * What git is run with to push to GitHub: the token, in a header, given in the
   * environment, so that it is written in no file and shown on no command line.
   */
  async pushing(): Promise<Record<string, string>> {
    const basic = Buffer.from(`x-access-token:${await this.token()}`).toString(
      "base64"
    )
    return {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `http.${SITE}/.extraheader`,
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
    }
  }
}

const repositoryOf = (data: Record<string, unknown>): Repository => ({
  full: String(data.full_name),
  url: `${SITE}/${String(data.full_name)}.git`,
})

/** Where the user installs Enclose's app on their account. */
export const installUrl = () =>
  `${SITE}/apps/${GITHUB_APP.slug}/installations/new`
