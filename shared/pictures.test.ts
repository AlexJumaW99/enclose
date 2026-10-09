import { describe, expect, it } from "vitest"

import { atPictures, cutOut, pictureMark, withoutMark } from "./pictures"

describe("atPictures", () => {
  it("cuts what was written at the marks of its pictures", () => {
    expect(
      atPictures("Make [Image 1] with the knob of [Image 2].", [1, 2])
    ).toEqual([
      { text: "Make ", from: 0, picture: null },
      { text: "[Image 1]", from: 5, picture: 1 },
      { text: " with the knob of ", from: 14, picture: null },
      { text: "[Image 2]", from: 32, picture: 2 },
      { text: ".", from: 41, picture: null },
    ])
  })

  it("takes the mark of a picture there is not for words", () => {
    expect(atPictures("As in [Image 3]", [1])).toEqual([
      { text: "As in [Image 3]", from: 0, picture: null },
    ])
    expect(atPictures("", [1])).toEqual([])
  })
})

describe("cutOut", () => {
  it("says where the caret goes, once a stretch and its gap are gone", () => {
    expect(cutOut("cone of [Image 2], in", 8, 9)).toEqual({
      text: "cone of, in",
      caret: 7,
    })
    expect(cutOut("[Image 1] make", 0, 9)).toEqual({ text: "make", caret: 0 })
    expect(cutOut("a\n[Image 1]\nb", 2, 9)).toEqual({
      text: "a\n\nb",
      caret: 2,
    })
  })
})

describe("withoutMark", () => {
  it("takes a picture's mark out, with one of the spaces round it", () => {
    expect(withoutMark(`Like ${pictureMark(1)} but taller`, 1)).toBe(
      "Like but taller"
    )
    expect(withoutMark(`${pictureMark(1)} make this`, 1)).toBe("make this")
    expect(withoutMark(`Make this ${pictureMark(1)}`, 1)).toBe("Make this")
    expect(withoutMark(`this${pictureMark(1)}, please`, 1)).toBe("this, please")
  })

  it("leaves the marks of other pictures, and words, as they are", () => {
    expect(withoutMark(`${pictureMark(1)} and ${pictureMark(2)}`, 1)).toBe(
      "and [Image 2]"
    )
    expect(withoutMark("Nothing marked", 1)).toBe("Nothing marked")
  })
})
