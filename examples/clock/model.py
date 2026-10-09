"""A table clock, to show what Enclose is for: a thing made of parts, drawn in code.

It is a mechanical clock in a drum case, on a stand. Everything that holds it together
is in the model: the bezel, the dial, the back and the stand are screwed on, with
screws out of the app's own library (kit/screws.py), in holes cut to fit them.

The movement is a whole one. A barrel, which holds the mainspring, drives the centre
wheel, which goes round once an hour and carries the minute hand. That drives the
fourth wheel sixty times as fast, through the third, and the fourth carries the seconds
hand. The fourth drives the escape wheel, which the pallet fork lets go one tooth at a
time as the balance swings: four beats a second. In front of the plates the motion
work takes the hour hand round once in twelve: cannon pinion, minute wheel, hour wheel.
The wheels are cut to the numbers a real movement has, so that turning them by those
numbers keeps their teeth in mesh, which is what tools/clock.js does.

The teeth are plain wedges, not the curves a made wheel has, and the escapement is
drawn to be watched, not to keep time: this is a model to look at and move, not to cut.
"""

import math
import os
import sys

from build123d import Axis, Box, Circle, Cylinder, Polygon, Pos, Rot, chamfer, extrude, fillet

# the app's exporter and its screws, which a project of your own keeps copies of beside
# its model.py
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))
from enclose import Model  # noqa: E402
from screws import Screw  # noqa: E402

# Everything is drawn lying flat, the dial facing up, and stood on its stand at the end:
# x to the right, y towards twelve o'clock, z towards whoever reads the time.

# --- the wheels: how many teeth, and how big a tooth (its module, mm) -------------------
GOING = 0.75  # the train between the plates
FINE = 0.5  # the fourth wheel and the escape pinion
CANNON = 1.0  # cannon pinion and minute wheel
HOUR = 0.96  # minute pinion and hour wheel: so that it comes back to the centre

BARREL_WHEEL, BARREL_PINION = 66, 8
CENTRE_WHEEL, THIRD_PINION, THIRD_WHEEL, FOURTH_PINION = 64, 8, 60, 8
FOURTH_WHEEL, ESCAPE_PINION, ESCAPE_TEETH = 56, 7, 15
CANNON_PINION, MINUTE_WHEEL, MINUTE_PINION, HOUR_WHEEL = 12, 36, 10, 40

# --- where the arbors are, on the plates (mm) -------------------------------------------
CENTRE = (0.0, 0.0)
FOURTH = (0.0, -30.0)  # under the centre: the seconds hand is at six o'clock
BARREL = (0.0, GOING * (BARREL_WHEEL + BARREL_PINION) / 2)  # over it


def beside(a, b, from_a: float, from_b: float, right: bool):
    """The point this far from each of two others: of the two there are, the one further right, or left."""
    (ax, ay), (bx, by) = a, b
    apart = math.hypot(bx - ax, by - ay)
    along = (from_a**2 - from_b**2 + apart**2) / (2 * apart)
    off = math.sqrt(from_a**2 - along**2)
    ux, uy = (bx - ax) / apart, (by - ay) / apart
    found = [
        (ax + ux * along - uy * off * side, ay + uy * along + ux * off * side)
        for side in (1, -1)
    ]
    return (max if right else min)(found)


def out(angle: float, far: float, at=(0.0, 0.0)):
    """The point this far from another, this way from it (degrees, from +X)."""
    return (
        at[0] + far * math.cos(math.radians(angle)),
        at[1] + far * math.sin(math.radians(angle)),
    )


THIRD = beside(
    CENTRE,
    FOURTH,
    GOING * (CENTRE_WHEEL + THIRD_PINION) / 2,
    GOING * (THIRD_WHEEL + FOURTH_PINION) / 2,
    right=True,
)
reach = CANNON * (CANNON_PINION + MINUTE_WHEEL) / 2
STUD = (-reach * math.sqrt(0.5), reach * math.sqrt(0.5))  # the minute wheel, up and to the left

# The escapement, down and to the left. The balance is half way between seven and eight
# o'clock, where the dial has a window cut for it, and the rest is laid out to reach it.
ESCAPE_TIP = 9.0  # how far out the escape wheel's teeth go
BALANCE_RIM = 8.0
ESCAPE = out(200, FINE * (FOURTH_WHEEL + ESCAPE_PINION) / 2, FOURTH)
BALANCE = out(225, 41.0)
PALLET = beside(ESCAPE, BALANCE, 11.5, 10.0, right=False)
if PALLET[1] < beside(ESCAPE, BALANCE, 11.5, 10.0, right=True)[1]:
    # (of the two places it could be, the one nearer the centre, where it shows)
    PALLET = beside(ESCAPE, BALANCE, 11.5, 10.0, right=True)

PLATE = 56.0  # how far out the plates go
PILLAR = 51.0  # how far out the pillars are: three of them, where no wheel is
HEIGHT = 82.0  # how high the centre is, stood up
# what the hands show as it is built: ten past ten
HOURS, MINUTES, SECONDS = 10, 10, 0

# --- the case (mm): a drum, with the movement in from the back and the dial from the front
DRUM = 65.0  # how far out the drum goes
BORE = PLATE + 1.0  # the room the plates slide into
SEAT = 45.0  # the ring inside it that the movement is screwed up against, and the dial down on
BACK, FRONT = -12.0, 33.0  # where the drum ends, behind and in front
DIAL = 54.0  # how far out the dial goes
SCREWS = 61.0  # how far out the screws of the bezel and of the back are
FOOT = 3.0  # how high its feet lift it


def rod(radius: float, low: float, high: float, at=(0.0, 0.0)):
    return Pos(at[0], at[1], (low + high) / 2) * Cylinder(radius, high - low)


def lightened(shape, at, holes: int, middle: float, radius: float, phase=0.0):
    """A wheel with holes cut round it, to lighten it and to show what is behind."""
    for hole in range(holes):
        angle = math.degrees(phase) + (hole + 0.5) * 360 / holes
        shape -= rod(radius, -50, 50, out(angle, middle, at))
    return shape


def wheel(teeth: int, module: float, low: float, high: float, at, phase=0.0, holes=0):
    """A wheel with a tooth at `phase` (radians, from +X), and holes to lighten it."""
    pitch = module * teeth / 2
    tip, root = pitch + module, pitch - 1.25 * module
    step = 2 * math.pi / teeth
    points = []
    for tooth in range(teeth):
        middle = phase + tooth * step
        for radius, half in ((root, 0.34), (tip, 0.13), (tip, -0.13), (root, -0.34)):
            angle = middle - half * step
            points.append((radius * math.cos(angle), radius * math.sin(angle)))
    shape = Pos(at[0], at[1], low) * extrude(Polygon(*points, align=None), high - low)
    return lightened(shape, at, holes, root * 0.56, root * 0.27, phase) if holes else shape


def saw(teeth: int, tip: float, root: float, low: float, high: float, at, phase=0.0):
    """A wheel whose teeth lean one way: a ratchet's, or an escape wheel's."""
    step = 2 * math.pi / teeth
    points = []
    for tooth in range(teeth):
        angle = phase + tooth * step
        for radius, part in ((tip, 0.0), (tip, 0.08), (root, 0.42), (root, 0.86)):
            points.append(
                (radius * math.cos(angle + part * step), radius * math.sin(angle + part * step))
            )
    return Pos(at[0], at[1], low) * extrude(Polygon(*points, align=None), high - low)


def meshing(driver_phase: float, driver: int, driver_at, driven: int, driven_at) -> float:
    """Where a wheel has a tooth, for its teeth to go between those of the one driving it."""
    toward = math.atan2(driven_at[1] - driver_at[1], driven_at[0] - driver_at[0])
    # how far past a tooth the driver is, where the two meet: as a part of one tooth
    past = ((toward - driver_phase) / (2 * math.pi / driver)) % 1
    return toward + math.pi - (2 * math.pi / driven) * (0.5 - past)


def strip(a, b, wide_a: float, wide_b: float | None = None):
    """A flat strip from one point to another, as an outline: this wide at each."""
    wide_b = wide_a if wide_b is None else wide_b
    far = math.hypot(b[0] - a[0], b[1] - a[1])
    nx, ny = -(b[1] - a[1]) / far, (b[0] - a[0]) / far
    return Polygon(
        (a[0] + nx * wide_a / 2, a[1] + ny * wide_a / 2),
        (b[0] + nx * wide_b / 2, b[1] + ny * wide_b / 2),
        (b[0] - nx * wide_b / 2, b[1] - ny * wide_b / 2),
        (a[0] - nx * wide_a / 2, a[1] - ny * wide_a / 2),
        align=None,
    )


def spot(at, radius: float):
    return Pos(at[0], at[1], 0) * Circle(radius)


def raised(outline, low: float, high: float):
    """An outline made a solid: this thick, from this high. Up, whichever way it was drawn round."""
    return Pos(0, 0, low) * extrude(outline, high - low, dir=(0, 0, 1))


def hand(length: float, wide: float, narrow: float, hub: float, low: float, high: float, tail=0.0):
    """A hand pointing at twelve, turning about the origin."""
    blade = Polygon(
        (-wide / 2, -tail), (wide / 2, -tail), (narrow / 2, length), (-narrow / 2, length),
        align=None,
    )
    return Pos(0, 0, low) * extrude(blade + Circle(hub), high - low)


def clockwise(shape, degrees: float, at=(0.0, 0.0)):
    """Turned as a hand goes round, seen from the front."""
    return Pos(at[0], at[1], 0) * Rot(0, 0, -degrees) * Pos(-at[0], -at[1], 0) * shape


def stood(shape):
    """Stood up on its edge: the dial faces the front, and twelve is at the top."""
    return Pos(0, 0, HEIGHT) * Rot(90, 0, 0) * shape


def rounded(shape, radius: float, top: bool):
    """A turned thing with the edges of its front, or of its back, rounded over."""
    return fillet(shape.edges().group_by(Axis.Z)[-1 if top else 0], radius)


# --- between the plates: the going train --------------------------------------------------
centre_phase = 0.0
third_phase = meshing(centre_phase, CENTRE_WHEEL, CENTRE, THIRD_PINION, THIRD)
fourth_phase = meshing(0.0, THIRD_WHEEL, THIRD, FOURTH_PINION, FOURTH)
barrel_phase = meshing(0.0, BARREL_PINION, CENTRE, BARREL_WHEEL, BARREL)
escape_phase = meshing(0.0, FOURTH_WHEEL, FOURTH, ESCAPE_PINION, ESCAPE)
minute_phase = meshing(0.0, CANNON_PINION, CENTRE, MINUTE_WHEEL, STUD)
hour_phase = meshing(0.0, MINUTE_PINION, STUD, HOUR_WHEEL, CENTRE)

# the barrel: a drum with the spring in it, and teeth round its edge. It turns on its
# arbor, which stays still but for being wound, by the square on its end.
barrel = (
    wheel(BARREL_WHEEL, GOING, 7, 8.8, BARREL, barrel_phase)
    + rod(22, 7, 13, BARREL)
    - rod(20, 12.4, 14, BARREL)
    + rod(4.5, 12, 13, BARREL)
    - rod(2.05, 0, 20, BARREL)
)
barrel_arbor = (
    rod(1.9, -9, 15.5, BARREL)
    + Pos(BARREL[0], BARREL[1], -11.75) * Box(2.7, 2.7, 5.5)
    + saw(20, 7.5, 6.2, -4.5, -3, BARREL)  # the ratchet that keeps it wound
)
# the centre arbor goes right through to the back, for the knob the hands are set by
centre_wheel = (
    rod(1.5, -17, 31, CENTRE)
    + wheel(CENTRE_WHEEL, GOING, 4, 6, CENTRE, centre_phase, holes=5)
    + wheel(BARREL_PINION, GOING, 6.8, 9, CENTRE)
    + wheel(CANNON_PINION, CANNON, 17, 20, CENTRE)
)
third_wheel = (
    rod(1.2, -1.5, 15.5, THIRD)
    + wheel(THIRD_PINION, GOING, 3.5, 6.5, THIRD, third_phase)
    + wheel(THIRD_WHEEL, GOING, 9, 11, THIRD, holes=5)
)
fourth_wheel = (
    rod(1.0, -1.5, 24.4, FOURTH)
    + wheel(FOURTH_PINION, GOING, 8.5, 11.5, FOURTH, fourth_phase)
    + wheel(FOURTH_WHEEL, FINE, 12.2, 13.4, FOURTH, holes=4)
)

# --- the escapement -------------------------------------------------------------------------
# The pallets reach in at the escape wheel from the pallet fork's side, this far either
# side of the line between the two: four teeth apart. The wheel is drawn with the gap
# between two teeth at each of them.
REACH = 2 * 360 / ESCAPE_TEETH
to_fork = math.atan2(PALLET[1] - ESCAPE[1], PALLET[0] - ESCAPE[0])
escape_teeth = saw(
    ESCAPE_TEETH,
    ESCAPE_TIP,
    6.6,
    7,
    8,
    ESCAPE,
    to_fork + math.radians(REACH) - 0.66 * 2 * math.pi / ESCAPE_TEETH,
)
escape_wheel = (
    rod(0.8, -1.5, 15.5, ESCAPE)
    + wheel(ESCAPE_PINION, FINE, 11.8, 13.8, ESCAPE, escape_phase)
    + lightened(escape_teeth, ESCAPE, 5, 3.9, 1.5)
    + rod(1.6, 7, 11.8, ESCAPE)
)


def pallet_fork():
    """Two arms that reach in among the escape wheel's teeth, and a lever with a fork on
    its end that the pin under the balance swings in."""
    outline = spot(PALLET, 1.7)
    back = math.degrees(to_fork)
    for side in (REACH, -REACH):
        # each arm ends in a pallet, pointing in at the wheel's middle
        outside = out(back + side, ESCAPE_TIP + 1.7, ESCAPE)
        inside = out(back + side, ESCAPE_TIP - 1.1, ESCAPE)
        outline += (
            strip(PALLET, outside, 1.8, 1.3)
            + spot(outside, 0.65)
            + strip(outside, inside, 1.3, 0.5)
        )
    toward = math.degrees(math.atan2(BALANCE[1] - PALLET[1], BALANCE[0] - PALLET[0]))
    far = math.hypot(BALANCE[0] - PALLET[0], BALANCE[1] - PALLET[1])
    neck = out(toward, far - 3.4, PALLET)
    outline += strip(PALLET, neck, 1.8, 1.4)
    across = (-math.sin(math.radians(toward)), math.cos(math.radians(toward)))
    for side in (1, -1):
        # the two horns of the fork, one either side of the pin
        root = (neck[0] + across[0] * side * 1.2, neck[1] + across[1] * side * 1.2)
        tip = out(toward, 2.6, root)
        outline += strip(neck, root, 1.2) + strip(root, tip, 1.2, 0.7) + spot(root, 0.6)
    return raised(outline, 7, 8) + rod(0.6, -1.5, 15.5, PALLET)


pallet = pallet_fork()

toward_pallet = math.degrees(math.atan2(PALLET[1] - BALANCE[1], PALLET[0] - BALANCE[0]))
rim = spot(BALANCE, BALANCE_RIM) - spot(BALANCE, BALANCE_RIM - 1.5) + spot(BALANCE, 1.6)
for spoke in (0, 60, 120):
    rim += strip(
        out(toward_pallet + spoke, BALANCE_RIM - 0.5, BALANCE),
        out(toward_pallet + spoke + 180, BALANCE_RIM - 0.5, BALANCE),
        1.2,
    )
balance = (
    rod(0.7, -1.5, 15.5, BALANCE)
    + raised(rim, 10, 11.5)
    # under it, the roller with the pin that the fork pushes, and is pushed by
    + rod(2.3, 8.4, 9.3, BALANCE)
    + rod(0.45, 7, 8.4, out(toward_pallet, 1.75, BALANCE))
)

# --- in front of the plates: the motion work ---------------------------------------------
minute_wheel = (
    wheel(MINUTE_WHEEL, CANNON, 17, 19, STUD, minute_phase, holes=4)
    + wheel(MINUTE_PINION, HOUR, 19, 22.5, STUD)
    - rod(1.3, 10, 30, STUD)
)
hour_wheel = (
    wheel(HOUR_WHEEL, HOUR, 20.5, 22.5, CENTRE, hour_phase, holes=5)
    + rod(3.0, 20.5, 27.5, CENTRE)
    - rod(1.9, 10, 40, CENTRE)
)
# behind the back, the knob that sets the hands: fluted, for a finger and thumb
knob = rounded(rod(7, -22, -16.5), 1.0, top=False) - rod(1.5, -21, -10)
for flute in range(14):
    knob -= rod(1.1, -30, -10, out(flute * 360 / 14, 7.5))

# --- the hands, at the time it is built showing -------------------------------------------
minutes = MINUTES + SECONDS / 60
hour_hand = clockwise(hand(30, 5.5, 2.4, 5.2, 26.2, 27.2) - rod(3.0, 10, 40), (HOURS + minutes / 60) * 30)
minute_hand = clockwise(hand(47, 4.0, 1.4, 3.6, 28.5, 29.5, tail=6) - rod(1.5, 10, 40), minutes * 6)
seconds_hand = clockwise(
    Pos(FOURTH[0], FOURTH[1], 0) * (hand(9, 1.3, 0.7, 1.9, 23.4, 24, tail=3.5) - rod(1.0, 10, 40)),
    SECONDS * 6,
    FOURTH,
)

# --- the plates, and the pillars between them ----------------------------------------------
PILLARS = [out(angle, PILLAR) for angle in (30, 150, 270)]
arbors = [
    (CENTRE, 1.7),
    (THIRD, 1.4),
    (FOURTH, 1.2),
    (BARREL, 2.1),
    (ESCAPE, 1.0),
    (PALLET, 0.8),
    (BALANCE, 0.9),
]

back_plate = rod(PLATE, 0, 2)

# The front plate is a rim and bars, so that the wheels show behind it: a bar out to
# each arbor, and a bridge over the escapement.
bars = spot(CENTRE, 7) + spot(BARREL, 5.5)
for angle in (90, 270):
    bars += strip(CENTRE, out(angle, PLATE - 3), 8)
for to in (THIRD, STUD):
    bars += strip(CENTRE, out(math.degrees(math.atan2(to[1], to[0])), PLATE - 3), 8)
# (it is narrow where it crosses the balance, which is what there is to see there)
bridge = [(out(225, PLATE - 5), 3.2), (BALANCE, 3.0), (PALLET, 3.6), (ESCAPE, 4.4), ((0.0, -42.0), 4.4)]
for (a, wide_a), (b, wide_b) in zip(bridge, bridge[1:]):
    bars += strip(a, b, wide_a, wide_b) + spot(a, wide_a / 2 + 0.4) + spot(b, wide_b / 2 + 0.4)
front_plate = (
    rod(PLATE, 14, 16)
    - rod(PLATE - 10, 10, 20)
    + (raised(bars, 14, 16) & rod(PLATE, 14, 16))
    + rod(1.1, 16, 23, STUD)  # the stud the minute wheel turns on
)
for at, radius in arbors:
    back_plate -= rod(radius, -5, 5, at)
    front_plate -= rod(radius, 10, 20, at)

pillars = rod(3.0, 2, 14, PILLARS[0])
for at in PILLARS[1:]:
    pillars += rod(3.0, 2, 14, at)

# --- the dial: a ring, with a window on the balance, and a mark let into it for each hour --
dial = rod(DIAL, 24, 26) - rod(39, 20, 30) - rod(BALANCE_RIM + 0.7, 20, 30, BALANCE)
marks = None
for hour in range(12):
    quarter = hour % 3 == 0
    long, wide = (12, 2.6) if quarter else (8, 1.6)
    # each stands a little proud of the slot it is let into
    mark = clockwise(Pos(0, DIAL - 2 - long / 2, 25.7) * Box(wide, long, 1.0), hour * 30)
    dial -= clockwise(Pos(0, DIAL - 2 - long / 2, 26) * Box(wide, long, 1.6), hour * 30)
    marks = mark if marks is None else marks + mark

# --- the case -------------------------------------------------------------------------------
# A drum, bored from the back for the movement and from the front for the dial, with a
# ring left standing between the two: the movement is screwed up against the back of it,
# and the dial down on the front.
case = (
    rounded(rod(DRUM, BACK, FRONT), 1.0, top=False)
    - rod(BORE, BACK - 5, 16)
    - rod(SEAT, 10, 30)
    - rod(DIAL + 0.5, 24, FRONT + 5)
    - rod(BALANCE_RIM + 1.6, 15, 25, BALANCE)  # so that the balance shows through the dial
)
# the back: a lid with a lip that goes into the drum, and a hole for the knob and the key
back_cover = (
    rounded(rod(DRUM, BACK - 3, BACK), 1.2, top=False)
    + rod(BORE - 0.2, BACK, BACK + 2)
    - rod(BORE - 3.5, BACK - 0.01, BACK + 5)
    - rod(2.3, -30, 0, CENTRE)
    - rod(3.4, -30, 0, BARREL)
)
# the glass, and the bezel that holds it down on the front of the drum
crystal = rod(56.5, FRONT, FRONT + 2.5)
bezel = (
    rounded(rod(DRUM + 1.5, FRONT, FRONT + 5), 1.8, top=True)
    - rod(53, 0, 60)
    - rod(56.7, FRONT - 1, FRONT + 2.5)
)

# --- the screws -----------------------------------------------------------------------------
# Each kind is placed once, on its axis at the face its head comes down on, and the same
# placing cuts the hole it passes through and the hole it screws into.
BEHIND = Rot(180, 0, 0)  # driven in from the back: a screw is drawn head up

bezel_screw = Screw("M3", 10, "countersunk")
bezel_spots = [Pos(*out(30 + 60 * n, SCREWS), FRONT + 5) for n in range(6)]
for at in bezel_spots:
    bezel -= at * bezel_screw.hole()
    case -= at * bezel_screw.thread_hole()

cover_screw = Screw("M3", 8, "countersunk")
cover_spots = [Pos(*out(45 + 90 * n, SCREWS), BACK - 3) * BEHIND for n in range(4)]
for at in cover_spots:
    back_cover -= at * cover_screw.hole()
    case -= at * cover_screw.thread_hole()

# the dial's screws are a little way round from the hours, between two marks
dial_screw = Screw("M3", 6, "countersunk")
dial_spots = [Pos(*out(75 - 90 * n, 49.5), 26) for n in range(4)]
for at in dial_spots:
    dial -= at * dial_screw.hole()
    case -= at * dial_screw.thread_hole()

# the movement is held by its pillars: a screw through the ring of the case and the
# front plate into the front of each, its head let into the ring so the dial lies flat
movement_screw = Screw("M3", 12)
movement_spots = [Pos(*at, 24 - movement_screw.head_height) for at in PILLARS]
for at in movement_spots:
    case -= at * movement_screw.hole(sunk=movement_screw.head_height)
    front_plate -= at * movement_screw.hole()
    pillars -= at * movement_screw.thread_hole()

# and the back plate by a screw into the back of each
plate_screw = Screw("M3", 6, "button")
plate_spots = [Pos(*at, 0) * BEHIND for at in PILLARS]
for at in plate_spots:
    back_plate -= at * plate_screw.hole()
    pillars -= at * plate_screw.thread_hole()

# --- the stand, as it stands: z is up from here on ----------------------------------------
MIDDLE = -(BACK + 4 + FRONT - 5) / 2  # the middle of the cradle, front to back
slab = fillet((Pos(0, MIDDLE, FOOT + 4) * Box(112, 66, 8)).edges().filter_by(Axis.Z), 9)
slab = chamfer(slab.edges().group_by(Axis.Z)[-1], 1.0)
cradle_top = HEIGHT - 54
stand = slab + Pos(0, MIDDLE, (FOOT + 8 + cradle_top) / 2) * Box(
    72, FRONT - 5 - (BACK + 4), cradle_top - FOOT - 8
)
stand -= stood(rod(DRUM + 0.15, BACK - 10, FRONT + 10))  # the cradle the drum lies in

feet = None
for x in (-42, 42):
    for y in (MIDDLE - 20, MIDDLE + 20):
        foot = Pos(x, y, FOOT / 2) * Cylinder(7, FOOT)
        feet = foot if feet is None else feet + foot

# The drum is screwed down from underneath, into its own wall: the heads are let deep
# into the stand, so that the screws need be no longer than the wall is thick.
stand_screw = Screw("M4", 12)
AWAY, DEEP = 22.0, 6.4  # how far either side of the middle, and how far into the wall
under = HEIGHT - math.sqrt(DRUM**2 - AWAY**2)  # where the drum's underside is, there
rest = under + DEEP - stand_screw.length
stand_spots = [Pos(x, -8, rest) * BEHIND for x in (-AWAY, AWAY)]
case = stood(case)
for at in stand_spots:
    stand -= at * stand_screw.hole(sunk=rest - FOOT)
    case -= at * stand_screw.thread_hole(stand_screw.length + 1.0)

# --- the model ------------------------------------------------------------------------------
model = Model("Table clock", reference="table")
outside = model.group("Case", shell=True)
face = model.group("Dial and hands")
plates = model.group("Plates")
train = model.group("Going train")
escapement = model.group("Escapement")
motion = model.group("Motion work")
fixings = model.group("Screws")


def screws(id: str, what: str, screw: Screw, spots, lying: bool, explode):
    """The screws that do one job, as one part: called by the job and the size."""
    model.part(
        id,
        [stood(at * screw.shape) if lying else at * screw.shape for at in spots],
        label=f"{what}, {screw.size}",
        group=fixings,
        finish="metal",
        explode=explode,
    )


DARK = "#26282b"  # the hands, the marks and the feet: a grey is drawn as it is

# each goes its own way when the model is pulled apart: the front comes off forwards,
# the movement comes out of the back, and the stand comes away underneath
model.part("stand", stand, label="Stand", group=outside, color="grey", explode=(0, 0, -40))
model.part("feet", feet, label="Feet", group=outside, color=DARK, explode=(0, 0, -54))
model.part("case", case, label="Case", group=outside)
model.part("back-cover", stood(back_cover), label="Back cover", group=outside, explode=(0, 104, 0))
model.part("bezel", stood(bezel), label="Bezel", group=outside, explode=(0, -88, 0))
model.part("crystal", stood(crystal), label="Crystal", group=outside, finish="glass", explode=(0, -74, 0))

model.part("dial", stood(dial), label="Dial", group=face, color="white", explode=(0, -38, 0))
model.part("hour-marks", stood(marks), label="Hour marks", group=face, color=DARK, explode=(0, -44, 0))
model.part("seconds-hand", stood(seconds_hand), label="Seconds hand", group=face, color="red", explode=(0, -30, 0))
model.part("hour-hand", stood(hour_hand), label="Hour hand", group=face, color=DARK, explode=(0, -50, 0))
model.part("minute-hand", stood(minute_hand), label="Minute hand", group=face, color=DARK, explode=(0, -56, 0))

model.part("front-plate", stood(front_plate), label="Front plate", group=plates, color="lightgrey", finish="metal", explode=(0, 14, 0))
model.part("pillars", stood(pillars), label="Pillars", group=plates, color="lightgrey", finish="metal", explode=(0, 56, 0))
model.part("back-plate", stood(back_plate), label="Back plate", group=plates, color="lightgrey", finish="metal", explode=(0, 68, 0))

model.part("barrel", stood(barrel), label="Barrel", group=train, explode=(0, 44, 0))
model.part("barrel-arbor", stood(barrel_arbor), label="Barrel arbor", group=train, explode=(0, 86, 0))
model.part("centre-wheel", stood(centre_wheel), label="Centre wheel", group=train, explode=(0, 26, 0))
model.part("third-wheel", stood(third_wheel), label="Third wheel", group=train, explode=(0, 34, 0))
model.part("fourth-wheel", stood(fourth_wheel), label="Fourth wheel", group=train, explode=(0, 40, 0))

model.part("escape-wheel", stood(escape_wheel), label="Escape wheel", group=escapement, explode=(0, 24, 0))
model.part("pallet-fork", stood(pallet), label="Pallet fork", group=escapement, explode=(0, 30, 0))
model.part("balance", stood(balance), label="Balance", group=escapement, explode=(0, 36, 0))

model.part("minute-wheel", stood(minute_wheel), label="Minute wheel", group=motion, explode=(0, -16, 0))
model.part("hour-wheel", stood(hour_wheel), label="Hour wheel", group=motion, explode=(0, -24, 0))
model.part("setting-knob", stood(knob), label="Setting knob", group=motion, explode=(0, 124, 0))

screws("bezel-screws", "Bezel screws", bezel_screw, bezel_spots, True, (0, -104, 0))
screws("dial-screws", "Dial screws", dial_screw, dial_spots, True, (0, -64, 0))
screws("movement-screws", "Movement screws", movement_screw, movement_spots, True, (0, -8, 0))
screws("plate-screws", "Plate screws", plate_screw, plate_spots, True, (0, 78, 0))
screws("cover-screws", "Back cover screws", cover_screw, cover_spots, True, (0, 116, 0))
screws("stand-screws", "Stand screws", stand_screw, stand_spots, False, (0, 0, -64))
model.write()

# where the arbors are once it is stood up, for tools/clock.js to turn the wheels about
for name, (x, y) in (
    ("centre", CENTRE),
    ("third", THIRD),
    ("fourth", FOURTH),
    ("barrel", BARREL),
    ("escape", ESCAPE),
    ("pallet", PALLET),
    ("balance", BALANCE),
    ("stud", STUD),
):
    print(f"{name}: [{x:.3f}, 0, {y + HEIGHT:.3f}]")
