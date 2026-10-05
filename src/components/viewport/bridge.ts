// What the rest of the window - and through it, Claude - can ask of the 3D view. Each
// entry is set while a model is on screen and null otherwise.
export const bridge: {
  /** the view as it is right now, as a JPEG */
  screenshot: (() => { data: string; mimeType: string }) | null
  /** every part of the model, with its size and whether it is showing */
  parts: (() => unknown[]) | null
} = { screenshot: null, parts: null }
