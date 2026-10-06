import { describe, expect, it } from "vitest"

import { modelChoices } from "./claude"

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
