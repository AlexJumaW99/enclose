import { describe, expect, it } from "vitest"

import { appKey } from "./app-keys"

/** A key pressed with these held, and nothing else. */
const pressed = (
  key: string,
  ...held: ("cmd" | "ctrl" | "alt" | "shift")[]
) => ({
  key,
  metaKey: held.includes("cmd"),
  ctrlKey: held.includes("ctrl"),
  altKey: held.includes("alt"),
  shiftKey: held.includes("shift"),
})

describe("appKey", () => {
  it("is each of the app's keys, held with Cmd on a Mac", () => {
    expect(appKey(pressed(",", "cmd"), true)).toBe("settings")
    expect(appKey(pressed("n", "cmd"), true)).toBe("new")
    expect(appKey(pressed("o", "cmd"), true)).toBe("open")
    expect(appKey(pressed("b", "cmd"), true)).toBe("conversation")
    expect(appKey(pressed(".", "cmd"), true)).toBe("bare")
  })

  it("is each of them held with Ctrl, off a Mac", () => {
    expect(appKey(pressed(",", "ctrl"), false)).toBe("settings")
    expect(appKey(pressed("n", "ctrl"), false)).toBe("new")
    expect(appKey(pressed("b", "ctrl"), false)).toBe("conversation")
    expect(appKey(pressed(".", "ctrl"), false)).toBe("bare")
    // (and Cmd there is another system's key)
    expect(appKey(pressed("b", "cmd"), false)).toBeNull()
  })

  it("is no key of the app's with nothing held, or with the wrong thing", () => {
    expect(appKey(pressed("b"), true)).toBeNull()
    expect(appKey(pressed("."), true)).toBeNull()
    expect(appKey(pressed(".", "cmd", "alt"), true)).toBeNull()
    expect(appKey(pressed("k", "cmd"), true)).toBeNull()
  })

  it("leaves Ctrl on a Mac to the keys that move through text", () => {
    expect(appKey(pressed("b", "ctrl"), true)).toBeNull()
    expect(appKey(pressed("b", "cmd", "ctrl"), true)).toBeNull()
  })

  it("takes a letter however it is written", () => {
    expect(appKey(pressed("N", "cmd"), true)).toBe("new")
  })

  it("asks for a file or a folder alike on a Mac, and off one for one or the other", () => {
    expect(appKey(pressed("o", "ctrl"), false)).toBe("open-file")
    expect(appKey(pressed("O", "ctrl", "shift"), false)).toBe("open-folder")
    // a Mac's picker takes both: there is no other key for a folder there
    expect(appKey(pressed("O", "cmd", "shift"), true)).toBeNull()
  })

  it("goes with Shift for nothing but that", () => {
    expect(appKey(pressed("N", "cmd", "shift"), true)).toBeNull()
    expect(appKey(pressed("B", "ctrl", "shift"), false)).toBeNull()
    expect(appKey(pressed(">", "cmd", "shift"), true)).toBeNull()
    expect(appKey(pressed("<", "ctrl", "shift"), false)).toBeNull()
  })
})
