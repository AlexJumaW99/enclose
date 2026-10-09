"""A counter stool, to show how big a thing is beside a person: Reference (Cmd+/) stands
it next to a man 5 feet 9 tall.

It is drawn after the Rey counter stool (Bruno Rey, 1971), to the sizes it is sold by:
35½ inches high, 17¾ wide and 19¼ deep, with the seat 25¾ off the floor. The rest is
measured off photographs of one.

A round seat stands between four legs, one on each diagonal. The two at the back go on
up into a backrest, bent round behind the seat. Lower down a steel ring to rest the feet
on is bolted through all four.

Up at the seat no screw goes into a leg. A cast bracket is screwed up under the
seat for each leg, and a plate is glued into the leg's inner face. The bracket's nose goes
in through a slot in the plate and is lifted, so that a hook on it stands up behind the
plate, and a plastic key pushed into the slot under the nose keeps it there. That is a
fitting that would hold, drawn to look as the real one does from outside: how the real
one locks is not to be seen in a photograph. The screws are out of the app's own library
(kit/screws.py), in holes cut to fit them.
"""

import math
import os
import sys

from build123d import (
    Axis,
    Box,
    Circle,
    Cylinder,
    Face,
    GeomType,
    Line,
    Polygon,
    Pos,
    Rectangle,
    Rot,
    ThreePointArc,
    Torus,
    Wire,
    chamfer,
    extrude,
    fillet,
)

# the app's exporter and its screws, which a project of your own keeps copies of beside
# its model.py
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))
from enclose import Model  # noqa: E402
from screws import Screw  # noqa: E402

# The stool faces the front (-Y), and its backrest is behind it (+Y).

# --- the sizes it is sold by (mm) -------------------------------------------------------
INCH = 25.4
HEIGHT = 35.5 * INCH  # the floor to the top of the backrest
WIDTH = 17.75 * INCH  # across the seat, which is the widest of it
DEPTH = 19.25 * INCH  # the front of the seat to the back of the backrest
SEAT_HIGH = 25.75 * INCH  # the floor to the top of the seat, and of the front legs

# --- the legs, and where they stand -----------------------------------------------------
CLEAR = 1.0  # between the seat and a leg
LEG_WIDE = 58.0
# the backrest is as thick as a leg, and it is what the depth is measured to
LEG_THICK = DEPTH - WIDTH - CLEAR
# a leg's faces are bent round the seat, as the backrest is: this far out, in and out
INSIDE = WIDTH / 2 + CLEAR
OUTSIDE = INSIDE + LEG_THICK
EDGE = 7.0  # how round the wood's edges are
GLIDE = 8.0  # the plastic foot under each leg
FRONT, BACK = (225, 315), (45, 135)  # where the legs are, in degrees from +X

# --- the backrest -----------------------------------------------------------------------
SEAM = 770.0  # where a back leg ends and the backrest is set on it
BAND = 88.0  # how tall the backrest is, behind the back
INNER, OUTER = 40.0, 60.0  # how round its corners are, under it and over it

# --- the seat ---------------------------------------------------------------------------
CUSHION, BOARD = 38.0, 16.0  # how thick each is
BOARD_IN = 16.0  # how far the board under the cushion stops short of its edge
UNDER = SEAT_HIGH - CUSHION - BOARD  # the underside of the seat

# --- what holds a leg to the seat: heights are down from the underside of the seat ------
PLATE_WIDE, PLATE_THICK = 26.0, 4.0
PLATE_TOP, PLATE_LOW = 30.0, 110.0
POCKET = 16.0  # how deep a leg is cut, for the plate and for what goes in behind it
SLOT_WIDE = 12.0
SLOT_TOP, SLOT_LOW = 40.0, 74.0
NOSE = 54.0  # the underside of the bracket's nose, which the key comes up to
HOOK = 7.0  # how far the hook stands up behind the plate
ARM_WIDE, REACH = 24.0, 95.0  # the bracket's arm, and how far in under the seat it goes
FOOT = 78.0  # where the key ends, down the leg
# two screws hold a bracket up under the seat board, their heads let into the arm
SEAT_SCREW = Screw("M4", 16, "countersunk")
SEAT_SCREWED = [
    Pos(INSIDE - REACH + along_arm, 0, UNDER - 7) * Rot(180, 0, 0) for along_arm in (12, 40)
]

# --- the ring the feet rest on ----------------------------------------------------------
RING_HIGH = 235.0
TUBE = 16.0
RING_OUT = 217.0  # the outside of the ring, from the middle
# what holds it to a leg: driven in from outside, its head flush with the wood. It is
# placed once, out along +X, and the same placing cuts the holes for it
BOLT = Screw("M6", 50, "countersunk")
BOLTED = Pos(OUTSIDE, 0, RING_HIGH) * Rot(0, 90, 0)


def turned(shape, degrees: float):
    """What is drawn out along +X, put on the diagonal it belongs to."""
    return Rot(0, 0, degrees) * shape


def section(wide: float, inside: float, outside: float):
    """A leg seen from above, out along +X: its two faces bent round the seat."""
    across = Pos((inside + outside) / 2, 0) * Rectangle(outside - inside + 20, wide)
    return (Circle(outside) - Circle(inside)) & across


def leg(top: float, round_top: bool):
    shape = extrude(section(LEG_WIDE, INSIDE, OUTSIDE), top - GLIDE)
    shape = fillet(shape.edges().filter_by(Axis.Z), EDGE)
    above = shape.edges().group_by(Axis.Z)[-1]
    # a front leg ends in the open; a back one in a fine groove, where the backrest is set on
    shape = fillet(above, 5) if round_top else chamfer(above, 1)
    # cut for the bolt of the ring, and for the plate the bracket hooks into
    return Pos(0, 0, GLIDE) * shape - BOLTED * BOLT.hole() - pill(INSIDE + POCKET)


def along(radius: float, near: float, far: float, high: float = RING_HIGH):
    """A round bar lying along +X, from this far out to this far, at the ring's height."""
    return Pos((near + far) / 2, 0, high) * Rot(0, 90, 0) * Cylinder(radius, far - near)


def glide():
    shape = extrude(section(LEG_WIDE - 8, INSIDE + 4, OUTSIDE - 4), GLIDE)
    return fillet(shape.edges().filter_by(Axis.Z), EDGE - 3)


def backrest():
    """Both back legs carried on up, and joined by a band bent round behind the seat."""
    ring = Circle(OUTSIDE) - Circle(INSIDE)
    far = 2 * OUTSIDE
    posts = [
        Rot(0, 0, at) * Pos(far / 2, 0) * Rectangle(far, LEG_WIDE) for at in BACK
    ]
    between = Polygon(
        (0, 0),
        *[(far * math.cos(math.radians(at)), far * math.sin(math.radians(at))) for at in BACK],
        align=None,
    )
    shape = Pos(0, 0, SEAM) * extrude(ring & (between + posts[0] + posts[1]), HEIGHT - SEAM)
    # open under the band, between the two legs
    wider = Circle(OUTSIDE + 5) - Circle(INSIDE - 5)
    shape -= Pos(0, 0, SEAM - 1) * extrude(
        wider & (between - posts[0] - posts[1]), HEIGHT - BAND - SEAM + 1
    )

    def level(at: float):
        """Its straight edges at this height: the ones that go across it, front to back."""
        return [
            edge
            for edge in shape.edges().filter_by(GeomType.LINE)
            if all(abs(vertex.Z - at) < 0.01 for vertex in edge.vertices())
        ]

    shape = fillet(level(HEIGHT - BAND), INNER)
    shape = fillet(level(HEIGHT), OUTER)
    # every edge of it round, as a leg's are, but where it is set on the legs
    foot = shape.edges().group_by(Axis.Z)[0]
    shape = fillet([edge for edge in shape.edges() if edge not in foot], EDGE)
    return chamfer(shape.edges().group_by(Axis.Z)[0], 1)


def block(near: float, far: float, wide: float, top: float, low: float):
    """A block out along +X, from this far out to this far, between two heights below
    the seat."""
    return Pos((near + far) / 2, 0, UNDER - (top + low) / 2) * Box(far - near, wide, low - top)


def pill(far: float):
    """The plate's outline, as deep into the leg as this."""
    shape = block(INSIDE - 2, far, PLATE_WIDE, PLATE_TOP, PLATE_LOW)
    return fillet(shape.edges().filter_by(Axis.X), PLATE_WIDE / 2 - 0.1)


def within():
    """All that is nearer the middle than a leg's inner face, which is bent."""
    return Cylinder(INSIDE, 4 * HEIGHT)


def plate():
    """The plate let into a leg, out along +X: flush with the leg's face, with a slot
    for the bracket's nose and the key under it."""
    slot = block(INSIDE - 3, INSIDE + POCKET, SLOT_WIDE, SLOT_TOP, SLOT_LOW)
    return pill(INSIDE + PLATE_THICK) - within() - slot


def casting():
    """The bracket and its key in one, seen from the side: they are cast apart, but
    their outsides are one sweep from under the seat down to the leg."""
    corner = (INSIDE, 0, UNDER)
    tip = (INSIDE - REACH, 0, UNDER)
    under_tip = (INSIDE - REACH, 0, UNDER - 8)
    foot = (INSIDE - 3, 0, UNDER - FOOT)
    # hollowed underneath, so that it springs from the leg like a branch
    across, down = foot[0] - under_tip[0], foot[2] - under_tip[2]
    long = math.hypot(across, down)
    hollow = (
        (under_tip[0] + foot[0]) / 2 - 12 * down / long,
        0,
        (under_tip[2] + foot[2]) / 2 + 12 * across / long,
    )
    outline = Wire(
        [
            Line(corner, tip),
            Line(tip, under_tip),
            ThreePointArc(under_tip, hollow, foot),
            Line(foot, (INSIDE, 0, foot[2])),
            Line((INSIDE, 0, foot[2]), corner),
        ]
    )
    shape = extrude(Face(outline), ARM_WIDE / 2, both=True)
    # its long edges round, as a casting's are: those down either side, but at the leg
    sides = [
        edge
        for edge in shape.edges()
        if len({round(vertex.Y, 2) for vertex in edge.vertices()}) == 1
        and not all(abs(vertex.X - INSIDE) < 4 for vertex in edge.vertices())
    ]
    return fillet(sides, 3.5)


def bracket():
    """What holds a leg to the seat, out along +X: an arm screwed up under the seat,
    with a nose that goes through the plate in the leg and a hook that stands up behind
    it."""
    arm = casting() & block(INSIDE - REACH - 5, INSIDE + 5, ARM_WIDE + 2, -5, NOSE)
    # open in the corner between seat and leg
    arm -= Pos(INSIDE - 6, 0, UNDER - 6) * Rot(90, 0, 0) * Cylinder(9.5, 2 * ARM_WIDE)
    arm &= within()
    nose = block(INSIDE - 2, INSIDE + POCKET - 2, SLOT_WIDE, SLOT_TOP, NOSE)
    hook = block(INSIDE + PLATE_THICK, INSIDE + POCKET - 2, SLOT_WIDE, SLOT_TOP - HOOK, SLOT_TOP)
    shape = arm + nose + hook
    for at in SEAT_SCREWED:
        shape -= at * SEAT_SCREW.hole(sunk=40)
    return shape


def key():
    """What keeps the bracket's hook up behind the plate, out along +X: pushed into the
    slot under the nose, with a head that carries the bracket's sweep on down the leg."""
    head = casting() & block(INSIDE - REACH, INSIDE + 5, ARM_WIDE + 2, NOSE, FOOT + 5)
    return (head & within()) + block(INSIDE - 2, INSIDE + POCKET - 2, SLOT_WIDE, NOSE, SLOT_LOW)


# --- the wood ---------------------------------------------------------------------------
front_legs = [turned(leg(SEAT_HIGH, round_top=True), at) for at in FRONT]
back_legs = [turned(leg(SEAM, round_top=False), at) for at in BACK]
glides = [turned(glide(), at) for at in FRONT + BACK]

# --- the seat ---------------------------------------------------------------------------
board = Pos(0, 0, UNDER + BOARD / 2) * Cylinder(WIDTH / 2 - BOARD_IN, BOARD)
for corner in FRONT + BACK:
    for at in SEAT_SCREWED:
        board -= turned(at * SEAT_SCREW.thread_hole(), corner)
cushion = Cylinder(WIDTH / 2, CUSHION)
cushion = fillet(cushion.edges().group_by(Axis.Z)[-1], 16)
cushion = fillet(cushion.edges().group_by(Axis.Z)[0], 5)
cushion = Pos(0, 0, SEAT_HIGH - CUSHION / 2) * cushion

# --- the metal --------------------------------------------------------------------------
brackets = [turned(bracket(), at) for at in FRONT + BACK]
plates = [turned(plate(), at) for at in FRONT + BACK]
keys = [turned(key(), at) for at in FRONT + BACK]
seat_screws = [
    turned(at * SEAT_SCREW.shape, corner) for corner in FRONT + BACK for at in SEAT_SCREWED
]
bolts = [turned(BOLTED * BOLT.shape, at) for at in FRONT + BACK]

# the ring, with a boss out to each leg for the bolt to screw into
ring = Pos(0, 0, RING_HIGH) * Torus(RING_OUT - TUBE / 2, TUBE / 2)
for at in FRONT + BACK:
    boss = along(7, RING_OUT - TUBE / 2, INSIDE + 5) & Cylinder(INSIDE, 4 * HEIGHT)
    ring += turned(boss, at)
for at in FRONT + BACK:
    ring -= turned(BOLTED * BOLT.thread_hole(), at)

# --- the model --------------------------------------------------------------------------
# it stands on the floor, but is small in a room: a person beside it says more
model = Model("Counter stool", reference="person")
frame = model.group("Frame")
seat = model.group("Seat")
fittings = model.group("Brackets")
footrest = model.group("Footrest")

# what is on a diagonal is called by it, and goes straight out along it when the stool is
# pulled apart
CORNERS = {225: "front left", 315: "front right", 45: "back right", 135: "back left"}


def out(degrees: float, far: float, up: float = 0.0):
    return (far * math.cos(math.radians(degrees)), far * math.sin(math.radians(degrees)), up)


def named(what: str, at: float):
    """An id and a label for one of four: "leg-front-left", "Leg, front left"."""
    return f"{what}-{CORNERS[at]}".lower().replace(" ", "-"), f"{what}, {CORNERS[at]}"


for shape, at in zip(front_legs + back_legs, FRONT + BACK):
    id, label = named("Leg", at)
    model.part(id, shape, label=label, group=frame, color="white", explode=out(at, 70))
model.part("backrest", backrest(), label="Backrest", group=frame, color="white", explode=(0, 42, 70))
for shape, at in zip(glides, FRONT + BACK):
    id, label = named("Glide", at)
    model.part(id, shape, label=label, group=frame, color="lightgrey", explode=out(at, 70, -25))

model.part("cushion", cushion, label="Cushion", group=seat, color="lightgrey", explode=(0, 0, 100))
model.part("board", board, label="Seat board", group=seat, color="white", explode=(0, 0, 50))

# a leg comes away from the seat as it is fitted, the other way about: the key out of
# the slot, the bracket's nose out of the plate
for shape, at in zip(brackets, FRONT + BACK):
    id, label = named("Bracket", at)
    model.part(id, shape, label=label, group=fittings, color="lightgrey", explode=(0, 0, 0))
for shape, at in zip(keys, FRONT + BACK):
    id, label = named("Key", at)
    model.part(id, shape, label=label, group=fittings, color="grey", explode=out(at, 24))
for shape, at in zip(plates, FRONT + BACK):
    id, label = named("Leg plate", at)
    model.part(id, shape, label=label, group=fittings, color="lightgrey", explode=out(at, 48))
model.part(
    "seat-screws",
    seat_screws,
    label=f"Bracket screws, {SEAT_SCREW.size}",
    group=fittings,
    finish="metal",
    explode=(0, 0, -45),
)

model.part("ring", ring, label="Footrest ring", group=footrest, finish="metal", explode=(0, 0, 0))
for shape, at in zip(bolts, FRONT + BACK):
    id, label = named("Bolt", at)
    model.part(
        id,
        shape,
        label=f"{label}, {BOLT.size}",  # "Bolt, front left, M6 × 50"
        group=footrest,
        finish="metal",
        explode=out(at, 120),
    )
model.write()
