# Settings

The gear at the bottom left, or Cmd+,. They open in a panel over the left of the window,
with the app still to be seen past it. Esc, the cross at the foot of the panel, or a
click on the app puts them away.

| Section | What it holds |
|---|---|
| General | Where new projects are saved, `~/Documents/Enclose` to begin with |
| | Whether Claude [looks over](projects.md#claude-looks-the-model-over) the CAD files you open |
| | How much Claude [may do without asking](working-with-claude.md#model-effort-and-access) |
| | Whether each conversation has [a version of the project](working-with-claude.md#versions) of its own |
| | After how many days a [conversation](working-with-claude.md#conversations) left alone goes under its project's card |
| | What a [blueprint](blueprints.md#exploded-dimensions-and-labels)'s dimensions are in, millimetres or inches |
| | Whether what you [download](parts.md#saving-the-model) has the day before its name: `2026_10_11_table-clock.step` |
| | Whether the app sends [usage data](usage-data.md) |
| Navigation | How a scroll is read (automatic, trackpad or mouse), how fast the view turns and zooms, and whether a wheel zooms the other way round |
| | What the view [turns about](view.md#moving-around) (the middle of the view, the selection or the pointer), and whether turning stops straight above and below |
| | What [a mouse's buttons](view.md#a-mouses-buttons) do, and Shift and Ctrl with them: each by itself, or all as Blender, Fusion, Onshape or SolidWorks has them |
| Shortcuts | [The shortcuts](shortcuts.md), all but the keys for writing |
| Providers | The [agents](working-with-claude.md#other-agents) the app can put a message to, one under another: each says whether it is installed and who is signed in to it, and has a switch for whether it is in use. One that is not installed says, when it is opened, what to type in Terminal to install it, and links to its makers' own page on that; **Check again**, beside the section's name, finds it once it is in |
| | Where there is a newer version of an agent that is switched on, **Update available** stands on its line in place of its version and switch, and the same is offered at the foot of the view. It is updated the way it was installed: by its own updater (`claude update`, `grok update`), by Homebrew, by the npm of the Node it was installed with, or, for Codex, by its installer again. The app looks for newer versions when it opens, every six hours, and on **Check again**: on npm for Claude Code and Codex (for Claude Code from Homebrew, at the stable release Homebrew has), and by asking Grok |
| | Open one for its models: the switch on each is whether the message box offers it, and a star has it come first there |
| | **Show advanced settings**, under the models, has the rest: the binary to run, the arguments and variables it is started with, a model it does not list and, for Claude and Codex, where it keeps its settings and sign-in |
| Connections | **GitHub**: **Connect** backs every project up to [private repositories on your GitHub account](projects.md#history-and-backup). A dialog shows a code to enter on GitHub's site (**Copy code and open GitHub**), where an account can be made on the way, and then asks for Enclose to be installed on the account; Esc or **Cancel** stops. Once connected it says which account, and **Disconnect** forgets it: what is on GitHub stays there |
| Appearance | The theme: the system's, light or dark |
| About | The app's version |
