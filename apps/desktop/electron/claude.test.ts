import { describe, expect, it } from "vitest"

import { accountOf, commandChoices, extraArgs, modelChoices } from "./claude"

describe("modelChoices", () => {
  it("offers the models as Claude Code lists them", () => {
    expect(
      modelChoices([
        {
          value: "sonnet",
          resolvedModel: "claude-sonnet-5-5",
          displayName: "Sonnet 5.5",
          description: "Most efficient for simpler tasks",
          supportsEffort: true,
          supportedEffortLevels: ["low", "medium", "high"],
        },
        {
          value: "haiku",
          displayName: "Haiku 4.5",
          description: "Fastest for quick answers",
        },
      ])
    ).toEqual([
      {
        id: null,
        name: "Default",
        short: "Default",
        detail: "The model Claude Code is set to run",
        efforts: [],
      },
      {
        id: "sonnet",
        name: "Sonnet 5.5",
        short: "Sonnet 5.5",
        detail: "Most efficient for simpler tasks",
        efforts: ["low", "medium", "high"],
      },
      {
        id: "haiku",
        name: "Haiku 4.5",
        short: "Haiku 4.5",
        detail: "Fastest for quick answers",
        efforts: [],
      },
    ])
  })

  it("says which model the default is, by the name the list has it under", () => {
    const [standing, opus] = modelChoices([
      {
        value: "default",
        resolvedModel: "claude-opus-5-5",
        displayName: "Default (recommended)",
        description: "Opus 5.5 \u00b7 Best for everyday, complex tasks",
        supportsEffort: true,
        supportedEffortLevels: ["high", "max"],
      },
      {
        value: "opus",
        resolvedModel: "claude-opus-5-5",
        displayName: "Opus 5.5",
        description: "For complex work and everyday tasks",
      },
    ])
    expect(standing).toMatchObject({
      id: null,
      name: "Default (recommended)",
      short: "Opus 5.5",
      efforts: ["high", "max"],
    })
    expect(opus).toMatchObject({ id: "opus", short: "Opus 5.5" })
  })

  it("offers nothing when Claude Code lists nothing", () => {
    expect(modelChoices([])).toEqual([])
  })
})

describe("commandChoices", () => {
  const row = (name: string, more: object = {}) => ({
    name,
    description: `What ${name} does`,
    argumentHint: "",
    ...more,
  })
  const all = [
    row("kicad-pcb"),
    row("hello", { argumentHint: "<part>" }),
    row("vercel:deploy", { description: "(vercel) Deploy the\n  project" }),
    row("vercel:deploy"),
    row("code-review", { builtin: true }),
    row("model", { builtin: true }),
    row("context", { builtin: true }),
    row("compact", { builtin: true }),
  ]

  it("offers the commands that mean something here, then the user's", () => {
    const { commands } = commandChoices(all, [])
    expect(commands.map((command) => command.name)).toEqual([
      "compact",
      "context",
      "kicad-pcb",
      "hello",
      "vercel:deploy",
    ])
  })

  it("says what each does in a line, without saying twice whose it is", () => {
    const { commands } = commandChoices(all, [])
    expect(commands.find((c) => c.name === "vercel:deploy")?.detail).toBe(
      "Deploy the project"
    )
    expect(commands.find((c) => c.name === "hello")?.hint).toBe("<part>")
  })

  it("offers the skills that are not Claude Code's own", () => {
    const { skills } = commandChoices(all, [
      row("kicad-pcb"),
      row("dataviz", { builtin: true }),
    ])
    expect(skills.map((skill) => skill.name)).toEqual(["kicad-pcb"])
  })

  it("leaves a user's command alone that is named as one of Claude Code's", () => {
    const { commands } = commandChoices([row("context"), row("usage")], [])
    expect(commands.map((command) => command.name)).toEqual([
      "context",
      "usage",
    ])
  })
})

describe("extraArgs", () => {
  it("is what was typed after the command, as the SDK takes more arguments", () => {
    expect(extraArgs([])).toEqual({})
    expect(
      extraArgs(["--chrome", "--model", "opus", "--x=1=2", "stray", "-v", "--"])
    ).toEqual({ chrome: null, model: "opus", x: "1=2" })
    expect(extraArgs(["--debug", "--verbose"])).toEqual({
      debug: null,
      verbose: null,
    })
  })
})

describe("accountOf", () => {
  it("says who is signed in, by what they pay for or how they reach it", () => {
    expect(
      accountOf({
        email: "someone@example.com",
        subscriptionType: "Claude Max",
        apiProvider: "firstParty",
      })
    ).toEqual({ signedIn: true, account: "Claude Max" })
    expect(accountOf({ apiProvider: "bedrock" })).toEqual({
      signedIn: true,
      account: "bedrock",
    })
    expect(
      accountOf({
        apiKeySource: "ANTHROPIC_API_KEY",
        apiProvider: "firstParty",
      })
    ).toEqual({ signedIn: true, account: "API key" })
  })

  it("says nobody is, where Claude Code names no account and no key", () => {
    expect(accountOf({ apiProvider: "firstParty" })).toEqual({
      signedIn: false,
      account: null,
    })
    expect(accountOf({ tokenSource: "none", apiKeySource: "none" })).toEqual({
      signedIn: false,
      account: null,
    })
  })
})
