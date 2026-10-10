import { describe, expect, it } from "vitest"

import { replyOf } from "./reply"

describe("replyOf", () => {
  it("says a reply with nothing set off as it is", () => {
    expect(replyOf("The wall is 2 mm thick.\n\n- all round\n")).toEqual({
      said: "The wall is 2 mm thick.\n\n- all round",
      more: null,
    })
  })

  it("keeps what is set off apart from what is said", () => {
    expect(
      replyOf(
        [
          "Done, see how the leads look now.",
          "",
          "<details>",
          "- **Route:** through the rib gap",
          "- **Third lead:** a guess",
          "</details>",
        ].join("\n")
      )
    ).toEqual({
      said: "Done, see how the leads look now.",
      more: "- **Route:** through the rib gap\n- **Third lead:** a guess",
    })
  })

  it("says outright what comes after the block as well", () => {
    expect(
      replyOf("Done.\n<details>\nHow.\n</details>\nWhich socket did you mean?")
    ).toEqual({ said: "Done.\n\nWhich socket did you mean?", more: "How." })
  })

  it("takes a block left open as running to the end", () => {
    expect(replyOf("Done.\n\n<details>\nThe leads go")).toEqual({
      said: "Done.",
      more: "The leads go",
    })
  })

  it("shows no half of a tag while the reply is being written", () => {
    expect(replyOf("Done.\n\n<det")).toEqual({ said: "Done.", more: null })
    expect(replyOf("Done.\n\n<details>")).toEqual({ said: "Done.", more: "" })
    expect(replyOf("Done.\n<details>\nHow.\n</deta")).toEqual({
      said: "Done.",
      more: "How.",
    })
  })

  it("leaves alone a < that begins no block", () => {
    expect(replyOf("The gap is <")).toEqual({
      said: "The gap is <",
      more: null,
    })
    expect(replyOf("Write it as `<details>` there.")).toEqual({
      said: "Write it as `<details>` there.",
      more: null,
    })
  })

  it("drops a heading given to the block, which the button stands for", () => {
    expect(
      replyOf(
        "Done.\n<details>\n<summary>Details</summary>\n\nHow.\n</details>"
      )
    ).toEqual({ said: "Done.", more: "How." })
  })

  it("gathers several blocks into one", () => {
    expect(
      replyOf("One.\n<details>\nA\n</details>\nTwo.\n<details>\nB\n</details>")
    ).toEqual({ said: "One.\n\nTwo.", more: "A\n\nB" })
  })

  it("says all of a reply that is nothing but what was set off", () => {
    expect(replyOf("<details>\nAll of it.\n</details>")).toEqual({
      said: "All of it.",
      more: null,
    })
  })
})
