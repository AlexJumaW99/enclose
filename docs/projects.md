# Projects

A project is a folder. Drop one on the window, or use the + under the project cards to
open one (Cmd+O) or to start a new project (Cmd+N). STEP files can be dropped and opened
the same way: see [Starting from CAD files](#starting-from-cad-files).

The cards are in the order the projects were added, the newest at the top. With more of
them than the window has room for, the cards scroll and the + stays where it can be
reached, over the settings button.

## New projects

A new project is given a stand-in name to begin with ("Quiet heron") and a folder to
match, in `~/Documents/Enclose` unless the settings say elsewhere:
`2026-10-05-2336-quiet-heron`, which is when it was made and then the name in lower case
with dashes. Once something has been made in it and Claude has finished, the project
takes the name of its model and its folder is renamed to match:
`2026-10-05-2336-pill-box`. A folder you opened yourself is never renamed.

## Removing a project

The × on a card removes the project from the app. Its folder stays, with everything in
it, but what was said about it is forgotten, which the app asks about first: open the
folder again and it is a new project. The one folder it clears away is one that came to
nothing, which the app made and nothing was put in.

## Starting from nothing

A project can be an empty folder. It opens as any project does, in the viewer, with a
plain cube standing in for the model there is not yet and the conversation open beside
it. Say what you want made and Claude sets it up: it copies the app's exporter,
[`kit/enclose.py`](../kit/enclose.py), into the folder, writes a `model.py` that builds
the parts with [build123d](https://build123d.readthedocs.io) and hands them to it, and
runs it. The exporter writes the meshes, the edges, a STEP file of each part and the
manifest, and the model takes the cube's place as soon as it has. A machine that has
Python but not build123d gets a virtual environment in the folder first.

## Starting from an example

With no projects yet, the window says how one is started and, beside that, shows the
app's examples in a row that scrolls along, each with its picture and how much there is
to download. Click one and a project is made of it where new projects go, yours to
change.

| Example | What it is |
|---|---|
| [Table clock](../examples/clock) | A mechanical movement in a drum case on a stand, with [a tool that sets it and runs it](project-tools.md#examples) |
| [Robot arm](../examples/arm) | The SO-101, an open-source arm, read from its makers' own CAD file, with [a tool that steers it](project-tools.md#examples) |
| [Clip lamp](../examples/lamp) | A clip lamp on a wall shelf, with its wire |
| [Counter stool](../examples/stool) | A counter stool, drawn to the sizes it is sold by, [to see beside a person](reference-scenes.md#an-example) |

The examples are not in the app, to keep it small. Each is
fetched when it is asked for, taken for the example only if it has the size and the
SHA-256 the app was made to expect, and unpacked. Run from a checkout, the app has the
examples in [`examples/`](../examples), at the top of the repository, and copies one
from there instead.
[How they are packed](development.md#the-examples) is with the notes on working on the
app.

## Starting from CAD files

Open a STEP file (`.step`, `.stp`), several at once, or a folder that has some in it,
and the app makes a project of them. It does not work in the folder they came from,
which could be laid out any way at all: it copies the files into a new folder beside its
other projects, named for the file or the folder, and sets that up the way its own
projects are. The copies go in `source/`; a `model.py` reads every body in them as a
part with `read_step`, from the same [`kit/enclose.py`](../kit/enclose.py); and the
build runs by itself, so the model is on screen a few seconds later.

A file that is an assembly gives a part for each component, and a component that is
several solids (how Shapr3D exports its bodies) gives a part for each, under the names
the file has for them. From there it is a project like any other: ask Claude for a
change and it edits `model.py`. What was opened is left as it was.

A folder that already holds a model the app can show, or an `enclose.json`, is a project
as it stands and is opened where it is. So is a folder with no CAD file in it.

The build needs a Python with build123d. Where there is none the project is still made,
with the files in it, and says so: ask Claude to set it up and it makes a virtual
environment in the folder, as it does for a project started from nothing.

### Claude looks the model over

While the files are read and the model is made, the middle of the view says how far
along it is, under the mark, with a bar that fills as it goes. Then Claude looks the model over, while a
light goes across all of its parts and the camera goes slowly round it, from a little
further back than a model opens at; when Claude is through, the view comes in to the
model again.

The app draws it pictures of the model (put together, from the other side, pulled apart,
and each part by itself) and it says what it takes the thing to be, and names and groups
the parts, keeping the names the files gave where they are good ones. That is a
conversation of the project's, begun by the app, and it ends with what Claude made of
the model and what it was unsure of.

For this one turn Claude has none of Claude Code's own tools: it can look at the view,
and name and group the parts, which the app writes into `model.py` as a table and
builds. It can change nothing else. It can be stopped, and the settings can turn it off
(General, Opened files); with no agent on the machine it waits until there is one.

## The model manifest

The app looks in the folder for a model manifest: a JSON file listing the parts, the
mesh file of each, and the groups they are listed under. A part is any separate
component: a thing made, bought or fitted on its own. The manifest and its files are
build output; the project's own script writes them. When the manifest is rewritten, the
view reloads and keeps your camera where it was.

The manifest format is in
[`manifest-format.ts`](../apps/desktop/shared/manifest-format.ts). A `enclose.json` at
the top of the project can say where the manifest is and how to build:

```json
{ "model": "viewer/public/model/report.json", "build": "python3 make_enclosure.py" }
```

Without it, the nearest file named `enclose.model.json`, `report.json` or `model.json`
that lists parts is used.
