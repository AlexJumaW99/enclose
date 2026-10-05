# CAD AI

A desktop workbench for CAD projects that are built from code. You look at the model in
3D, click the part you mean, say what should change, and Claude edits the project and
rebuilds it. The view reloads by itself.

It does not replace a sketching tool. The idea is to draw the first shape wherever you
like (Shapr3D, for one), export it, and iterate from there in code with Claude.

Early days: it runs from source, on macOS, and expects a project that already knows how
to build its model. See [Not there yet](#not-there-yet).

## Run it

You need Node 22 or newer and, for the conversation,
[Claude Code](https://code.claude.com/docs/en/overview) installed and signed in.

```
npm install
npm run dev                      # open the app
npm run dev -- path/to/project   # ...with that folder added and open
```

`npm run build && npm start` runs the production build instead of the dev loop.

## How it works

**A project is a folder.** Add one with the + in the sidebar. The app looks in it for a
model manifest: a JSON file listing the parts, the mesh file of each, and how they are
grouped. The manifest and its files are build output; the project's own script writes
them. When the manifest is rewritten, the view reloads and keeps your camera where it was.

The manifest format is in [`shared/manifest-format.ts`](shared/manifest-format.ts). A
`cad-ai.json` at the top of the project can say where the manifest is and how to build:

```json
{ "model": "viewer/public/model/report.json", "build": "python3 make_enclosure.py" }
```

Without it, the nearest file named `cad-ai.model.json`, `report.json` or `model.json`
that lists parts is used.

**The view** draws each part as one mesh per colour, however many faces the CAD export
wrote, which is what keeps large assemblies smooth (the benchmark behind that is in
[`spikes/draw-calls`](spikes/draw-calls)). The toolbar comes from the manifest's layers:
a shell layer gets solid / glass / hidden, a toggle layer gets a switch. Explode and
section work on any model.

Moving around: drag to orbit, scroll or pinch to zoom, and hold Shift to pan, with a
drag or with a two-finger scroll on a trackpad. A right-button drag pans too.

**Claude** is the Claude Code already on your machine, run through the
[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) in the project's folder.
The app has no login of its own and stores no credentials; if you need to sign in again,
do it in Claude Code. Each project has one conversation, which resumes where it left off.

On top of what Claude Code can already do, the app gives Claude three tools: a screenshot
of the view as you see it, the list of parts with their sizes, and your current selection.
A message sent from a clicked part carries the part and the point you clicked, in the
model's coordinates.

By default Claude edits files in the project without asking and asks before anything
else, such as running the build. "Full access" in the message box turns the asking off.

## Where things are

```
electron/    the app's own process: window, project list, the line to Claude
shared/      types and the manifest format, used by both sides
src/         the window: project cards, 3D view, toolbar, conversation
scripts/     dev loop and production build
spikes/      experiments kept for their measurements
```

```
npm run typecheck
npm run lint
npm test
```

## Not there yet

- No installer. It runs from a checkout.
- It cannot open a STEP file by itself: something has to turn the CAD into a manifest
  first. Claude can write that build script when asked, but there is no ready-made one.
- Only tried on macOS.
- One conversation per project, and no way to answer Claude's multiple-choice questions
  (it asks in plain text instead).
- A section shows the cut as hollow shells; cut faces are not filled in.
