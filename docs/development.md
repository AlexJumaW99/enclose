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
    installer/ the picture behind the window the installer opens
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
| `npm run icons` | The icon's other sizes, from `icons/icon.png`, and the picture behind the installer's window |
| `npm run scenes` | The app's reference scenes, from [`kit/scenes`](../kit/scenes) |
| `npm run examples` | The examples' archives, from [`examples/`](../examples) |
| `npm run dist` | The app to install, a disk image for each kind of Mac, and what an installed app updates itself from, in `release/` |

### The icon

The icon is drawn once, as [`icons/icon.png`](../apps/desktop/icons/icon.png): 1024 pixels across, on
Apple's grid, with the margin a Mac wants round the tile. `npm run icons` makes the rest
from it: `icon.icns` for macOS, and for Windows and Linux, where an icon fills its
square, `icon.ico` and `icon-512.png` with the margin cut away.

The same command makes the picture behind the window the
[installer](#the-installer) opens, from the drawing of it,
[`installer/background.svg`](../apps/desktop/installer/background.svg): once at a pixel
to the point and once at two.

### The reference scenes

The app's own [reference scenes](reference-scenes.md) are written the way a project's
are, in [`kit/scenes`](../kit/scenes), and kept as built. `npm run scenes` builds them
again after a change, with a Python that has build123d.

### The examples

The examples are not in the app, to keep it small. Each is one
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

`npm run dist` builds the app, makes `Enclose (Alpha).app` of it with
[electron-builder](https://www.electron.build), and of that a disk image for Apple
silicon and one for Intel: `release/Enclose-<version>-arm64.dmg` and `-x64.dmg`. Beside
them it writes what an installed app [updates itself](#updates) from: the app again as a
zip archive for each kind of Mac, and `latest-mac.yml`. It needs a Mac.
[`scripts/dist.mjs`](../apps/desktop/scripts/dist.mjs) says what goes in, and two things
follow from it:

- What the Electron side loads as it runs is a `dependency` in `package.json`, and goes
  into the app as it is. What the window is made of is bundled by Vite, and is a
  `devDependency`, React among them. A package the Electron side imports has to be a
  dependency, or the installed app does not start.
- The kit goes in as files, beside the app's own archive
  (`Enclose (Alpha).app/Contents/Resources/kit`), where Python and an agent can read it.

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

Every command is run from `apps/desktop`.

1. Commit what is to go out, and leave nothing uncommitted. The build takes the files as
   they stand, committed or not, and a release is what its tag says it is.
2. Give the app its new version, in `package.json` and the lock file both, and commit
   that:

   ```
   npm version <version> --no-git-tag-version
   git commit -am "chore: <version>"
   ```

3. `APPLE_KEYCHAIN_PROFILE=<profile> npm run dist`
4. See that a Mac will take it.
   `spctl -a -t exec -vv "release/mac-arm64/Enclose (Alpha).app"` answers `accepted`,
   from `Notarized Developer ID`.
5. Tag the commit, push it with its tag, and publish the two disk images, with what an
   installed app updates itself from:

   ```
   git tag v<version> && git push origin main v<version>
   gh release create v<version> release/Enclose-<version>-*.dmg release/Enclose-<version>-*.zip release/Enclose-<version>-*.zip.blockmap release/latest-mac.yml --title "Enclose <version>" --generate-notes --notes-start-tag v<the version before>
   ```

The README sends people to the repository's latest release, which has to be the app's:
the examples' release is made with `--latest=false`.

### Updates

An installed app looks at the same latest release for a newer version of itself, as it
starts and every four hours after, with
[electron-updater](https://www.electron.build/auto-update). It reads the release's
`latest-mac.yml`, and fetches the zip archive that file names for its kind of Mac once
the user asks for it. So a release without that file is one nobody is offered, and it
has to be the one made by a `npm run dist` for both kinds of Mac: made for one, it names
no archive for the other. The app has to be signed, or a Mac will not put the new
version in. Run from a checkout, the app looks for nothing.

To try an update before there is a release of it, serve what `npm run dist` wrote and
start an installed app that has an earlier version, telling it to look there:

```
python3 -m http.server 8123 --bind 127.0.0.1 --directory release
ENCLOSE_UPDATES_URL=http://127.0.0.1:8123/ "/Applications/Enclose (Alpha).app/Contents/MacOS/Enclose (Alpha)"
```

[`electron/update.ts`](../apps/desktop/electron/update.ts) keeps where an update is, for
the window to show.

## Usage data

An installed app counts how it is used and sends that to PostHog:
[usage-data.md](usage-data.md) tells the people who use it what is sent. Run from a
checkout it counts nothing, unless it is told which PostHog project to send to, which is
how a change to this is tried out:

```
ENCLOSE_ANALYTICS_KEY=<project key> npm run dev
```

[`electron/analytics.ts`](../apps/desktop/electron/analytics.ts) has the project an
installed app sends to, and does the sending. What is counted is recorded in
[`electron/main.ts`](../apps/desktop/electron/main.ts), each thing where it happens. An
event says nothing of a project or a message, and one that is added is added to
usage-data.md with it.

## Formats a project is read by

- The model manifest:
  [`shared/manifest-format.ts`](../apps/desktop/shared/manifest-format.ts).
- A project's own tool: [`kit/tools.md`](../kit/tools.md).
- The exporter a project copies in: [`kit/enclose.py`](../kit/enclose.py).
