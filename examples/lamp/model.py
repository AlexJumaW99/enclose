"""A clip lamp on a shelf, with its wire: to show a small thing among bigger ones, and
what is inside it.

The lamp is drawn after HAY's Apex clip lamp, to the sizes it is sold by: 10¾ inches
high, 5½ wide and 3 deep, on a wire 78¾ long (two metres). It is a sheet of metal folded
once along its length, over a bulb, on a stem that clamps to the edge of a shelf. What
is inside is not to be seen in a photograph, so it is drawn as lamps are commonly made,
and so that everything is held by something.

- The clamp is one piece: two jaws and a channel between them. The stem goes through
  both jaws and lies in the channel, where a small screw pinches it: slacken that and
  the shade turns. A screw with a ring to turn it by presses a pad up under the shelf.
- The stem is a tube with a thread on its end. A cup is held on it between a nut and
  the lamp holder, which screws on inside the cup and takes an E27 bulb.
- The shade sits over the cup on two studs welded to its inside, which go through the
  cup and take a nut each: nothing shows on the outside.
- The wire comes up the stem from a bush in its lower end, and has a switch on it and a
  plug at the end. What is left of its two metres lies folded under the shelf.

The shelf is of the kind that hangs on wire ladders, to the sizes one is sold by: 23¼
inches wide and 11⅞ deep, with boards ¾ thick. There are six of them, on ladders two
metres high (78¾ inches), as the tall one in the photographs has. A ladder stands on
one foot, at the front, and is screwed to the wall through the eye at its top, where
the wire of its back rail turns round and comes down again. Each shelf has four clips screwed under
its ends, which hook over a rung. (The boards are sold as 23⅝ wide, which is more than
the whole: they are drawn to fit between the ladders.) The screws, nuts and washers are
out of the app's own library (kit/screws.py), in holes cut to fit them.
"""

import math
import os
import sys

from build123d import (
    Axis,
    Box,
    Circle,
    Cone,
    Cylinder,
    Face,
    FilletPolyline,
    Line,
    Plane,
    Pos,
    Rot,
    Sphere,
    Spline,
    ThreePointArc,
    Torus,
    Wire,
    extrude,
    fillet,
    sweep,
)

# the app's exporter and its screws, which a project of your own keeps copies of beside
# its model.py
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))
from enclose import Model  # noqa: E402
from screws import Nut, Screw, Washer  # noqa: E402

# The shelf faces the front (-Y), with the wall behind it, and stands on the floor, its
# middle over the origin.

INCH = 25.4


def box(x: tuple, y: tuple, z: tuple):
    """A box from here to there, each way."""
    x, y, z = sorted(x), sorted(y), sorted(z)
    return Pos(sum(x) / 2, sum(y) / 2, sum(z) / 2) * Box(x[1] - x[0], y[1] - y[0], z[1] - z[0])


def rod(radius: float, low: float, high: float, at=(0.0, 0.0)):
    """A round bar standing on Z, from this height to this."""
    return Pos(at[0], at[1], (low + high) / 2) * Cylinder(radius, high - low)


def along(path, radius: float):
    """A round wire, bent the way this line goes."""
    start, way = path @ 0, path % 0
    return sweep(Plane(origin=start, z_dir=way) * Circle(radius), path=path)


# --- the shelf (mm) ---------------------------------------------------------------------
HIGH, WIDE, DEEP = 78.75 * INCH, 23.25 * INCH, 11.875 * INCH
BOARD = 0.75 * INCH
ROD, RUNG = 2.5, 2.0  # the radius of a ladder's rails, and of its rungs
STRIP = 1.0  # how thick a clip is
PAIR = 10.0  # the back rail is one wire there and back: this far apart
# Everything of a ladder is said by how far out from the end of a shelf it is.
RUNG_OUT = STRIP + RUNG  # the rungs, and the rails they are welded between
LADDER = RUNG_OUT + PAIR + ROD  # all of a ladder
SHELF_LONG = WIDE - 2 * LADDER
END = SHELF_LONG / 2  # where a shelf ends, either side of the middle
FRONT_RAIL, BACK_RAIL = -DEEP / 2 + ROD, DEEP / 2 - ROD  # the front one, and against the wall
# the rungs: from a hand above the floor to a hand under the top, evenly
LOWEST, HIGHEST, BETWEEN = 195.0, HIGH - 100, 7  # and a shelf on every seventh
SHELVES = 6
RUNGS = [
    LOWEST + (HIGHEST - LOWEST) * n / (BETWEEN * (SHELVES - 1))
    for n in range(BETWEEN * (SHELVES - 1) + 1)
]
HOOKED = 5.0  # how far under the top of a shelf the rung it hangs on is
# the shelves, counted from the floor up: how high the top of each is
SHELF_TOPS = {shelf + 1: RUNGS[shelf * BETWEEN] + HOOKED for shelf in range(SHELVES)}
LAMP_SHELF = 3  # the one the lamp is clamped to
EYE = HIGH - ROD - PAIR / 2  # the middle of the eye at the top of a ladder
BEND = 170.0  # where the back rail leaves the wall and makes for the foot
SHOE = (12.0, 28.0)  # the block the rails end in over the foot: from this high to this
FOOT = 12.5  # the foot's radius
FOOT_AT = -DEEP / 2 + FOOT  # so that it comes no further forward than the shelves

CLIP_WIDE, CLIPS = 12.0, (-DEEP / 2 + 40, DEEP / 2 - 40)  # two at each end of a shelf
CLIP_SCREW = Screw("M3", 10, "button")
CLIP_SCREWED = Pos(-13, 0, -BOARD - STRIP) * Rot(180, 0, 0)  # up through it, into the shelf
WALL_SCREW, WALL_WASHER = Screw("M4", 25, "pan"), Washer("M4")


def ladder(side: int):
    """One of the two ladders the shelves hang on: at the left (-1) or the right (1)."""

    def out(far: float) -> float:
        return side * (END + far)

    inner, outer = out(RUNG_OUT), out(RUNG_OUT + PAIR)
    shape = rod(ROD, SHOE[1] - 6, HIGH, (inner, FRONT_RAIL))
    # the back rail: up from the foot, up the wall, round the eye and down again
    foot = FRONT_RAIL + 12
    rail = Wire(
        [
            *FilletPolyline(
                (inner, foot, SHOE[1] - 4), (inner, BACK_RAIL, BEND), (inner, BACK_RAIL, EYE),
                radius=20,
            ).edges(),
            ThreePointArc(
                (inner, BACK_RAIL, EYE),
                ((inner + outer) / 2, BACK_RAIL, EYE + PAIR / 2),
                (outer, BACK_RAIL, EYE),
            ),
            *FilletPolyline(
                (outer, BACK_RAIL, EYE), (outer, BACK_RAIL, BEND), (outer, foot, SHOE[1] - 4),
                radius=20,
            ).edges(),
        ]
    )
    shape += along(rail, ROD)
    for high in RUNGS:
        shape += Pos(inner, 0, high) * Rot(90, 0, 0) * Cylinder(RUNG, BACK_RAIL - FRONT_RAIL)
    shoe = box((out(0), out(LADDER)), (-DEEP / 2, -DEEP / 2 + 20), SHOE)
    return shape + shoe - rod(3, SHOE[0] - 1, SHOE[0] + 8, (inner, FOOT_AT))


def foot(side: int):
    """What a ladder stands on: it screws up into the shoe, to level the shelf."""
    at = (side * (END + RUNG_OUT), FOOT_AT)
    return rod(FOOT, 0, 6, at) + rod(3, 6, SHOE[0] + 8, at)


def wall_fixing(side: int):
    """The screw that holds the top of a ladder to the wall, through its eye, and the
    washer under its head."""
    middle = side * (END + RUNG_OUT + PAIR / 2)
    face = BACK_RAIL - ROD  # the front of the rail
    turned = Rot(90, 0, 0)  # its head to the front, its thread into the wall
    return [
        Pos(middle, face, EYE) * turned * WALL_WASHER.shape,
        Pos(middle, face - WALL_WASHER.thickness, EYE) * turned * WALL_SCREW.shape,
    ]


def clip():
    """What a shelf hangs by, drawn at the right-hand end of a shelf whose top is at 0:
    a strip screwed under the shelf, which comes up its end and hooks over a rung."""
    rung = -HOOKED
    over = rung + RUNG + STRIP  # the top of the hook
    shape = box((-24, STRIP), (-CLIP_WIDE / 2, CLIP_WIDE / 2), (-BOARD - STRIP, -BOARD))
    shape += box((0, STRIP), (-CLIP_WIDE / 2, CLIP_WIDE / 2), (-BOARD - STRIP, over))
    shape += box((0, 2 * RUNG_OUT), (-CLIP_WIDE / 2, CLIP_WIDE / 2), (over - STRIP, over))
    shape += box((2 * RUNG_OUT - STRIP, 2 * RUNG_OUT), (-CLIP_WIDE / 2, CLIP_WIDE / 2), (rung - 4, over))
    return shape - CLIP_SCREWED * CLIP_SCREW.hole()


def at_end(side: int, y: float, top: float):
    """Where something drawn at the right-hand end of a shelf goes: at either end."""
    return Pos(side * END, y, top) * Rot(0, 0, 0 if side > 0 else 180)


shelves, clips, clip_screws = {}, [], []
for name, top in SHELF_TOPS.items():
    shelf = box((-END, END), (-DEEP / 2, DEEP / 2), (top - BOARD, top))
    shelf = fillet(shelf.edges(), 1.5)
    for side in (-1, 1):
        for y in CLIPS:
            here = at_end(side, y, top)
            clips.append(here * clip())
            clip_screws.append(here * CLIP_SCREWED * CLIP_SCREW.shape)
            shelf -= here * CLIP_SCREWED * CLIP_SCREW.thread_hole()
    shelves[name] = shelf

# --- the lamp ---------------------------------------------------------------------------
# It is drawn where it clamps on: its stem standing on Z through the origin, the top of
# the shelf it is on at 0, and the shelf behind it (+Y). `ON_SHELF` puts it there.
LAMP_HIGH, LAMP_WIDE, LAMP_DEEP = 10.75 * INCH, 5.5 * INCH, 3 * INCH
STEM, BORE = 5.0, 4.0  # the stem's radius, outside and in
SHELF_EDGE = 10.5  # how far behind the stem the edge of the shelf is
ON_SHELF = Pos(-170, -DEEP / 2 - SHELF_EDGE, SHELF_TOPS[LAMP_SHELF])

# the cup at the top of the stem, and the shade folded over it
CUP, CUP_WALL = 23.0, 1.5
SHEET = 1.5  # how thick the shade is
FOLD = 100.0  # the angle between its two wings, in degrees
CORNER = 20.0

# the clamp: a channel the stem lies in, and a jaw across each end of it
CHEEK, ROOM = 4.0, 4.0  # the channel's walls, and the room between one and the stem
HALF = STEM + ROOM + CHEEK  # half its width
FRONT, WEB = -7.0, (6.0, 10.0)  # where its cheeks end, and its floor, behind the stem
JAW, SCREW_JAW = 5.0, 7.0  # how thick the jaws are: on the shelf, and under it
OPEN = 46.0  # between the jaws
REACH = LAMP_DEEP - CUP - SHEET  # how far back they go: the lamp's depth, from the fold
SCREW_AT = 34.0  # where the clamping screw is, behind the stem
LOW = -OPEN - SCREW_JAW  # the underside of the clamp

# its thread is a hexagon screw's, which is threaded all the way: the head is cut off,
# for a ring
CLAMP_SCREW = Screw("M8", 60, "hex")
PAD = 6.0  # the pad it presses up under the shelf
PINCH = Screw("M4", 8, "button")  # what keeps the stem from turning
PINCHED = Pos(HALF, 0, -OPEN / 2) * Rot(0, 90, 0)  # driven in from the right

# up the stem: the lamp's height is from under the clamp to the top of the shade
SHADE_LONG = 147.0
SHADE_HIGH = LOW + LAMP_HIGH
SHADE_LOW = SHADE_HIGH - SHADE_LONG
CUP_LOW, CUP_HIGH = SHADE_LOW - 12, SHADE_LOW + 44  # the cup shows under the shade
STEM_NUT = Nut("M10")
STEM_TOP = CUP_LOW + CUP_WALL + 10  # the stem goes this far into the holder
STUD, STUD_HIGH = 1.5, SHADE_LOW + 8  # the studs' radius, and how high up they are
STUD_NUT = Nut("M3")
STUDS = [-90 - 25, -90 + 25]  # where they are round the cup, in degrees from +X
WIRE = 3.0  # the wire's radius
WIRE_LONG = 78.75 * INCH


def frame():
    """The clamp: one piece, cast."""
    shape = box((-HALF, HALF), (FRONT, WEB[1]), (LOW, JAW))
    shape -= box((-HALF + CHEEK, HALF - CHEEK), (FRONT - 1, WEB[0]), (-OPEN, 0))
    for low, high in ((0, JAW), (LOW, -OPEN)):
        jaw = box((-HALF, HALF), (WEB[1], REACH), (low, high))
        # round at its far end
        shape += fillet(jaw.edges().filter_by(Axis.Z).group_by(Axis.Y)[-1], 9)
    shape -= rod(STEM + 0.1, LOW - 1, JAW + 1)  # the stem goes through both jaws
    shape -= Pos(0, SCREW_AT, LOW) * Rot(180, 0, 0) * CLAMP_SCREW.thread_hole(SCREW_JAW + 1)
    return shape - PINCHED * PINCH.thread_hole()


def clamp_screw():
    """The screw that clamps it on: its thread, with a plain end below for the ring."""
    tip = -BOARD - PAD + 3  # its tip is this far up into the pad
    thread = CLAMP_SCREW.shape - box((-10, 10), (-10, 10), (0, 20))  # no head
    low = tip - CLAMP_SCREW.length
    shape = Pos(0, 0, low) * Rot(180, 0, 0) * thread  # its end up, where the head was down
    end = rod(4, low - 11, low) + Pos(0, 0, low - 11) * Sphere(4)
    end -= Pos(0, 0, low - 6) * Rot(0, 90, 0) * Cylinder(2, 12)  # the ring goes through
    return Pos(0, SCREW_AT, 0) * (shape + end), low - 6


def ring(hole: float):
    """The ring it is turned by, hanging in the hole across the screw's end."""
    across = 11.0
    return Pos(0, SCREW_AT, hole + 0.36 - across) * Rot(90, 0, 0) * Torus(across, 1.5)


def pad():
    """What the screw presses on, so that it does not mark the shelf."""
    shape = rod(11, -BOARD - PAD, -BOARD) - rod(4, -BOARD - PAD - 1, -BOARD - PAD + 3)
    return Pos(0, SCREW_AT, 0) * shape


def stem():
    return rod(STEM, LOW - 4, STEM_TOP) - rod(BORE, LOW - 5, STEM_TOP + 1)


def bush():
    """The bush in the stem's lower end, which the wire goes in by."""
    low = LOW - 4
    return rod(STEM, low - 3, low) + rod(BORE, low, low + 6) - rod(WIRE, low - 4, low + 7)


def radial(shape, degrees: float):
    """What stands on Z at the origin, laid along a line out from the stem at the
    studs' height: its foot at the stem, its top outwards."""
    return Rot(0, 0, degrees) * Pos(0, 0, STUD_HIGH) * Rot(0, 90, 0) * shape


def cup():
    shape = rod(CUP, CUP_LOW, CUP_HIGH) - rod(CUP - CUP_WALL, CUP_LOW + CUP_WALL, CUP_HIGH + 1)
    shape -= rod(STEM, CUP_LOW - 1, CUP_LOW + 5)  # the stem comes in through its floor
    for at in STUDS:
        shape -= radial(rod(STUD + 0.1, CUP - 5, CUP + 1), at)
    return shape


def holder():
    """The lamp holder: it screws on to the end of the stem, and an E27 bulb into it."""
    low = CUP_LOW + CUP_WALL
    neck, skirt = low + 28, CUP_HIGH - 1
    shape = rod(13, low, neck) + rod(20, neck, skirt)
    shape -= rod(STEM, low - 1, STEM_TOP)  # the thread it screws on by
    shape -= rod(BORE, STEM_TOP - 1, STEM_TOP + 10)  # room for the wire's ends
    return shape - rod(13.5, neck + 3, skirt + 1), neck + 3


def bulb(seat: float):
    """A small round bulb (E27, 45 mm across): its cap, and its glass."""
    cap = rod(5, seat, seat + 2) + rod(13.25, seat + 2, seat + 25)
    neck = seat + 25
    glass = Pos(0, 0, neck + 10) * Cone(13.25, 20, 20) + Pos(0, 0, neck + 29.5) * Sphere(22.5)
    return cap, glass


def shade():
    """The shade: a sheet folded along the stem's line, its fold over the cup, with the
    two studs it is held by on its inside."""
    half = math.radians((180 - FOLD) / 2)  # how far round the cup the fold goes, each way
    inside, outside = CUP, CUP + SHEET
    # a wing is as wide as brings the shade to the lamp's width, edge to edge
    wing = (LAMP_WIDE / 2 - outside * math.sin(half)) / math.cos(half)

    def point(radius: float, side: int, along: float = 0.0):
        """A point of its outline: on the fold's end at this side, or along the wing."""
        angle = -math.pi / 2 + side * half
        out, on = (math.cos(angle), math.sin(angle)), (-side * math.sin(angle), side * math.cos(angle))
        return (radius * out[0] + along * on[0], radius * out[1] + along * on[1])

    outline = Wire(
        [
            ThreePointArc(point(inside, -1), (0, -inside), point(inside, 1)),
            Line(point(inside, 1), point(inside, 1, wing)),
            Line(point(inside, 1, wing), point(outside, 1, wing)),
            Line(point(outside, 1, wing), point(outside, 1)),
            ThreePointArc(point(outside, 1), (0, -outside), point(outside, -1)),
            Line(point(outside, -1), point(outside, -1, wing)),
            Line(point(outside, -1, wing), point(inside, -1, wing)),
            Line(point(inside, -1, wing), point(inside, -1)),
        ]
    )
    shape = Pos(0, 0, SHADE_LOW) * extrude(Face(outline), SHADE_LONG, dir=(0, 0, 1))
    # its four corners round: the short edges across the sheet, at the wings' ends
    corners = [edge for edge in shape.edges() if abs(edge.length - SHEET) < 0.01]
    shape = fillet(corners, CORNER)
    for at in STUDS:
        shape += radial(rod(STUD, CUP - 5.6, CUP + 0.5), at)
    return shape


def stud_nuts():
    # a nut's flat is this far in from the cup's wall, which is round
    seat = CUP - CUP_WALL - 0.2
    return [
        Rot(0, 0, at) * Pos(seat, 0, STUD_HIGH) * Rot(0, -90, 0) * STUD_NUT.shape for at in STUDS
    ]


# --- the wire: drawn where it lies, not where the lamp is drawn -------------------------
LAMP_X, LAMP_Y, LAMP_Z = ON_SHELF.position.X, ON_SHELF.position.Y, ON_SHELF.position.Z
SWITCH_HIGH = LAMP_Z - 260  # in reach, under the lamp
ON_FLOOR = WIRE + 0.2
PLUG_HIGH = 6.85  # the middle of the plug, lying flat
TURN = 25.0  # how tightly the wire is folded, where it lies


def wire():
    """Down the stem from the holder and down to the floor, where what is left of its
    length lies folded under the shelf, and ends in the plug. Returns where that is."""
    top = (LAMP_X, LAMP_Y, LAMP_Z + STEM_TOP + 8)
    drop = (LAMP_X, LAMP_Y, 130)
    floor = (LAMP_X + 70, LAMP_Y - 40, ON_FLOOR)
    down = [Line(top, drop), Spline(drop, floor, tangents=[(0, 0, -1), (1, 0, 0)])]
    # three runs and a half, there and back, with a half turn between: as long as
    # brings the whole wire to its length
    rise = 80.0  # the last of it, coming up to the middle of the plug
    spent = sum(edge.length for edge in down) + 3 * math.pi * TURN + rise
    run = (WIRE_LONG - spent) / 3.5
    folded, (x, y, z), way = [], floor, 1
    for n in range(4):
        far = x + way * run * (0.5 if n == 3 else 1)
        folded.append(Line((x, y, z), (far, y, z)))
        if n < 3:
            folded.append(
                ThreePointArc((far, y, z), (far + way * TURN, y + TURN, z), (far, y + 2 * TURN, z))
            )
            y += 2 * TURN
        x, way = far, -way
    end = (x - rise, y, PLUG_HIGH)
    folded.append(Spline((x, y, z), end, tangents=[(-1, 0, 0), (-1, 0, 0)]))
    return along(Wire(down + folded), WIRE), end


def switch():
    """A switch on the wire, with a rocker."""
    shape = fillet(Box(24, 15, 60).edges(), 4)
    shape += Pos(0, -8, 0) * fillet(Box(12, 4, 22).edges(), 1.5)
    return Pos(LAMP_X, LAMP_Y, SWITCH_HIGH) * (shape - Cylinder(WIRE, 70))


def plug(at: tuple):
    """A flat two-pin plug, lying on the floor: the wire comes into it from the right."""
    body = fillet(Box(36, 35, 13.7).edges(), 4)
    body = Pos(18, 0, 0) * body - Pos(2.5, 0, 0) * Rot(0, 90, 0) * Cylinder(WIRE + 0.05, 6)
    for side in (-1, 1):
        body += Pos(36 + 9.5, side * 9.3, 0) * Rot(0, 90, 0) * Cylinder(2, 19)
    return Pos(at[0] + 5, at[1], at[2]) * Rot(0, 0, 180) * body


# --- the model --------------------------------------------------------------------------
screw, ring_hole = clamp_screw()
lamp_holder, seat = holder()
cap, glass = bulb(seat)
cord, cord_end = wire()

model = Model("Clip lamp on a shelf", reference="room")
shelving = model.group("Shelf")
clamp = model.group("Clamp")
shade_group = model.group("Shade", shell=True)  # what the bulb is inside
light = model.group("Light")
wiring = model.group("Wire")

# pulled apart, the ladders come away to either side, off the clips
for side, name in ((-1, "left"), (1, "right")):
    away = side * 80
    model.part(f"ladder-{name}", ladder(side), label=f"Ladder, {name}", group=shelving, color="white", explode=(away, 0, 0))
    model.part(f"foot-{name}", foot(side), label=f"Foot, {name}", group=shelving, color="white", explode=(away, 0, -30))
    model.part(f"wall-screw-{name}", wall_fixing(side), label=f"Wall screw, {name}, {WALL_SCREW.size}", group=shelving, finish="metal", explode=(away, -40, 0))
for number in sorted(shelves, reverse=True):
    model.part(f"shelf-{number}", shelves[number], label=f"Shelf {number}", group=shelving, color="white", explode=(0, 0, 0))
model.part("clips", clips, label="Shelf clips", group=shelving, color="yellow", explode=(0, 0, 0))
model.part("clip-screws", clip_screws, label=f"Clip screws, {CLIP_SCREW.size}", group=shelving, finish="metal", explode=(0, 0, -30))

FORWARD = 80.0  # how far the lamp comes off the shelf when the model is pulled apart


def lamp(id: str, shape, label: str, group: str, away=(0.0, 0.0, 0.0), **how):
    """A part of the lamp, put on the shelf. Pulled apart, the lamp comes forward off
    the shelf, and each part of it goes its own way from there."""
    placed = [ON_SHELF * each for each in shape] if isinstance(shape, list) else ON_SHELF * shape
    model.part(id, placed, label=label, group=group, explode=(away[0], away[1] - FORWARD, away[2]), **how)


lamp("frame", frame(), "Clamp", clamp, finish="metal")
lamp("clamp-screw", screw, f"Clamping screw, {CLAMP_SCREW.thread}", clamp, (0, 0, -40), finish="metal")
lamp("ring", ring(ring_hole), "Ring", clamp, (0, 0, -62), finish="metal")
lamp("pad", pad(), "Pad", clamp, (0, 0, -12), color="grey")
lamp("pinch-screw", PINCHED * PINCH.shape, f"Pinch screw, {PINCH.size}", clamp, (35, 0, 0), finish="metal")

lamp("shade", shade(), "Shade", shade_group, (0, -70, 62), color="blue")
lamp("cup", cup(), "Cup", shade_group, (0, 0, 62), finish="metal")

lamp("stem", stem(), "Stem", light, (0, 0, 25), finish="metal")
lamp("stem-nut", Pos(0, 0, CUP_LOW - STEM_NUT.height) * STEM_NUT.shape, f"Stem nut, {STEM_NUT.size}", light, (0, 0, 42), finish="metal")
lamp("stud-nuts", stud_nuts(), f"Shade nuts, {STUD_NUT.size}", light, (0, 18, 62), finish="metal")
lamp("holder", lamp_holder, "Lamp holder, E27", light, (0, 0, 95), color="grey")
lamp("bulb-cap", cap, "Bulb cap", light, (0, 0, 128), finish="metal")
lamp("bulb", glass, "Bulb", light, (0, 0, 128), color="white", finish="glass")

lamp("bush", bush(), "Bush", wiring, (0, 0, -10), color="grey")
model.part("wire", cord, label="Wire", group=wiring, color="grey", explode=(0, -FORWARD, 0))
model.part("switch", switch(), label="Switch", group=wiring, color="grey", explode=(0, -FORWARD, 0))
model.part("plug", plug(cord_end), label="Plug", group=wiring, color="grey", explode=(-30, -FORWARD, 0))
model.write()
