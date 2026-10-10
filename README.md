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
npm run dev -- path/to/project   # ...with that folder, or STEP file, opened as a project
```

`npm run build && npm start` runs the production build instead of the dev loop.

## How it works

**A project is a folder.** Drop one on the window, or use the + beside the project cards
to open one or to start a new project. STEP files can be dropped and opened the same way:
see *Starting from CAD files* below. A new project is given a stand-in name to begin
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

**Starting from an example.** With no projects yet, the window says how one is started
and, beside that, shows the app's examples in a row that scrolls along: a table clock, a
robot arm, a clip lamp and a counter stool, each with its picture and how much there is
to download. Click one and a project is made of it where new projects go, yours to
change. The examples are not in the app, which would be six times the size for them.
Each is one archive (`clock.tar.br`: its folder as a tar archive, squeezed with Brotli,
which makes 20 MB of the four where the folders are 137), kept with a release of the
app's repository. It is fetched when it is asked for, taken for the example only if it
has the size and the SHA-256 the app was made to expect, and unpacked. Run from a
checkout, the app has the examples beside it in [`examples/`](examples) and copies one
from there instead. [`shared/examples.json`](shared/examples.json) is the list of them.
`npm run examples` packs them again after a change, into `release/examples/`, and writes
their sizes and sums into the list; the archives then go up as a release under a new
name (the list says which), since an app already made goes on fetching the ones it was
made with. `ENCLOSE_EXAMPLES_URL` has them fetched from somewhere else, a folder of them
served on your own machine say.

**Starting from CAD files.** Open a STEP file (`.step`, `.stp`), several at once, or a
folder that has some in it, and the app makes a project of them. It does not work in the
folder they came from, which could be laid out any way at all: it copies the files into a
new folder beside its other projects, named for the file or the folder, and sets that up
the way its own projects are. The copies go in `source/`; a `model.py` reads every body in
them as a part with `read_step`, from the same [`kit/enclose.py`](kit/enclose.py); and the
build runs by itself, so the model is on screen a few seconds later. A file that is an
assembly gives a part for each component, and a component that is several solids (how
Shapr3D exports its bodies) gives a part for each, under the names the file has for them.
From there it is a project like any other: ask Claude for a change and it edits `model.py`.
What was opened is left as it was.

While the files are read and the model is made, the middle of the view says how far along
it is, under the mark turning over. Then Claude looks the model over, while a light goes
across all of its parts and the camera goes slowly round it, from a little further back
than a model opens at; when Claude is through, the view comes in to the model again. The
app draws it pictures of the model (put together, from the
other side, pulled apart, and each part by itself) and it says what it takes the thing to
be, and names and groups the parts, keeping the names the files gave where they are good
ones. That is a conversation of the project's, begun by the app, and it ends with what
Claude made of the model and what it was unsure of. For this one turn Claude has none of
Claude Code's own tools: it can name and group, which the app writes into `model.py` as a
table and builds, and nothing else. It can be stopped, and the settings can turn it off
(General, Opened files); without Claude Code on the machine it does not happen.

A folder that already holds a model the app can show, or an `enclose.json`, is a project
as it stands and is opened where it is. So is a folder with no CAD file in it.

The build needs a Python with build123d. Where there is none the project is still made,
with the files in it, and says so: ask Claude to set it up and it makes a virtual
environment in the folder, as it does for a project started from nothing.

**Screws** are parts of the model like any other, and Claude puts them in: when what it
makes is screwed together (a lid on its box, a board on its posts), and when it is asked
for them. It does not draw them itself. They come from a library the app keeps beside its
exporter, [`kit/screws.py`](kit/screws.py), which a project copies in the same way: metric
screws from M1.6 to M12 with socket, button, countersunk, pan and hexagon heads, hex nuts
and plain washers, each to the sizes its standard gives (ISO 4762, 7380, 10642, 7045,
4017, 4032 and 7089), in the lengths screws are sold in, and with its thread cut. It gives
what is cut for a screw as well: the hole it passes through, the hole it screws into, and
the recess a head sinks into. Claude chooses the screw and says which it used, in its
reply and in the part's name ("Lid screws, M3 × 8"), since few people can tell one size
from another by looking. Asked for a bigger or a smaller one with no size named, it asks
which, and says what each measures.

The edges of a thread are too near one another to draw: as lines they run together into
a black band, in the view and in a blueprint. So the exporter leaves out an edge that
winds round and round within a millimetre of the next, and a thread shows by its own
light and shade.

**Pulled apart**, a model that gives its parts no `explode` of their own comes apart by
its groups, not part by part: the parts of a group that touch one another go as one
piece, so a circuit board keeps its components and a switch its pins. The outside (a
group marked `shell`) still comes apart part by part, as do parts in no group and a model
that is all one group.

**The view** draws each part as one mesh per colour, however many faces the CAD export
wrote, which is what keeps large assemblies smooth (the benchmark behind that is in
[`spikes/draw-calls`](spikes/draw-calls)).

Parts are drawn in the app's own colours: ten light ones round the whole circle of colour
(red, orange, yellow, lime, green, cyan, blue, indigo, violet, pink), and white, a light
grey and a grey. A model can name one for a part; any other colour it gives, or its files
carry, is drawn as the nearest of them, except greys, white and black, which are drawn as
they are, and bare metal. A part given no colour takes the one that falls to its group. Nothing in the
project's files is changed by this: it is only how the app draws them.

A part that is made of something clear, a window or the glass over a dial, is drawn
see-through whatever the shading, with no colour unless it is given one: the model says
so of the part (`finish="glass"`). A click on it picks what is behind it, and a blueprint
draws what it covers.

What is round is drawn round. The exporter cuts every curve into flats that keep within a
fiftieth of a millimetre of it, however big the curve is, so the rim of a dial is as
smooth as a pin; a model built before that was so is drawn in fewer, until its project's
`enclose.py` is replaced with the app's and it is built again.

Moving around on a trackpad: move two fingers across it to orbit, pinch to zoom in on
whatever is under the pointer, and hold Shift to pan. With a mouse: drag with the right
button to orbit, turn the wheel to zoom, and hold Shift with either to pan. The main
button is not the camera's: it picks parts out.

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
| Space | What is picked out, close to, from the side the camera is on |

From above and from below alike, the model's back is at the top of the view: the bottom
view turns the model over sideways, not end over end.

The model is lit from above. Looked at from below it would be in its own shadow, so a
light under it comes up as the camera goes below the level: from straight below, what
faces down is as light as what faces up is from straight above. From above nothing is
changed by it.

**Shading** is on Z, the way it is in Blender: the key brings solid, glass, pattern,
wireframe and outline up in a circle round the pointer. Hold it, flick towards one and let
go; or tap it, and click one. A choice is pointed at by direction, so the pointer need not
reach it. Esc, Z again or a right-click puts the menu away. Glass makes the outside
see-through (the groups a manifest marks as `shell`, or everything if it marks none).
Wireframe draws the model's lines and nothing of its surfaces, which still hide the lines
behind them; outline draws every line, the hidden ones too. In all of these but solid a
curved face is given the line where it turns out of sight, which is no edge of the model's
and moves as the model is turned.

Pattern is wireframe with every face ruled into squares, in three of the colours parts
are drawn in: one for the lines across each of the part's axes. Each face is ruled into
about as many squares as any other, so a small face is ruled finely and a large one
coarsely. Lines that would crowd one another on the screen are thinned out, every other
one at a time, so a model seen from far off is not a blur of them.

Down the right-hand edge:

- **Download STEP**, at the top, saves the whole model as one STEP file, with every part
  in its place; its tooltip says how big the file is. (One part, or the parts of one
  group, are saved from the list of parts, below.)
- **Parts** (P) lists what the model is made of: a card for each group the model puts
  its parts in, and in it a row of the group's parts, each a picture with its name and
  the size of its STEP file. A row with more parts than fit scrolls sideways. Pick a part
  or a group and the view shows it on its own, with the camera brought to
  it, in the middle of what the list leaves of the view; pick it again and the rest
  comes back, and the camera goes back to where it was. (A group is picked by a click
  on its card, anywhere but on its name.) Esc, or a press anywhere else, puts the list away and leaves what you
  picked showing, and the button stays lit while it is. A part put out of sight with H is
  dim in the list, as is a group all of whose parts are, and picking it there brings it
  back; the button stays lit while anything is out of sight. The arrow that comes up
  beside a part's name saves that part as STEP. The arrow beside a group's name saves
  the STEP files of all its parts, in a folder named after the group, inside one you
  choose.

  The groups can be changed by hand. Several parts are picked in the list as in any
  list, and shown together: hold Cmd and click parts to add them one by one (or take
  one back out), or click one and hold Shift on another for every part from the one to
  the other, across groups. Hold either key and click a group's card for the whole
  group, which is how two groups are picked to be made one. Or pick parts out in the
  view. **Cmd+G** makes a group of what is picked, which goes to the top of the list,
  and Claude is asked what to call it: the card glimmers while the name is on its way. **Shift+Cmd+G** takes them out of
  their groups, to be listed last as in none; with a whole group picked, by a click on
  its card, that is the end of the group. Click a group's name to write another over it
  (Enter keeps it, Esc does not, and nothing written gives back the name it had). All
  of this is taken back with Cmd+Z. It is kept by the app, not in the project's files:
  Claude is told how you have the parts when it asks what they are, and is to write the
  same groups into the model the next time it changes it. Should a build put a part in
  some other group, or call a group something else, the build is what is shown.
- **Grid** (Shift+G, as in Figma) rules the ground into squares and draws the world's
  three axes through its origin, in the colours they have in the corner of the view.
  Both go on as far as can be seen, however far out the view is taken. The squares are a
  power of ten millimetres across, whichever suits how near the view is, with every
  tenth line heavier: zoom out and they give way to squares ten times the size. It stays
  on, or off, from one model to the next.
- **Section** (S) cuts the model open. Three squares appear by the axes, one per direction
  to cut across, which the X, Y and Z keys choose too; in the view, drag the arrow to push
  the cut through the model and the arcs to tilt it. While the pointer is on either, or
  has hold of it, a faint square shows where the cut lies and how it is tilted. Two more
  buttons appear to the left of this one: one shows the other half, the other starts the
  cut again. A cut is kept as it is left: cut open again, the model is cut the same way,
  until it is started again. While the model is cut open a tap of Z is the cut across Z,
  and holding the key, or flicking with it down, brings up the shading.
  Where the cut passes through a solid part it leaves a face in the part's colour, with
  lines across it, the way a drawing marks what has been cut through. Where two parts
  are in the same place by more than a tenth of a millimetre, the cut shows it in red.
  (A part whose surfaces do not close, and anything drawn as glass or by its lines, is
  left open.)
- **Explode** (E) pulls the parts apart by the distances the manifest gives (or straight
  out from the middle, if it gives none), and a slider along the bottom pulls them
  further.
- **Reference** (Cmd+/) sets the model among things of a known real size, so that how
  big it is can be seen. A model fills the view whatever size it is, and it is easy to
  take one for bigger than it will be in the hand. The key sets it in the scene that
  suits it, at once, and again takes it back out: a desk 58 inches by 29, with the model
  in the middle of its top; for a thing that stands on the floor, an empty room 12 feet
  by 10, with a doorway in the far wall; or for a thing too big for a room, a man 5 feet
  9 tall, standing beside it. Which of them suits is for whoever builds the model to
  say, by where the thing is used: Claude is told to, with `reference="room"` in the
  model's script (`"reference"` in a manifest written some other way). Where nothing is
  said it goes by size, and a model too big for the desk is shown in the room, and one
  too big for the room beside the person. The button brings up the list of scenes, each
  with a picture, its name and its sizes: pick one and the model is set in it, and it is
  the scene for that project from then on; pick the one the model is in and the model is
  taken out.

  A scene is drawn to be looked past: flat, all in one tone a little lighter than the
  view behind it (darker, in the light theme), with a thin line round each thing in it
  and along its edges, and nothing of it can be picked. The camera goes to the view a
  model opens with, from above and in front, to take all of the scene in, whichever side
  the model was being looked at from; and when the model is taken out it goes back to
  where it was, unless the view was turned meanwhile; Cmd+1 and the set views frame the scene with the model for as long as it
  is there. The grid, if it is on, is ruled on the scene's floor. The camera keeps above
  the ground the scene stands on, as an eye would: it goes down round the model as far
  as that ground and stops, and the view from underneath (Cmd+5) is not to be had until
  the model is taken out. Pulled apart, the model comes apart over the scene, which goes
  down as far as the model's lowest part does. The walls of a room are seen from inside
  it and seen through from outside, so that none is ever in front of the model. The desk
  has the same man to show, the measure everyone has: a button at the foot of the view,
  with a figure on it, stands him at the far side of the desk, facing across it, and
  takes him away again. He is there once he is asked for, in whatever project is open,
  and the camera stands back for him as it does for a scene.

  [`examples/stool`](examples/stool) is a project to try it on: a counter stool, drawn
  to the sizes it is sold by, whose model asks to be seen beside the person. Open the
  folder as a project and press Cmd+/.

  Nobody is kept to the app's scenes. With the model set in one, a button at the foot of
  the view, **Improve reference scene in chat**, puts the scene on the message box as a
  chip and opens the conversation. What is written then is about the scene and not the
  model, and Claude changes it: a workbench in place of the desk, the shelf the thing is
  to stand on. What comes of that is the project's own scene, kept in its folder and
  built the way its model is: a `reference.py` hands shapes to the exporter
  ([`kit/enclose.py`](kit/enclose.py)), which writes `reference/enclose.reference.json`
  and the meshes beside it. A scene can hold a mesh that comes ready made as well
  (`Reference.mesh`), which is how the figure of a person gets into one: it is not built
  in a script but is a file, made from Blender Studio's public-domain body meshes
  ([`kit/figure`](kit/figure)). The app shows that scene for the project from then on,
  first in the list, and loads it again whenever it is rewritten. (An `enclose.json` can
  say where it is: `"reference": "path/to/enclose.reference.json"`.) The app's own
  scenes are written the same way, in [`kit/scenes`](kit/scenes), and are what Claude
  starts from; `npm run scenes` builds them again after a change, with a Python that has
  build123d.
- **Blueprint** (B) puts the model's drawings where the view was: the model drawn flat,
  from four of its corners and then from each of its six sides, each on a sheet of
  its own, upright and four wide to five high (210 by 262.5 mm, the width of A4). A corner shows three sides at once, all turned equally from the eye (an
  isometric drawing): the top or the bottom, with the front and the left side or the
  front and the right. The sheets stand in a row
  that is gone along sideways, and a wheel that only turns up and down goes along it too.
  There is nothing on a sheet but the drawing, in the middle of it: no border and no
  title block. The lines are the model's edges and the outlines of its curved
  faces, with whatever is behind something left out. That is worked out from the model
  and not from a picture of it, so a line stops exactly where it goes behind another
  part, however closely the drawing is looked at afterwards. A drawing is life size
  where the model fits the sheet; where it does not, the six sides are all to the one
  scale, the least reduction that fits (1:2, 1:5, 1:10 and so on), and the four corners,
  which take more room, to one of their own. The lines are a point and a half wide. The
  arrow over a sheet saves it
  as an SVG, the size of the sheet and in millimetres, with nothing in it but the lines: those of each part
  together under the part's name, and the parts of each group under the group's, so that
  a program that draws (Illustrator, Figma, Inkscape) opens it with the model's own
  layers. Its tooltip says the scale. What is drawn is what the view had on show: pick
  parts in the list and the sheets are of those, put some out of sight with H and they
  are left out, pull the model apart and it is drawn pulled apart. The cut and the
  ground are the view's, and their buttons wait until it is back. So do the cards of the
  other projects, which close up out of the sheets' way and leave the open project's
  card at the top. B again, the button or Esc brings the view back, as it was left.

  At the foot of the sheets are two switches. **Exploded** draws the model pulled
  apart, as E does, and brings up beside it the slider that pulls it further.
  **Dimensions** has the sheets say how big the model is: its width, height and depth,
  each as a thin line with an arrowhead at either end and the figure over it. A side
  shows the two it can, across its top and down its left, and a corner all three. They
  are of what is drawn, so of the parts on show, and are saved with a sheet, in a group
  of their own. Beside the switch, while it is on, is what they are in: millimetres or
  inches, which the settings have too (General, Blueprints). **Download all SVG**, after
  them, saves every sheet at once, in a folder named after the model inside one you
  choose.
- **Search** (Cmd+F) finds parts and groups by name. A box comes up at the top of the
  view, and as you type in it the whole model goes see-through but for what goes by the
  name, which turns white the way a part does when it is picked out, wherever in the
  model it is. Each thing found has its name on a tag beside it: a part's by the part,
  and a group's, with the sign of the parts list on it, by the group. Where they would
  lie over one another, the nearest to what you typed are the ones shown, and turning
  the view makes room for others. Click a tag and what it names is shown on its own,
  with the camera brought to it, as I does with what is picked out; Enter does the same
  with all that was found. Esc, the cross in the box or the button again puts the box
  away and leaves the view as it was. All of the model is looked through, whatever the
  view was cut down to and whatever was put out of sight. While the box is up nothing is
  picked out, and what you type goes into it wherever the pointer has been since, so the
  view can be turned between one letter and the next; a click on a part picks it out as
  ever, and that is the end of the search.

- **Tools** (T) is the one blue button, and is there only in a project that has tools of
  its own. They are not the app's: each was made for that project's model, by Claude,
  because someone asked to see the model do something. The hands of a clock set to a
  time and run, a lid opened by a slider, an arm steered joint by joint. The app has no
  animation of its own to learn, and nobody has to wait for one to be added: say what
  you want to try, and Claude builds the tool for it. What is the project's own is
  blue, the button and the panel it brings up, so that it is never taken for something
  the app came with.

  The panel has a tab for each tool, and under it the tool's controls, one below
  another: what each is called, what it does in a few words, and beside that the
  control itself. A control is one of the app's kinds, whatever the tool: a slider, a
  pad that takes two values at once (and can spring back, as a joystick does), a
  switch, a choice of a few, a list of many, a row of buttons, a choice among the
  app's colours, or something the tool says. The panel stays up while the view is
  turned, since a tool is worked with the model in sight. The button or Esc puts it
  away, and the tools are still at work then, the button still lit: Esc again lets go
  of the model, which is back as it is built.

  A tool is one file of JavaScript in `tools/` at the top of the project
  (`tools/clock.js`), a tab for each file, loaded again whenever it is written. It
  says what its controls are and, each time the view is drawn, where the parts are
  from how the controls stand: turned about a line, carried somewhere, put out of
  sight, drawn in another colour. It changes nothing in the project's files; the parts
  are only drawn where it has them. [`kit/tools.md`](kit/tools.md) says how one is
  written, and is what Claude reads before it writes one. A tool is run shut away from
  the rest of the app, in a worker of its own: it is told the parts' names and sizes,
  and has no way to the window, to files or to the network, so a project that came
  from someone else can be opened with its tools. One that goes wrong, or never comes
  back from a frame, is stopped and says why in its tab, with a button that takes that
  to Claude.

  [`examples/clock`](examples/clock) is a project to try it on, and the rest of the app
  with it: a table clock, a mechanical movement in a drum case on a stand. The bezel,
  the dial, the back, the movement and the stand are each screwed on, with screws from
  the app's library in holes cut to fit them, and there is glass over the dial. The
  movement is a whole one, from the barrel to the balance, its wheels cut to the
  numbers of teeth a real one has. Its tool sets the time the hands show, runs it
  forwards or back at three speeds, or keeps it to the computer's clock; at the
  clock's own speed the balance swings and the train goes on in beats, four to the
  second. Glass shows the movement in its case, Explode takes it apart in the order it
  is put together, and the dial has a window on the balance. Open the folder as a
  project, or, with no projects yet, click it among the examples the window shows: that
  makes a project of a copy of it, where new projects go.

  [`examples/arm`](examples/arm) is another: a robot arm that was not drawn here. It
  is the SO-101, an open-source arm, read from its makers' own CAD file
  ([where it is from](examples/arm/source/README.md)), and its tool steers it joint by
  joint or takes it to a pose.

Esc puts the search away if it is up, and then the parts list, the list of reference
scenes, or the project's tools. After that it gets back out of the section, the explode,
the reference scene, the tools' hold on the model, whatever is showing on its own and
whatever was put out of sight, one press each, starting with whichever you went into
last.

Nobody arranges the groups by hand. They come from the manifest, which the project's
build writes, and Claude is told that grouping is its job: when it adds or removes parts
it puts each where a person would look for it, and makes a group when none fits.

**Claude** is the Claude Code already on your machine, run through the
[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) in the project's folder.
The app has no login of its own and stores no credentials; if you need to sign in again,
do it in Claude Code. Cmd+B shows the conversation, and puts it away again.

Claude works on the project, and not on the app. What it makes for you is made in the
project's folder: the model, a reference scene, tools. It is told that Enclose itself is
not its to change, whoever asks: not its code or the files it keeps for projects to copy,
and not how its view, its panels or a tool's controls look and work. Asked for that, it
says so and offers what can be done in the project. The app is open source: fork it to
make it otherwise.

A project can have any number of conversations, and none of them is deleted while the
project is in the app. Its card is the one being carried on. A conversation left alone
for three days (the settings say how many) settles: it goes under the card with the
earlier ones, and the card offers a new session. The edge of the card that shows beneath
is what spreads them out, and any of them can be opened and carried on where it left off.
One thing at a time is done in a project's folder, so only one of them runs at once.
A conversation goes by the first thing said in it, until it is given a name: click the
name at the top of the conversation and write another.

What Claude says at the end of a turn is short: a sentence or two, since what it did is
already there in the view. It says what you could not tell by looking (something it could
not do, a guess that decided what you got, a question for you) and keeps the rest, how it
went about it and the sizes and clearances, under a Details line beneath the reply, which
opens as the steps above it do. A question is answered outright, at the length it needs.
What Claude says on the way, between one step and the next, is not its answer: it shows
while Claude is at work and is then kept with the steps, under the line that says how
long it worked.
Claude is told to answer so, and sets the rest off in a `<details>` block for the app to
fold away; a reply with nothing set off is shown whole, as every earlier one is.

What Claude makes is drawn at the size it is to be made, so it is told where sizes come
from: what you said, what is already in the model, the standard for a thing that has one
(looked up, not made up), and only then what such a thing commonly measures. It says
which sizes decided the shape, and leads with any that were its own guess.

Mostly it shows that guess and lets you correct it. Where a wrong guess would waste the
build (the thing has to fit something of yours whose size it cannot know, or what you
asked for could be quite different things) it asks first, in the conversation, one
question at a time: a few likely answers to click, and a line to write your own. A click
goes on to the next question, and the last one sends them all; **Skip** leaves a question
to Claude, which goes by its best guess and says what it was. Whatever access Claude has,
what it asks is put to you: a question is no leave to do something.

A card says the last of its conversation in two lines: what was asked, while Claude is at
work on it, and otherwise what was last said, which of a reply of Claude's is the short
part. A message too long for that is summed up
in a few words by the quickest of your Claude Code's models, which is given the message
and nothing else. If Claude is at work in a conversation under the card, the edge of the
card says so.

On top of what Claude Code can already do, the app gives Claude three tools: a screenshot
of the view as you see it, the list of parts with their groups and sizes, and your current
selection. It has two more for a project's own tools, the ones it makes for you to work
the model with: how they stand, with the error of one that did not load, and a hand on
one of their controls, so that it can try what it made and look at the model before it
says it is done.
Click a part and it is picked out: it turns white, with a heavier line round it, and
three buttons appear where you clicked, with the part's name beside them, and stay on
that spot of the part as it is turned. While you choose a colour for it, and for a moment
after, the part is seen in its own colour instead. One gives it another of the app's
colours, which is how the app draws it from then on (Claude is told, when it asks what
the parts are). One downloads the part as STEP, where the model hands that out. And one
opens a box to say what should change at the place you clicked. Where the part is one of
several that make one object (the parts of a group that touch one another, as they go
when the model is pulled apart), the click picks out the whole object, and so does the
pointer light it up: a circuit board with all that is on it, under the group's name, or
under that of its widest part where it is only some of the group. The colour is then
given to all of it, what you say is said of all of it (Claude is told which parts those
are, and where on them you clicked), and there is no file of it to download. A click with
Shift held picks out the one part, and while Shift is held the pointer lights up just
that part. So does a second click on the same spot, or a click with Cmd held (Ctrl, off a
Mac). With Shift held it is the second click that goes the other way: straight after the
first, on the same spot, it takes in the whole of the object the part belongs to.
With a part picked out, I shows it on its own and brings the camera to it, from the side
the camera is on: the part in the middle of the view, filling it. The flat views and the
opening view frame the part while it is alone. I again, or Esc, brings the rest back and
puts the camera where it was. Space brings the camera to what is picked out in the same
way, one part or several, and changes nothing else: the rest stays on show, and Cmd+1 is
all of the model again. H is the other way about from I: it puts what is picked out, one
part or several, out of sight and leaves the rest. Pick out more and H hides those too;
H with nothing picked out, or Esc, brings back all that was hidden, and the list of parts
brings them back one at a time. Enter keeps what you wrote for the next message: it shows as a
chip on the message box and as a mark on the part, and you can go on to say things of
other parts, which gather there. Click a chip or a mark to change what you said. Cmd+Enter
sends at once, with everything gathered and whatever is in the message box. Each thing
said goes to Claude with its part and the point clicked, in the model's coordinates.

Cmd+Z takes back the last thing done to the model, and Cmd+Shift+Z puts it back. That is
a colour you gave a part, or what Claude did in a turn, whichever was done later; press
it again for the one before. What Claude did is taken back whole and at once, without
asking it for anything and without building anything: before each turn the app puts the
project's files aside, and keeps of them whatever the turn then wrote to, made or took
away, the built model with the rest. A turn you stopped part of the way is taken back
like any other. The conversation says that it was done, and Claude is told with your
next message, so that it does not go on as though its change were still there. Nothing
is taken back while Claude is at work, or over a file that has been changed since the
turn, by you in an editor say: the app names the file that is in the way and leaves all
of it as it is. The last twelve turns that changed anything are kept for each project.
What is not the project's own is left out, and left alone: `.git`, `node_modules`, a
Python environment. In a box you are writing in, Cmd+Z is the writing's for as long as
there is any; in an empty one, as the message box is after a message is sent, it is the
model's.

Drag across the view and a box is drawn, which picks out several parts at once: drawn
from left to right, the parts wholly inside it; from right to left, every part it
touches, and its edge is dashed to say so. A box goes by the piece, as a click does: one
that takes in one chip takes the board it is on and all else on that. Shift adds to what
is picked out. With a box it adds what the box takes in; with a click it adds the one
part clicked, or takes it back out if it was already among what is picked out, and on a
part of an object that is picked out it picks out just that part. A second click with
Shift still held, straight after the first, adds all of the object the part belongs to:
that is how one object is picked out together with another. What a box takes in
goes right through the model, so while it is drawn the view shows what it takes in so far
solid and everything else see-through, whatever the shading. Let go, the model is drawn
as it was, and the parts picked out show through whatever is in front of them: veiled in
white where each is, with a line round it. I shows them on their own, as it does one
part. A button at the foot of the view, Add to chat, puts them on the message box, in a
row of chips that scrolls sideways, and opens the conversation to go on from there. It
goes by the object, as picking does. A whole object among what is picked out is one
chip, however many parts it is made of, and the button counts those as groups: Add 2
groups to chat. It goes to Claude as one thing, with what it is called and which parts
it is, and what you write is taken as said of it; where you mean only some part of it
(the cap of a button), say so in your own words and Claude finds the part. The parts
picked out for themselves are a chip each, and go to Claude by name, ahead of what you
write, as if you had written them with @. A message that was sent shows the objects it
was about over what it said. Click where there is nothing to let go of what is picked
out; Esc drops a box that is still being drawn.

A message can call on things by name. Write @ and a list of the model's parts comes up
over the box: the arrow keys move through it, and Enter or Tab puts the part in, by its
id. While the list is up the view shows where each part is: the one the list is on is
drawn solid and everything else see-through, whatever the shading, and the view goes
back to how it was when the list goes. $ does the same for the skills of the Claude
Code on your machine (your own, the project's, a plugin's), and Claude loads the skill
you name before it starts on the work. A message that begins with / is a command: any
that you, the project or a plugin have given Claude Code, and three of its own that mean
something here (compact, context and usage). Esc puts the list away.

A message can take pictures with it: a photo of the thing to make, a sketch, a drawing
with its sizes on it. Paste one into the message box, drop it on the window, or pick it
with the paperclip beside the send button. Each shows small over what you write, with a
cross that takes it back off; click one to see it big. A picture that is pasted also
leaves its mark where the caret was, [Image 1], so that the words can say which picture
they mean ("the body of [Image 1] with the knob of [Image 2]"), and Backspace at the
mark takes the picture with it. One message takes eight, and one too big for an agent is
made smaller first. Claude gets each picture under its name, ahead of the words. It is
told to make what a picture shows, part by part and in its proportions, to take sizes
from what is written on it or said with it and not from how it looks, and to set a
screenshot of what it built beside the picture before it reports. A message that was
sent shows its pictures over what it said. They are kept with the app's own state, not
in the project's folder, for as long as the project is on the list. Codex takes pictures
the same way. Grok cannot see them: it gets your words, and the conversation says so.

Under the message, one line says how it will be answered: "Using Opus 5.5, High, Full
access". Click it for the three choices behind it: which of Claude Code's models answers,
how hard it thinks, and what it may do without asking. The models are the ones your
Claude Code offers; "Default" leaves the model, and how hard it thinks, as Claude Code is
set.
Claude starts out with full access and never asks leave. It can be made to ask before it
changes a file or runs anything ("Supervised"), to edit files freely and ask before
anything else ("Auto-accept edits"), or to do what is routine and ask about the rest
("Auto").

**Settings** (the gear at the bottom left, or Cmd+,) hold where new projects go, how much
Claude asks before it acts, the theme, how a scroll is read and how fast the view turns,
and a list of every shortcut.

## Where things are

```
electron/    the app's own process: window, project list, the line to Claude
examples/    projects to open and try things on: a table clock, with a tool, a
             counter stool, to see beside a person, a clip lamp on a wall shelf,
             with its wire, and an open-source robot arm, read from its CAD file
             and steered by a tool
icons/       the app's icon, in the sizes each system asks for
kit/         the exporter a project copies in to write its model (Python), the
             screws it can put in one, the app's own reference scenes, each drawn in
             code and kept as built, the figure of a person that stands in some
             of them, and how a project's own tools are written
shared/      types and the manifest format, used by both sides, and the list of
             examples
src/         the window: project cards, 3D view and its tools, conversation
scripts/     dev loop, production build, the icon's sizes, the reference scenes,
             and the examples' archives
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
- Of CAD files it opens only STEP. Meshes (STL, OBJ, 3MF) are not brought in: they could
  be shown, but there is no solid in them for Claude to change.
- Only tried on macOS.
- No way to answer Claude's multiple-choice questions (it asks in plain text instead).
- A section shows the cut as hollow shells; cut faces are not filled in.

## Contributing

Fixes and ideas are welcome: [CONTRIBUTING.md](CONTRIBUTING.md) says how.

## License

Copyright (C) 2026 Gláuber Sampaio

Enclose is free software: you can redistribute it and/or modify it under the terms of
the GNU Affero General Public License, version 3, as published by the Free Software
Foundation. It is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. The whole of it is in [LICENSE](LICENSE).

In short: use it, change it and pass it on, for anything. Whatever you pass on, or run
as a service for others, goes with its full source and under this same license, your
changes included.

Additional permission under GNU AGPL version 3 section 7: if you modify this Program,
or any covered work, by linking or combining it with the Claude Agent SDK
(`@anthropic-ai/claude-agent-sdk`), or a modified version of that library, containing
parts covered by the terms of that library's own license, the licensors of this Program
grant you additional permission to convey the resulting work.

The name Enclose and its mark are not licensed with the code. A fork goes by a name and
a mark of its own.

Some of what is here came from others, and stays under their terms:

- [`src/components/ui`](src/components/ui) began as [shadcn/ui](https://ui.shadcn.com)'s
  components (MIT).
- [`examples/arm/source`](examples/arm/source) is the SO-101 arm's own CAD file, by
  TheRobotStudio (Apache 2.0): its [README](examples/arm/source/README.md) says more.
- The figure of a person that stands in the reference scenes is made from Blender
  Studio's Human Base Meshes (CC0): [`kit/figure`](kit/figure) says how.
