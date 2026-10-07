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

The × on a card removes the project from the app. Its folder stays, with everything in
it, but what was said about it is forgotten, which the app asks about first: open the
folder again and it is a new project. The one folder it clears away is one that came to
nothing, which the app made and nothing was put in.

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

**Starting from nothing.** A project can be an empty folder. It opens as any project
does, in the viewer, with a plain cube standing in for the model there is not yet and the
conversation open beside it. Say what you want made and Claude sets it up: it copies the app's exporter, [`kit/enclose.py`](kit/enclose.py), into
the folder, writes a `model.py` that builds the parts with
[build123d](https://build123d.readthedocs.io) and hands them to it, and runs it. The
exporter writes the meshes, the edges, a STEP file of each part and the manifest, and the
model takes the cube's place as soon as it has. A machine that has Python but not build123d gets a
virtual environment in the folder first.

**The view** draws each part as one mesh per colour, however many faces the CAD export
wrote, which is what keeps large assemblies smooth (the benchmark behind that is in
[`spikes/draw-calls`](spikes/draw-calls)).

Parts are drawn in the app's own colours: ten light ones round the whole circle of colour
(red, orange, yellow, lime, green, cyan, blue, indigo, violet, pink), and white, a light
grey and a grey. A model can name one for a part; any other colour it gives, or its files
carry, is drawn as the nearest of them, except greys, white and black, which are drawn as
they are, and bare metal. A part given no colour takes the one that falls to its group. Nothing in the
project's files is changed by this: it is only how the app draws them.

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

**Shading** is on Z, the way it is in Blender: the key brings solid, glass, wireframe and
outline up round the pointer. Hold it, flick towards one and let go; or tap it, and click
one. A choice is pointed at by direction, so the pointer need not reach it. Esc, Z again
or a right-click puts the menu away. Glass makes the outside see-through (the groups a
manifest marks as `shell`, or everything if it marks none). Wireframe draws the model's
lines and nothing of its surfaces, which still hide the lines behind them; outline draws
every line, the hidden ones too. In all three a curved face is given the line where it
turns out of sight, which is no edge of the model's and moves as the model is turned.

Down the right-hand edge:

- **Section** (S) cuts the model open. Three squares appear by the axes, one per direction
  to cut across, which the X, Y and Z keys choose too; in the view, drag the arrow to push
  the cut through the model and the arcs to tilt it. Two more buttons appear to the left
  of this one: one shows the other half, the other starts the cut again. A cut is kept
  as it is left: cut open again, the model is cut the same way, until it is started
  again. While the model is cut open a tap of Z is the cut across Z, and holding the
  key, or flicking with it down, brings up the shading.
  Where the cut passes through a solid part it leaves a face in the part's colour, with
  lines across it, the way a drawing marks what has been cut through. Where two parts
  are in the same place by more than a tenth of a millimetre, the cut shows it in red.
  (A part whose surfaces do not close, and anything drawn as glass or by its lines, is
  left open.)
- **Explode** (E) pulls the parts apart by the distances the manifest gives (or straight
  out from the middle, if it gives none), and a slider along the bottom pulls them
  further.
- **Parts** (P) lists what the model is made of: each part with a small picture of it,
  under the groups the model puts them in. Pick a part or a group and the view shows it
  on its own; pick it again and the rest comes back. Esc, or a press anywhere else, puts the
  list away and leaves what you picked showing, and the button stays lit while it is.
- **Grid** (Shift+G, as in Figma) rules the ground into squares and draws the world's
  three axes through its origin, in the colours they have in the corner of the view.
  Both go on as far as can be seen, however far out the view is taken. The squares are a
  power of ten millimetres across, whichever suits how near the view is, with every
  tenth line heavier: zoom out and they give way to squares ten times the size. It stays
  on, or off, from one model to the next.

Esc puts the parts list away if it is up. After that it gets back out of the section,
the explode and whatever is showing on its own, one press each, starting with whichever
you went into last.

Nobody arranges the groups by hand. They come from the manifest, which the project's
build writes, and Claude is told that grouping is its job: when it adds or removes parts
it puts each where a person would look for it, and makes a group when none fits.

**Claude** is the Claude Code already on your machine, run through the
[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) in the project's folder.
The app has no login of its own and stores no credentials; if you need to sign in again,
do it in Claude Code. Cmd+B shows the conversation, and puts it away again.

A project can have any number of conversations, and none of them is deleted while the
project is in the app. Its card is the one being carried on. A conversation left alone
for three days (the settings say how many) settles: it goes under the card with the
earlier ones, and the card offers a new session. The edge of the card that shows beneath
is what spreads them out, and any of them can be opened and carried on where it left off.
One thing at a time is done in a project's folder, so only one of them runs at once.
A conversation goes by the first thing said in it, until it is given a name: click the
name at the top of the conversation and write another.

A card says the last of its conversation in two lines: what was asked, while Claude is at
work on it, and otherwise what was last said. A message too long for that is summed up
in a few words by the quickest of your Claude Code's models, which is given the message
and nothing else. If Claude is at work in a conversation under the card, the edge of the
card says so.

On top of what Claude Code can already do, the app gives Claude three tools: a screenshot
of the view as you see it, the list of parts with their groups and sizes, and your current
selection.
Click a part and it is picked out: it turns white, with a heavier line round it,
and three buttons appear where you clicked, with the part's name beside them,
and stay on that spot of the part as it is turned. While you choose a colour for it, and
for a moment after, the part is seen in its own colour instead. One gives it
another of the app's colours, which is how the app draws it from then on (Claude is told,
when it asks what the parts are). One downloads the part as STEP, where the model hands
that out. And one opens a box to say what should change at the place you clicked.
With a part picked out, I shows it on its own and brings the camera to it, from the side
the camera is on: the part in the middle of the view, filling it. The flat views and the
opening view frame the part while it is alone. I again, or Esc, brings the rest back and
puts the camera where it was. Enter keeps what you wrote for the next message: it shows as a
chip on the message box and as a mark on the part, and you can go on to say things of
other parts, which gather there. Click a chip or a mark to change what you said. Cmd+Enter
sends at once, with everything gathered and whatever is in the message box. Each thing
said goes to Claude with its part and the point clicked, in the model's coordinates.

A message can call on things by name. Write @ and a list of the model's parts comes up
over the box: the arrow keys move through it, and Enter or Tab puts the part in, by its
id. While the list is up the view shows where each part is: the one the list is on is
drawn solid and everything else see-through, whatever the shading, and the view goes
back to how it was when the list goes. $ does the same for the skills of the Claude
Code on your machine (your own, the project's, a plugin's), and Claude loads the skill
you name before it starts on the work. A message that begins with / is a command: any
that you, the project or a plugin have given Claude Code, and three of its own that mean
something here (compact, context and usage). Esc puts the list away.

Under the message box are three choices: which of Claude Code's models answers, how hard
it thinks, and what it may do without asking. The models are the ones your Claude Code
offers; "Default" leaves the model, and how hard it thinks, as Claude Code is set.
Claude starts out with full access and never asks. It can be made to ask before it
changes a file or runs anything ("Supervised"), to edit files freely and ask before
anything else ("Auto-accept edits"), or to do what is routine and ask about the rest
("Auto").

**Settings** (the gear at the bottom left, or Cmd+,) hold where new projects go, how much
Claude asks before it acts, the theme, how a scroll is read and how fast the view turns,
and a list of every shortcut.

## Where things are

```
electron/    the app's own process: window, project list, the line to Claude
icons/       the app's icon, in the sizes each system asks for
kit/         the exporter a project copies in to write its model (Python)
shared/      types and the manifest format, used by both sides
src/         the window: project cards, 3D view and its tools, conversation
scripts/     dev loop, production build, and the icon's sizes
spikes/      experiments kept for their measurements
```

The icon is drawn once, as [`icons/icon.png`](icons/icon.png): 1024 pixels across, on
Apple's grid, with the margin a Mac wants round the tile. `npm run icons` makes the rest
from it: `icon.icns` for macOS, and for Windows and Linux, where an icon fills its
square, `icon.ico` and `icon-512.png` with the margin cut away.

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
- No way to answer Claude's multiple-choice questions (it asks in plain text instead).
- A section shows the cut as hollow shells; cut faces are not filled in.
