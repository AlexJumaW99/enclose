"""A desk, for a model that stands on one to be seen on: a sit-stand table 58 inches
wide and 29 deep, at the height it is sat at. A man 5 feet 9 tall can be stood at the
far side of it, facing across it.

This is one of Enclose's own reference scenes. Copied into a project as reference.py,
beside the project's enclose.py and with person.glb beside it too, it is that project's
scene to change: run it, and the app shows what it wrote in place of this.
"""

from build123d import Axis, Box, Cylinder, Pos, chamfer, fillet

from enclose import Reference

INCH = 25.4
WIDTH, DEPTH = 58 * INCH, 29 * INCH
# it goes from 27 inches to 46: this is where it is sat at
HEIGHT = 29 * INCH

# the top: a slab with round corners, cut back underneath so that its edge looks thin
THICK = 26
top = Box(WIDTH, DEPTH, THICK)
top = fillet(top.edges().filter_by(Axis.Z), 70)
top = chamfer(top.edges().group_by(Axis.Z)[0], 14)
top = fillet(top.edges().group_by(Axis.Z)[-1], 2)
top = Pos(0, 0, HEIGHT - THICK / 2) * top

# under it, a rail from leg to leg and an arm across the top of each
RAIL = 30
UNDER = HEIGHT - THICK
# how far in from the ends the legs stand, and how far back of the middle
INSET, BACK = 200, 40
LEGS = (-(WIDTH / 2 - INSET), WIDTH / 2 - INSET)
frame = Pos(0, BACK, UNDER - RAIL / 2) * Box(LEGS[1] - LEGS[0], 50, RAIL)
for x in LEGS:
    frame += Pos(x, 0, UNDER - RAIL / 2) * Box(64, 520, RAIL)

# each leg a column in two lengths, the upper sliding over the lower, on a long foot
FOOT_LONG, FOOT_WIDE, FOOT_HIGH, GLIDE = 700, 78, 30, 8
SLEEVE = 200
legs = None
for x in LEGS:
    foot = Box(FOOT_WIDE, FOOT_LONG, FOOT_HIGH)
    foot = chamfer(foot.edges().group_by(Axis.Z)[-1], 6)
    leg = Pos(x, 0, GLIDE + FOOT_HIGH / 2) * foot
    standing = GLIDE + FOOT_HIGH
    column = UNDER - RAIL - standing
    leg += Pos(x, BACK, standing + (column - SLEEVE) / 2) * Box(
        50, 80, column - SLEEVE
    )
    leg += Pos(x, BACK, UNDER - RAIL - SLEEVE / 2) * Box(60, 90, SLEEVE)
    for y in (-(FOOT_LONG / 2 - 45), FOOT_LONG / 2 - 45):
        leg += Pos(x, y, GLIDE / 2) * Cylinder(16, GLIDE)
    legs = leg if legs is None else legs + leg

scene = Reference(
    "Table",
    detail="29″ × 58″",
    # a model stands in the middle of the top
    stand=(0, 0, HEIGHT),
    # (how the app chooses among its own scenes: a project's own has no use for these)
    suits="a thing that stands on a desk or a table, or is held in the hand",
    up_to=(1000, 600, 700),
)
scene.part("top", top)
scene.part("frame", frame)
scene.part("legs", legs)
# The figure of a person comes ready made (see kit/figure), and is there to be shown
# or not. He stands at the far side of the desk, as at a desk he is working at, and
# faces across it to the front: his toes, which are this far in front of where he
# stands, this far short of its edge.
TOES, SHORT = 170, 120
scene.mesh("person", "person.glb", at=(0, DEPTH / 2 + SHORT + TOES, 0), figure=True)
scene.write()
