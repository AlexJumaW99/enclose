import { describe, expect, it } from "vitest"

import { deviceCode, GitHub, SignedOut, signedIn, type Tokens } from "./github"

/** A GitHub that answers each request with the next of `answers`, and keeps what was asked. */
function site(...answers: [number, unknown][]) {
  const asked: { url: string; init: RequestInit }[] = []
  const get = (async (url: string, init: RequestInit) => {
    asked.push({ url, init })
    const [status, body] = answers.shift() ?? [500, {}]
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return { get, asked }
}

const LATER: Tokens = {
  access: "ghu_a",
  refresh: "ghr_a",
  expires: Date.now() + 3_600_000,
}

describe("signing in", () => {
  it("gets a code to type, and waits for it to be typed, slowing down when told to", async () => {
    const { get, asked } = site(
      [
        200,
        {
          device_code: "dev",
          user_code: "WDJB-MJHT",
          verification_uri: "https://github.com/login/device",
          interval: 5,
          expires_in: 900,
        },
      ],
      [200, { error: "authorization_pending" }],
      [200, { error: "slow_down", interval: 10 }],
      [
        200,
        { access_token: "ghu_x", refresh_token: "ghr_x", expires_in: 28800 },
      ]
    )
    const code = await deviceCode(get)
    expect(code).toMatchObject({
      device: "dev",
      user: "WDJB-MJHT",
      interval: 5,
    })
    const waited: number[] = []
    const tokens = await signedIn(
      get,
      code,
      new AbortController().signal,
      async (ms) => {
        waited.push(ms)
      }
    )
    expect(waited).toEqual([5000, 5000, 10000])
    expect(tokens).toMatchObject({ access: "ghu_x", refresh: "ghr_x" })
    expect(tokens.expires).toBeGreaterThan(Date.now())
    expect(String(asked[1].init.body)).toContain("grant_type=urn")
  })

  it("says so where it was turned down", async () => {
    const { get } = site([200, { error: "access_denied" }])
    const code = {
      device: "d",
      user: "u",
      uri: "",
      interval: 0,
      until: Date.now() + 60_000,
    }
    await expect(
      signedIn(get, code, new AbortController().signal, async () => {})
    ).rejects.toThrow("turned down")
  })
})

describe("GitHub", () => {
  it("gets a new token before the one it has runs out, once, and keeps it", async () => {
    const { get, asked } = site(
      [
        200,
        {
          access_token: "ghu_new",
          refresh_token: "ghr_new",
          expires_in: 28800,
        },
      ],
      [200, { id: 7, login: "ada", name: "" }]
    )
    const kept: Tokens[] = []
    const github = new GitHub(
      { ...LATER, expires: Date.now() + 60_000 },
      (one) => kept.push(one),
      get
    )
    expect(await github.account()).toEqual({ id: 7, login: "ada", name: null })
    expect(kept.map((one) => one.access)).toEqual(["ghu_new"])
    expect(new Headers(asked[1].init.headers).get("Authorization")).toBe(
      "Bearer ghu_new"
    )
  })

  it("is signed out where GitHub will not have the token", async () => {
    const { get } = site([401, {}])
    await expect(
      new GitHub(LATER, () => {}, get).account()
    ).rejects.toBeInstanceOf(SignedOut)
  })

  it("makes a private repository, numbered where the name is taken", async () => {
    const { get, asked } = site(
      [422, {}],
      [201, { full_name: "ada/enclose-lid-2" }]
    )
    const made = await new GitHub(LATER, () => {}, get).createRepository(
      "enclose-lid",
      "Lid"
    )
    expect(made).toEqual({
      full: "ada/enclose-lid-2",
      url: "https://github.com/ada/enclose-lid-2.git",
    })
    expect(JSON.parse(String(asked[0].init.body))).toMatchObject({
      name: "enclose-lid",
      private: true,
    })
    expect(JSON.parse(String(asked[1].init.body)).name).toBe("enclose-lid-2")
  })

  it("pushes with the token in the environment, not on the command line", async () => {
    const env = await new GitHub(LATER, () => {}, site().get).pushing()
    expect(env.GIT_CONFIG_KEY_0).toBe("http.https://github.com/.extraheader")
    expect(env.GIT_CONFIG_VALUE_0).toBe(
      `AUTHORIZATION: basic ${Buffer.from("x-access-token:ghu_a").toString("base64")}`
    )
  })
})
