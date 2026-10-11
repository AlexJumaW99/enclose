# Keyboard shortcuts

The app has the same list in its settings (Shortcuts), all but the keys for writing. Cmd
is Ctrl off a Mac.

## Views

| | |
|---|---|
| Cmd+1 | The view a model opens with |
| Cmd+2, Cmd+3 | Front, back |
| Cmd+4, Cmd+5 | Top, bottom |
| Cmd+6, Cmd+7 | Right, left |
| Space | What is picked out, close to, from the side the camera is on |

## The model

| | |
|---|---|
| Z | [Shading](view.md#shading) |
| P | [Parts](parts.md) |
| Cmd+G | [Make a group](parts.md#changing-the-groups-by-hand) of what is picked |
| Shift+Cmd+G | Take what is picked out of its groups |
| Shift+G | [Grid](section-explode-grid.md#grid) |
| S | [Section](section-explode-grid.md#section) |
| X, Y, Z | Which way the section cuts, while the model is cut open |
| E | [Explode](section-explode-grid.md#explode): once into pieces, again into every part, and again to put it together |
| Cmd+/ | [Reference scene](reference-scenes.md) |
| I | Show what is picked out [on its own](selecting.md#on-its-own-close-to-out-of-sight) |
| H | Put what is picked out out of sight, or bring everything back |
| B | [Blueprint](blueprints.md) |
| Cmd+F | [Search](parts.md#search) |
| T | [Tools of the project's own](project-tools.md) |
| Cmd+Z | [Take back](working-with-claude.md#taking-a-change-back) the last change to the model |
| Cmd+Shift+Z | Put it back |
| Esc | Close, or step back |

## The app

| | |
|---|---|
| Cmd+B | The conversation |
| Cmd+, | [Settings](settings.md) |
| D | The light theme, or the dark |

## Moving around

| | Trackpad | Mouse |
|---|---|---|
| Orbit | Two fingers | Right drag |
| Zoom | Pinch | Wheel |
| Pan | Shift and two fingers | Shift and right drag |

Holding Ctrl makes any scroll zoom, and any drag with a mouse's right or middle button.
A drag with the middle button zooms by itself. That is how a mouse's buttons come:
[what each does](view.md#a-mouses-buttons) can be set, and the list of shortcuts in the
settings follows what they are set to.

## Picking parts out

| | |
|---|---|
| Click | A part, or the object it belongs to |
| Double click, or Cmd+click | A single part |
| Shift+click | Add a part, or take it back out |
| Shift+double click | Add a whole object |
| Drag to the right | Everything inside the box |
| Drag to the left | Everything the box touches |
| Shift+drag | Add what the box takes in |

## Writing

| | |
|---|---|
| Enter | In the box at a part: keep what you wrote for the next message |
| Cmd+Enter | In the box at a part: send at once, with everything gathered |
| @ | [A part by name](messages.md#parts-skills-and-commands-by-name) |
| $ | A skill by name, where it is Claude that answers |
| / | A command, at the start of a message, where it is Claude that answers |

## What Esc steps back through

Esc puts the search away if it is up, and then the parts list, the list of reference
scenes, or the project's tools. After that it gets back out of the section, the explode,
the blueprint, the reference scene, the tools' hold on the model, whatever is showing on its own and
whatever was put out of sight, one press each, starting with whichever you went into
last.

## When a key does nothing

- While a box is being written in, the plain keys are the writing's: letters, Space,
  Shift+G and Esc. The ones with Cmd still work, and Cmd+Z only in a box that is empty.
- Under a blueprint the keys of the view wait until it is back: Cmd+1 to 7, Space, Z, S,
  X and Y, Shift+G, Cmd+/ and T.
- T is there only in a project with tools of its own, and B and Cmd+F only once there
  is a model. Cmd+B needs a project to be open.
- In a reference scene there is no view from below, so Cmd+5 does nothing.
- No key of the view works with Settings open, or while Claude looks over files that
  were just opened.
