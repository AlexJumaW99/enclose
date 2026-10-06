import { describe, expect, it } from "vitest"

import type { ModelChoice } from "@shared/api"
import { chosenEffort, chosenModel, mannerOf, savedAccess } from "./manner"

const model = (
  id: string | null,
  efforts: ModelChoice["efforts"] = ["low", "high"]
): ModelChoice => ({
  id,
  name: id ?? "Default (recommended)",
  short: id ?? "Opus",
  detail: "",
  efforts,
})
const MODELS = [model(null), model("opus"), model("haiku", [])]

describe("savedAccess", () => {
  it("is what was kept", () => {
    expect(savedAccess("supervised")).toBe("supervised")
    expect(savedAccess("auto")).toBe("auto")
  })

  it("takes the asking of an earlier version for what it was", () => {
    expect(savedAccess("ask")).toBe("edits")
    expect(savedAccess("full")).toBe("full")
  })

  it("starts with full access", () => {
    expect(savedAccess(null)).toBe("full")
    expect(savedAccess("nonsense")).toBe("full")
  })
})

describe("chosenModel", () => {
  it("is the one picked", () => {
    expect(chosenModel(MODELS, "opus")?.id).toBe("opus")
    expect(chosenModel(MODELS, null)?.id).toBeNull()
  })

  it("falls back to the default when Claude Code no longer offers the one picked", () => {
    expect(chosenModel(MODELS, "gone")?.id).toBeNull()
  })

  it("is none while nothing is known of the models", () => {
    expect(chosenModel([], "opus")).toBeNull()
  })
})

describe("chosenEffort", () => {
  it("is as picked, if the model can be told so", () => {
    expect(chosenEffort(model("opus"), "high")).toBe("high")
    expect(chosenEffort(model("opus"), "max")).toBeNull()
    expect(chosenEffort(model("haiku", []), "high")).toBeNull()
    expect(chosenEffort(model("opus"), null)).toBeNull()
  })
})

describe("mannerOf", () => {
  it("squares what is picked with what is offered", () => {
    expect(mannerOf(MODELS, "opus", "high", "auto")).toEqual({
      model: "opus",
      effort: "high",
      access: "auto",
    })
    expect(mannerOf(MODELS, "haiku", "high", "full")).toEqual({
      model: "haiku",
      effort: null,
      access: "full",
    })
    expect(mannerOf(MODELS, "gone", "max", "edits")).toEqual({
      model: null,
      effort: null,
      access: "edits",
    })
  })

  it("lets what was picked stand while nothing is known of the models", () => {
    expect(mannerOf([], "opus", "max", "supervised")).toEqual({
      model: "opus",
      effort: "max",
      access: "supervised",
    })
  })
})
