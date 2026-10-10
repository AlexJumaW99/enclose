import { describe, expect, it } from "vitest"

import { bare, guideAgain, piecesOf, stopped } from "./turn"

describe("bare", () => {
  it("is a command without the shell it was wrapped in to be run", () => {
    expect(bare('/bin/zsh -lc "python3 model.py"')).toBe("python3 model.py")
    expect(bare("bash -lc 'ls -la build'")).toBe("ls -la build")
    expect(bare("sh -c 'echo hi'")).toBe("echo hi")
  })

  it("leaves any other command as it is", () => {
    expect(bare("python3 model.py")).toBe("python3 model.py")
    expect(bare("  git status ")).toBe("git status")
  })
})

describe("piecesOf", () => {
  it("is the words, of a message that is only words", () => {
    expect(piecesOf("A lid")).toEqual([{ type: "text", text: "A lid" }])
  })

  it("is the words and pictures in the order they come", () => {
    expect(
      piecesOf([
        { type: "text", text: "Picture 1: from the front" },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: "AAAA" },
        },
        { type: "text", text: "The parts" },
      ])
    ).toEqual([
      { type: "text", text: "Picture 1: from the front" },
      { type: "image", data: "AAAA", mimeType: "image/png" },
      { type: "text", text: "The parts" },
    ])
  })
})

describe("guideAgain", () => {
  it("puts what the agent is to know now where it cannot be taken for the message", () => {
    const again = guideAgain("- The build command is: python3 model.py")
    expect(again.startsWith("<enclose>\n")).toBe(true)
    expect(again.endsWith("\n</enclose>")).toBe(true)
    expect(again).toContain("- The build command is: python3 model.py")
  })
})

describe("stopped", () => {
  it("rejects once the turn is stopped, and at once if it already was", async () => {
    const abort = new AbortController()
    const halt = stopped(abort.signal)
    abort.abort()
    await expect(halt).rejects.toThrow("Stopped.")
    await expect(stopped(abort.signal)).rejects.toThrow("Stopped.")
  })
})
