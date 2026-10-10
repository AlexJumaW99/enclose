import { describe, expect, it } from "vitest"

import { contentPolicy } from "./content-policy"

/** What a policy lets each kind of thing come from. */
const sources = (policy: string) =>
  Object.fromEntries(
    policy.split("; ").map((directive) => {
      const [name, ...from] = directive.split(" ")
      return [name, from]
    })
  )

/** Somewhere on a network, or anywhere at all. */
const abroad = (source: string) =>
  /^(https?:|wss?:|\*)/.test(source) && !source.startsWith("ws://127.0.0.1:")

describe("contentPolicy", () => {
  it("lets nothing in that it does not name", () => {
    expect(sources(contentPolicy())["default-src"]).toEqual(["'none'"])
    expect(sources(contentPolicy(true))["default-src"]).toEqual(["'none'"])
  })

  it("lets a script come from the app and from memory, and nowhere else", () => {
    expect(sources(contentPolicy())["script-src"]).toEqual(["'self'", "blob:"])
  })

  it("lets nothing be made up and run, built or being worked on", () => {
    expect(contentPolicy()).not.toContain("unsafe-eval")
    expect(contentPolicy(true)).not.toContain("unsafe-eval")
  })

  it("names nowhere on a network, whatever is loaded", () => {
    for (const policy of [contentPolicy(), contentPolicy(true)])
      for (const from of Object.values(sources(policy)))
        expect(from.filter(abroad)).toEqual([])
  })

  it("lets the window being worked on hear from its own server, on this machine", () => {
    expect(sources(contentPolicy(true))["connect-src"]).toContain(
      "ws://127.0.0.1:*"
    )
    expect(sources(contentPolicy())["connect-src"]).not.toContain(
      "ws://127.0.0.1:*"
    )
  })

  it("lets a project's files be read by the app's own scheme", () => {
    expect(sources(contentPolicy())["connect-src"]).toContain("cad-model:")
    expect(sources(contentPolicy())["img-src"]).toContain("cad-model:")
  })
})
