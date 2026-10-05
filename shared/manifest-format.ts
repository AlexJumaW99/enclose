// The one description of the model manifest. The README points here, and Claude is
// given this text when a folder has no model yet, so it can write one.

export const MANIFEST_NAMES = ["cad-ai.model.json", "report.json", "model.json"]

export const MANIFEST_FORMAT = `A model is a folder holding one manifest (a JSON file named cad-ai.model.json) and the
files it names. Every path in the manifest is relative to the manifest. Units are
millimetres, Z is up.

{
  "title": "Enclosure",                 // optional
  "layers": [                            // optional; how the toolbar groups parts
    { "id": "enclosure", "label": "Enclosure", "control": "shell" },   // solid / glass / hidden
    { "id": "inside", "label": "Electronics", "control": "toggle" },   // on / off
    { "id": "screws", "label": "Screws", "control": "always" }
  ],
  "parts": [
    {
      "id": "top",                       // unique, stable between builds
      "label": "Lid",
      "layer": "enclosure",              // "group" is read as the same thing
      "file": "top.glb",                 // glTF binary, Y-up metres (the build123d/OCCT default)
      "edges": "top.edges.bin",          // optional: float32 x1 y1 z1 x2 y2 z2 per edge segment, mm
      "color": "#f4f4f2",                // optional; omit to keep the colours in the file
      "matrix": null,                    // optional: 16 numbers, row-major, placing the part
      "explode": [0, 0, 46],             // optional: where it goes when exploded, mm
      "glass": true,                     // optional: force see-through (or not) in glass mode
      "finish": "metal"                  // optional: drawn as bare metal (screws, pins)
    }
  ],
  "keepouts": [                          // optional: space something needs that is not modelled
    { "id": "usb0", "label": "USB-C plug", "min": [x, y, z], "max": [x, y, z], "hits": [] }
  ],
  "downloads": [                         // optional: files to hand out, e.g. STEP per part
    { "file": "step/top.step", "name": "top.step", "label": "Lid", "detail": "", "kind": "part", "part": "top", "bytes": 265106 }
  ]
}

Export one glTF primitive per CAD face (what build123d's export_gltf does): the app
merges them for speed and keeps the face order so a click can be traced to a face.`
