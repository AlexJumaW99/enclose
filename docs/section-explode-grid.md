# Section, explode and grid

Three of the buttons down the right-hand edge of the view.

## Section

**Section** (S) cuts the model open. Three squares appear by the axes, one per direction
to cut across, which the X, Y and Z keys choose too; in the view, drag the arrow to push
the cut through the model and the arcs to tilt it. While the pointer is on either, or
has hold of it, a faint square shows where the cut lies and how it is tilted.

Two more buttons appear to the left of this one: one shows the other half, the other
starts the cut again. A cut is kept as it is left: cut open again, the model is cut the
same way, until it is started again. While the model is cut open a tap of Z is the cut
across Z, and holding the key, or flicking with it down, brings up the shading.

Where the cut passes through a solid part it leaves a face in the part's colour, with
lines across it, the way a drawing marks what has been cut through. Where two parts are
in the same place by more than a tenth of a millimetre, the cut shows it in red. (A part
whose surfaces do not close, and anything drawn as glass or by its lines, is left open.)

## Explode

**Explode** (E) pulls the parts apart by the distances the manifest gives (or straight
out from the middle, if it gives none), and a slider along the bottom pulls them
further.

A model that gives its parts no `explode` of their own comes apart by its groups, not
part by part: the parts of a group that touch one another go as one piece, so a circuit
board keeps its components and a switch its pins. The outside (a group marked `shell`)
still comes apart part by part, as do parts in no group and a model that is all one
group.

## Grid

**Grid** (Shift+G, as in Figma) rules the ground into squares and draws the world's
three axes through its origin, in the colours they have in the corner of the view. Both
go on as far as can be seen, however far out the view is taken. The squares are a power
of ten millimetres across, whichever suits how near the view is, with every tenth line
heavier: zoom out and they give way to squares ten times the size. It stays on, or off,
from one model to the next.
