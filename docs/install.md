# Installing Enclose

Enclose is for macOS, 13 (Ventura) or newer.

## What it needs

- [Claude Code](https://code.claude.com/docs/en/overview), installed and signed in.
  Enclose has no login of its own: the conversation is with the Claude Code on your
  machine. Codex or Grok will do in its place: see
  [Other agents](working-with-claude.md#other-agents).
- Python 3. Models are built with Python and
  [build123d](https://build123d.readthedocs.io); where build123d is missing, Claude makes
  a virtual environment for it in the project's folder.

## Download

Take the disk image for your Mac from
[GitHub Releases](https://github.com/enclosedev/enclose/releases/latest):

| Your Mac | The file |
|---|---|
| Apple silicon (M1 and later) | `Enclose-<version>-arm64.dmg` |
| Intel | `Enclose-<version>-x64.dmg` |

About This Mac, in the Apple menu, says which yours is: it names a chip that is Apple's,
or a processor that is Intel's. Open the disk image and drag the app into Applications,
where it is called Enclose (Alpha).

## The first time it is opened

- macOS says that Enclose was downloaded from the internet and asks whether to open it.
  The app is signed and has been checked by Apple, so Open is all there is to it.
- macOS asks whether Enclose may reach your Documents folder. New projects are kept
  there, in `~/Documents/Enclose`, unless the [settings](settings.md) say elsewhere. It
  asks the same of Desktop and Downloads the first time a project or a CAD file is
  opened from one of them.
- With no project yet, start from one of the
  [examples](projects.md#starting-from-an-example): it is downloaded when you pick it.

If a message gets no answer, look at Providers in the [settings](settings.md): it shows
which agents the app found, and takes the path to one it did not find.

## A new version

Enclose does not update itself yet. Download the new disk image and drag the app into
Applications again, in place of the old one. (Version 0.0.1 is called Enclose there, with
no Alpha, and is not replaced: drag it to the Trash.) Your projects and conversations are
not in the app, and stay as they were. About, in the settings, says which version you
have.

## Removing it

Drag Enclose (Alpha) from Applications to the Trash. What it kept of your projects (the
list of them, the conversations and the settings) is in
`~/Library/Application Support/Enclose`. The projects themselves are folders of yours,
and are left where they are.
