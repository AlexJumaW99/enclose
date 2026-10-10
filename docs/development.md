# Working on Enclose

[CONTRIBUTING.md](../CONTRIBUTING.md) says what to ask before you start and what a pull
request needs.

## Running it

You need Node 22 or newer. macOS is the only system it has been tried on. The app is in
[`apps/desktop`](../apps/desktop), and every command here is run from there.

```
cd apps/desktop
npm install
npm run dev                      # open the app
npm run dev -- path/to/project   # ...with that folder, or STEP file, opened as a project
```

`npm run build && npm start` runs the production build instead of the dev loop.

## Checks

```
npm run typecheck
npm run lint
npm test
npm run format      # .ts and .tsx only
```

## Where things are

```
apps/
  desktop/     the app
    electron/  its own process: window, project list, the line to Claude
    src/       the window: project cards, 3D view and its tools, conversation
    shared/    types and the manifest format, used by both sides, and the list of
               examples
    scripts/   dev loop, production build, the icon's sizes, the reference scenes,
               and the examples' archives
    icons/     the app's icon, in the sizes each system asks for
docs/          how the app works, a page to a subject
examples/      projects to open and try things on: a table clock, with a tool, a
               counter stool, to see beside a person, a clip lamp on a wall shelf,
               with its wire, and an open-source robot arm, read from its CAD file
               and steered by a tool
kit/           the exporter a project copies in to write its model (Python), the
               screws it can put in one, the app's own reference scenes, each drawn
               in code and kept as built, the figure of a person that stands in some
               of them, and how a project's own tools are written
spikes/        experiments kept for their measurements
```

Run from a checkout, the app finds `kit/` and `examples/` at the top of the repository,
two folders up from itself.

## What is built from what

| Command | What it makes |
|---|---|
| `npm run icons` | The icon's other sizes, from `icons/icon.png` |
| `npm run scenes` | The app's reference scenes, from [`kit/scenes`](../kit/scenes) |
| `npm run examples` | The examples' archives, from [`examples/`](../examples) |

### The icon

The icon is drawn once, as [`icons/icon.png`](../apps/desktop/icons/icon.png): 1024 pixels across, on
Apple's grid, with the margin a Mac wants round the tile. `npm run icons` makes the rest
from it: `icon.icns` for macOS, and for Windows and Linux, where an icon fills its
square, `icon.ico` and `icon-512.png` with the margin cut away.

### The reference scenes

The app's own [reference scenes](reference-scenes.md) are written the way a project's
are, in [`kit/scenes`](../kit/scenes), and kept as built. `npm run scenes` builds them
again after a change, with a Python that has build123d.

### The examples

The examples are not in the app, which would be six times the size for them. Each is one
archive (`clock.tar.br`: its folder as a tar archive, squeezed with Brotli, which makes
20 MB of the four where the folders are 137), kept with a release of the app's
repository. It is fetched when it is asked for, taken for the example only if it has the
size and the SHA-256 the app was made to expect, and unpacked. Run from a checkout, the
app has the examples in [`examples/`](../examples), at the top of the repository, and
copies one from there instead.

[`shared/examples.json`](../apps/desktop/shared/examples.json) is the list of them. `npm
run examples` packs them again after a change, into `release/examples/`, and writes their
sizes and sums into the list; the archives then go up as a release under a new name (the
list says which), since an app already made goes on fetching the ones it was made with.
`ENCLOSE_EXAMPLES_URL` has them fetched from somewhere else, a folder of them served on
your own machine say.

## Formats a project is read by

- The model manifest:
  [`shared/manifest-format.ts`](../apps/desktop/shared/manifest-format.ts).
- A project's own tool: [`kit/tools.md`](../kit/tools.md).
- The exporter a project copies in: [`kit/enclose.py`](../kit/enclose.py).
