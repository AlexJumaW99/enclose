# Parts and groups

## The list of parts

**Parts** (P) lists what the model is made of: a card for each group the model puts its
parts in, and in it a row of the group's parts, each a picture with its name and the
size of its STEP file. A row with more parts than fit scrolls sideways.

Pick a part or a group and the view shows it on its own, with the camera brought to it,
in the middle of what the list leaves of the view; pick it again and the rest comes
back, and the camera goes back to where it was. (A group is picked by a click on its
card, anywhere but on its name.) Esc, or a press anywhere else, puts the list away and
leaves what you picked showing, and the button stays lit while it is.

A part put out of sight with H is dim in the list, as is a group all of whose parts are,
and picking it there brings it back; the button stays lit while anything is out of
sight.

## Saving STEP

- **Download STEP**, at the top of the right-hand edge, saves the whole model as one
  STEP file, with every part in its place; its tooltip says how big the file is.
- The arrow that comes up beside a part's name, in the list, saves that part as STEP.
- The arrow beside a group's name saves the STEP files of all its parts, in a folder
  named after the group, inside one you choose.

## Changing the groups by hand

Several parts are picked in the list as in any list, and shown together: hold Cmd and
click parts to add them one by one (or take one back out), or click one and hold Shift
on another for every part from the one to the other, across groups. Hold either key and
click a group's card for the whole group, which is how two groups are picked to be made
one. Or pick parts out in the view.

| | |
|---|---|
| Cmd+G | Makes a group of what is picked, which goes to the top of the list. Claude is asked what to call it: the card glimmers while the name is on its way |
| Shift+Cmd+G | Takes them out of their groups, to be listed last as in none. With a whole group picked, by a click on its card, that is the end of the group |
| Click a group's name | Write another over it. Enter keeps it, Esc does not, and nothing written gives back the name it had |
| Cmd+Z | Takes any of this back |

It is kept by the app, not in the project's files: Claude is told how you have the parts
when it asks what they are, and is to write the same groups into the model the next time
it changes it. Should a build put a part in some other group, or call a group something
else, the build is what is shown.

## Where the groups come from

Nobody has to arrange the groups by hand. They come from the manifest, which the
project's build writes, and Claude is told that grouping is its job: when it adds or
removes parts it puts each where a person would look for it, and makes a group when none
fits.

## Search

**Search** (Cmd+F) finds parts and groups by name. A box comes up at the top of the
view, and as you type in it the whole model goes see-through but for what goes by the
name, which turns white the way a part does when it is picked out, wherever in the model
it is.

Each thing found has its name on a tag beside it: a part's by the part, and a group's,
with the sign of the parts list on it, by the group. Where they would lie over one
another, the nearest to what you typed are the ones shown, and turning the view makes
room for others. Click a tag and what it names is shown on its own, with the camera
brought to it, as I does with what is picked out; Enter does the same with all that was
found. Esc, the cross in the box or the button again puts the box away and leaves the
view as it was.

All of the model is looked through, whatever the view was cut down to and whatever was
put out of sight. While the box is up nothing is picked out, and what you type goes into
it wherever the pointer has been since, so the view can be turned between one letter and
the next; a click on a part picks it out as ever, and that is the end of the search.
