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
    scripts/   dev loop, production build, the installer, the icon's sizes, the
               reference scenes, and the examples' archives
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
two folders up from itself. Installed, it has the kit among its own resources and no
examples: those it fetches.

## What is built from what

| Command | What it makes |
|---|---|
| `npm run icons` | The icon's other sizes, from `icons/icon.png` |
| `npm run scenes` | The app's reference scenes, from [`kit/scenes`](../kit/scenes) |
| `npm run examples` | The examples' archives, from [`examples/`](../examples) |
| `npm run dist` | The app to install, a disk image for each kind of Mac, in `release/` |

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

### The installer

`npm run dist` builds the app, makes `Enclose.app` of it with
[electron-builder](https://www.electron.build), and of that a disk image for Apple
silicon and one for Intel: `release/Enclose-<version>-arm64.dmg` and `-x64.dmg`. It needs
a Mac. [`scripts/dist.mjs`](../apps/desktop/scripts/dist.mjs) says what goes in, and two
things follow from it:

- What the Electron side loads as it runs is a `dependency` in `package.json`, and goes
  into the app as it is. What the window is made of is bundled by Vite, and is a
  `devDependency`, React among them. A package the Electron side imports has to be a
  dependency, or the installed app does not start.
- The kit goes in as files, beside the app's own archive
  (`Enclose.app/Contents/Resources/kit`), where Python and an agent can read it.

A Mac opens an app that was downloaded only if it is signed by a developer Apple knows
and has been notarized, which is Apple looking it over. The script signs with the
"Developer ID Application" certificate it finds in the keychain, and has the app
notarized when it is told with what:

```
APPLE_KEYCHAIN_PROFILE=<profile> npm run dist
```

The profile is one that `xcrun notarytool store-credentials <profile>` has kept. With
none, the app is made all the same and runs on the Mac that made it, which is enough to
try the installed app out.

### A release

1. Give `package.json` the new version, and commit.
2. `APPLE_KEYCHAIN_PROFILE=<profile> npm run dist`
3. See that a Mac will take it. `spctl -a -t exec -vv release/mac-arm64/Enclose.app`
   answers `accepted`, from `Notarized Developer ID`.
4. Tag the commit and publish the two disk images with it:

   ```
   git tag v<version> && git push origin v<version>
   gh release create v<version> release/Enclose-<version>-*.dmg --title "Enclose <version>" --generate-notes
   ```

The README sends people to the repository's latest release, which has to be the app's:
the examples' release is made with `--latest=false`.

## Formats a project is read by

- The model manifest:
  [`shared/manifest-format.ts`](../apps/desktop/shared/manifest-format.ts).
- A project's own tool: [`kit/tools.md`](../kit/tools.md).
- The exporter a project copies in: [`kit/enclose.py`](../kit/enclose.py).
