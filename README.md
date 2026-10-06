# Enclose

A desktop workbench for CAD projects that are built from code ([enclose.dev](https://enclose.dev)). You look at the model in
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

**A project is a folder.** Drop one on the window, or use the + beside the project cards
to open one or to start a new project. A new project is given a stand-in name to begin
with ("Quiet heron") and a folder to match, in `~/Documents/Enclose` unless the settings
say elsewhere: `2026-10-05-2336-quiet-heron`, which is when it was made and then the name
in lower case with dashes. Once something has been made in it, the project takes the name
of its model, and when Claude has finished the folder is renamed to match:
`2026-10-05-2336-pill-box`. A folder you opened yourself is never renamed.

The × on a card closes the project, which deletes nothing of yours: open the folder again
and its conversation is still there. The one thing it clears away is a project that came
to nothing, a folder the app made that is still empty and was never talked about.

The app looks in the folder for a
model manifest: a JSON file listing the parts, the mesh file of each, and the groups they
are listed under. A part is any separate component: a thing made, bought or fitted on
its own. The manifest and its files are build output; the project's own script writes
them. When the manifest is rewritten, the view reloads and keeps your camera where it was.

The manifest format is in [`shared/manifest-format.ts`](shared/manifest-format.ts). A
`enclose.json` at the top of the project can say where the manifest is and how to build:

```json
{ "model": "viewer/public/model/report.json", "build": "python3 make_enclosure.py" }
```

Without it, the nearest file named `enclose.model.json`, `report.json` or `model.json`
that lists parts is used. (Files named `cad-ai.json` and `cad-ai.model.json`, from before
the app had its name, are still read.)

**Starting from nothing.** A project can be an empty folder. Say what you want made and
Claude sets it up: it copies the app's exporter, [`kit/enclose.py`](kit/enclose.py), into
the folder, writes a `model.py` that builds the parts with
[build123d](https://build123d.readthedocs.io) and hands them to it, and runs it. The
exporter writes the meshes, the edges, a STEP file of each part and the manifest, and the
model appears as soon as it has. A machine that has Python but not build123d gets a
virtual environment in the folder first.

**The view** draws each part as one mesh per colour, however many faces the CAD export
wrote, which is what keeps large assemblies smooth (the benchmark behind that is in
[`spikes/draw-calls`](spikes/draw-calls)).

Moving around on a trackpad: move two fingers across it to orbit, pinch to zoom in on
whatever is under the pointer, and hold Shift to pan. With a mouse: drag to orbit, turn
the wheel to zoom, and drag with Shift held, or with the right button, to pan.

Orbiting does not stop straight above the model or straight below: it carries on over
the top and round the far side, with the model upside down, as it does in Blender. A set
view, or Cmd+1, brings it back the right way up, and goes there the short way however
many times the view has been turned about.

A trackpad and a wheel send the same scroll, so which one it was is read from how the
scroll moves ([`src/lib/scroll.ts`](src/lib/scroll.ts)). Holding Ctrl makes any scroll
zoom, whatever it was taken for.

The axes in the bottom right corner turn with the camera. Click the end of one to look at
the model from there, click it again for the opposite side, or drag inside it to orbit.
Those six views are flat: drawn with no perspective, so a side is seen exactly side-on,
centred and fitted to the window. Panning and zooming keep a view flat. Orbiting brings
the perspective back a little at a time, over the first 30° of the turn, and it goes the
same way over the last 30° of the turn into a flat view: the lens changes while the model
is turning, never while it is still.

| | |
|---|---|
| Cmd+1 | The view a model opens with |
| Cmd+2, Cmd+3 | Front, back |
| Cmd+4, Cmd+5 | Top, bottom |
| Cmd+6, Cmd+7 | Right, left |

From above and from below alike, the model's back is at the top of the view: the bottom
view turns the model over sideways, not end over end.

**Shading** is on Z, the way it is in Blender: the key brings solid, glass and wireframe
up round the pointer. Hold it, flick towards one and let go; or tap it, and click one.
A choice is pointed at by direction, so the pointer need not reach it. Esc, Z again or a
right-click puts the menu away. Glass makes the outside see-through (the groups a
manifest marks as `shell`, or everything if it marks none); wireframe draws edges only.

Down the right-hand edge:

- **Section** (S) cuts the model open. Three squares appear by the axes, one per direction
  to cut across, which the X, Y and Z keys choose too; in the view, drag the arrow to push
  the cut through the model and the arcs to tilt it. A second button appears to the left
  of this one, and shows the other half. While the model is cut open a tap of Z is the
  cut across Z, and holding the key, or flicking with it down, brings up the shading.
- **Explode** (E) pulls the parts apart by the distances the manifest gives (or straight
  out from the middle, if it gives none), and a slider along the bottom pulls them
  further.
- **Parts** lists what the model is made of: each part with a small picture of it, under
  the groups the model puts them in. Pick a part or a group and the view shows it on its
  own; pick it again and the rest comes back. Esc, or a press anywhere else, puts the
  list away and leaves what you picked showing, and the button stays lit while it is.

Esc puts the parts list away if it is up. After that it gets back out of the section,
the explode and whatever was picked in the list, one press each, starting with whichever
you went into last.

Nobody arranges the groups by hand. They come from the manifest, which the project's
build writes, and Claude is told that grouping is its job: when it adds or removes parts
it puts each where a person would look for it, and makes a group when none fits.

**Claude** is the Claude Code already on your machine, run through the
[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) in the project's folder.
The app has no login of its own and stores no credentials; if you need to sign in again,
do it in Claude Code. Each project has one conversation, which resumes where it left off.
Cmd+B shows the conversation, and puts it away again.

On top of what Claude Code can already do, the app gives Claude three tools: a screenshot
of the view as you see it, the list of parts with their groups and sizes, and your current
selection.
A message sent from a clicked part carries the part and the point you clicked, in the
model's coordinates.

By default Claude edits files in the project without asking and asks before anything
else, such as running the build. "Full access" in the message box turns the asking off.

**Settings** (the gear at the bottom left, or Cmd+,) hold where new projects go, whether
Claude asks before it acts, the theme, how a scroll is read and how fast the view turns,
and a list of every shortcut.

## Where things are

```
electron/    the app's own process: window, project list, the line to Claude
kit/         the exporter a project copies in to write its model (Python)
shared/      types and the manifest format, used by both sides
src/         the window: project cards, 3D view and its tools, conversation
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
