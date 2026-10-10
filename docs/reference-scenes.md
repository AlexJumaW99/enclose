# Reference scenes

**Reference** (Cmd+/) sets the model among things of a known real size, so that how big
it is can be seen. A model fills the view whatever size it is, and it is easy to take
one for bigger than it will be in the hand.

## The scenes

The key sets the model in the scene that suits it, at once, and again takes it back out.

| Scene | For | What is in it |
|---|---|---|
| Desk | A thing small enough to stand on one | A desk 58 inches by 29, with the model in the middle of its top |
| Room | A thing that stands on the floor | An empty room 12 feet by 10, with a doorway in the far wall |
| Person | A thing too big for a room | A man 5 feet 9 tall, standing beside it |

Which of them suits is for whoever builds the model to say, by where the thing is used:
Claude is told to, with `reference="room"` in the model's script (`"reference"` in a
manifest written some other way). Where nothing is said it goes by size, and a model too
big for the desk is shown in the room, and one too big for the room beside the person.

The button brings up the list of scenes, each with a picture, its name and its sizes:
pick one and the model is set in it, and it is the scene for that project from then on;
pick the one the model is in and the model is taken out.

## How a scene is drawn

A scene is drawn to be looked past: flat, all in one tone a little lighter than the view
behind it (darker, in the light theme), with a thin line round each thing in it and
along its edges, and nothing of it can be picked. The grid, if it is on, is ruled on the
scene's floor. The walls of a room are seen from inside it and seen through from
outside, so that none is ever in front of the model. Pulled apart, the model comes apart
over the scene, which goes down as far as the model's lowest part does.

The camera goes to the view a model opens with, from above and in front, to take all of
the scene in, whichever side the model was being looked at from; and when the model is
taken out it goes back to where it was, unless the view was turned meanwhile. Cmd+1 and
the set views frame the scene with the model for as long as it is there.

The camera keeps above the ground the scene stands on, as an eye would: it goes down
round the model as far as that ground and stops, and the view from underneath (Cmd+5) is
not to be had until the model is taken out.

## The person at the desk

The desk has the same man to show, the measure everyone has: a button at the foot of the
view, with a figure on it, stands him at the far side of the desk, facing across it, and
takes him away again. He is there once he is asked for, in whatever project is open, and
the camera stands back for him as it does for a scene.

## An example

[`examples/stool`](../examples/stool) is a project to try it on: a counter stool, drawn
to the sizes it is sold by, whose model asks to be seen beside the person. Open the
folder as a project and press Cmd+/.

## A scene of the project's own

Nobody is kept to the app's scenes. With the model set in one, a button at the foot of
the view, **Improve reference scene in chat**, puts the scene on the message box as a
chip and opens the conversation. What is written then is about the scene and not the
model, and Claude changes it: a workbench in place of the desk, the shelf the thing is
to stand on.

What comes of that is the project's own scene, kept in its folder and built the way its
model is: a `reference.py` hands shapes to the exporter
([`kit/enclose.py`](../kit/enclose.py)), which writes `reference/enclose.reference.json`
and the meshes beside it. The app shows that scene for the project from then on, first
in the list, and loads it again whenever it is rewritten. (An `enclose.json` can say
where it is: `"reference": "path/to/enclose.reference.json"`.)

A scene can hold a mesh that comes ready made as well (`Reference.mesh`), which is how
the figure of a person gets into one: it is not built in a script but is a file, made
from Blender Studio's public-domain body meshes ([`kit/figure`](../kit/figure)).

The app's own scenes are written the same way, in [`kit/scenes`](../kit/scenes), and are
what Claude starts from; `npm run scenes` builds them again after a change, with a
Python that has build123d.
