"""A clock movement, to show what a project's own tools are for: see tools/clock.js.

The wheels are cut to the numbers a real movement has, so that turning them by those
numbers keeps their teeth in mesh. The centre wheel goes round once an hour and carries
the minute hand. It drives the fourth wheel sixty times as fast, through the third, and
that carries the seconds hand. In front of the plates the motion work takes the hour
hand round once in twelve: cannon pinion, minute wheel, hour wheel.

The teeth are plain wedges, not the curves a made wheel has: this is drawn to be looked
at and moved, not cut.
"""

import math
import os
import sys

from build123d import Box, Circle, Cylinder, Polygon, Pos, Rot, extrude

# the app's exporter, which a project of your own keeps a copy of beside its model.py
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))
from enclose import Model  # noqa: E402

# Everything is drawn lying flat, the dial facing up, and stood on its base at the end.

# --- the wheels: how many teeth, and how big a tooth (its module, mm) -------------------
GOING = 0.75  # the train between the plates
CANNON = 1.0  # cannon pinion and minute wheel
HOUR = 0.96  # minute pinion and hour wheel: so that it comes back to the centre

CENTRE_WHEEL, THIRD_PINION, THIRD_WHEEL, FOURTH_PINION = 64, 8, 60, 8
CANNON_PINION, MINUTE_WHEEL, MINUTE_PINION, HOUR_WHEEL = 12, 36, 10, 40

# --- where the arbors are, on the plates (mm) -------------------------------------------
CENTRE = (0.0, 0.0)
FOURTH = (0.0, -30.0)  # under the centre: the seconds hand is at six o'clock


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


THIRD = beside(
    CENTRE,
    FOURTH,
    GOING * (CENTRE_WHEEL + THIRD_PINION) / 2,
    GOING * (THIRD_WHEEL + FOURTH_PINION) / 2,
    right=True,
)
reach = CANNON * (CANNON_PINION + MINUTE_WHEEL) / 2
STUD = (-reach * math.sqrt(0.5), reach * math.sqrt(0.5))  # the minute wheel, up and to the left

PLATE = 56.0  # how far out the plates go
HEIGHT = 72.0  # how high the centre is, stood up
# what the hands show as it is built: ten past ten
HOURS, MINUTES, SECONDS = 10, 10, 0


def rod(radius: float, low: float, high: float, at=(0.0, 0.0)):
    return Pos(at[0], at[1], (low + high) / 2) * Cylinder(radius, high - low)


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
    shape = extrude(Polygon(*points, align=None), high - low)
    for hole in range(holes):
        angle = phase + (hole + 0.5) * 2 * math.pi / holes
        middle = root * 0.56
        shape -= Pos(middle * math.cos(angle), middle * math.sin(angle), 0) * Cylinder(
            root * 0.27, 3 * (high - low)
        )
    return Pos(at[0], at[1], low) * shape


def meshing(driver_phase: float, driver: int, driver_at, driven: int, driven_at) -> float:
    """Where a wheel has a tooth, for its teeth to go between those of the one driving it."""
    toward = math.atan2(driven_at[1] - driver_at[1], driven_at[0] - driver_at[0])
    # how far past a tooth the driver is, where the two meet: as a part of one tooth
    past = ((toward - driver_phase) / (2 * math.pi / driver)) % 1
    return toward + math.pi - (2 * math.pi / driven) * (0.5 - past)


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


# --- between the plates -----------------------------------------------------------------
centre_phase = 0.0
third_phase = meshing(centre_phase, CENTRE_WHEEL, CENTRE, THIRD_PINION, THIRD)
fourth_phase = meshing(0.0, THIRD_WHEEL, THIRD, FOURTH_PINION, FOURTH)
minute_phase = meshing(0.0, CANNON_PINION, CENTRE, MINUTE_WHEEL, STUD)
hour_phase = meshing(0.0, MINUTE_PINION, STUD, HOUR_WHEEL, CENTRE)

centre_wheel = (
    rod(1.5, -1.5, 31, CENTRE)
    + wheel(CENTRE_WHEEL, GOING, 4, 6, CENTRE, centre_phase, holes=5)
    + wheel(CANNON_PINION, CANNON, 17, 20, CENTRE)
)
third_wheel = (
    rod(1.2, -1.5, 17.5, THIRD)
    + wheel(THIRD_PINION, GOING, 3.5, 6.5, THIRD, third_phase)
    + wheel(THIRD_WHEEL, GOING, 9, 11, THIRD, holes=5)
)
fourth_wheel = (
    rod(1.0, -1.5, 24.4, FOURTH)
    + wheel(FOURTH_PINION, GOING, 8.5, 11.5, FOURTH, fourth_phase)
)

# --- in front of them: the motion work --------------------------------------------------
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

# --- the hands, at the time it is built showing -----------------------------------------
minutes = MINUTES + SECONDS / 60
hour_hand = clockwise(hand(30, 5.5, 2.4, 5.2, 26, 27) - rod(3.0, 10, 40), (HOURS + minutes / 60) * 30)
minute_hand = clockwise(hand(47, 4.0, 1.4, 3.6, 28.5, 29.5, tail=6), minutes * 6)
seconds_hand = clockwise(
    Pos(FOURTH[0], FOURTH[1], 0) * hand(9, 1.3, 0.7, 1.9, 23.4, 24, tail=3.5),
    SECONDS * 6,
    FOURTH,
)

# --- what holds it all --------------------------------------------------------------------
PILLARS = [(51.0 * math.cos(a), 51.0 * math.sin(a)) for a in (0, math.pi / 2, math.pi, -math.pi / 2)]
arbors = [(CENTRE, 1.7), (THIRD, 1.4), (FOURTH, 1.2)]


def bar(to, wide: float, low: float, high: float):
    """A bar of the front plate, from the centre out to the rim."""
    angle = math.atan2(to[1], to[0])
    length = PLATE - 3
    return Rot(0, 0, math.degrees(angle)) * Pos(length / 2, 0, (low + high) / 2) * Box(
        length, wide, high - low
    )


back_plate = rod(PLATE, 0, 2)
for at, radius in arbors:
    back_plate -= rod(radius, -5, 5, at)

# the front plate is a rim and four bars, so that the wheels show behind it
front_plate = rod(PLATE, 14, 16) - rod(PLATE - 9, 10, 20) + rod(7, 14, 16)
for to in (THIRD, STUD, (0, 1), (0, -1)):
    front_plate += bar(to, 8, 14, 16)
for at, radius in arbors:
    front_plate -= rod(radius, 10, 20, at)
front_plate += rod(1.1, 16, 23, STUD)  # the stud the minute wheel turns on

pillars = rod(2.6, 2, 14, PILLARS[0])
for at in PILLARS[1:]:
    pillars += rod(2.6, 2, 14, at)

# the chapter ring, with a mark cut for each hour, and the feet it stands off the plate on
dial = rod(PLATE, 24, 25) - rod(39, 20, 30)
for hour in range(12):
    quarter = hour % 3 == 0
    long, wide = (12, 2.6) if quarter else (8, 1.6)
    dial -= clockwise(Pos(0, PLATE - 3 - long / 2, 25) * Box(wide, long, 1.0), hour * 30)
for angle in (45, 135, 225, 315):
    dial += clockwise(rod(1.8, 16, 24, (0, PLATE - 4.5)), angle)

base = Pos(0, -8, 4) * Box(96, 46, 8) + Pos(0, -8, 14) * Box(60, 20, 12)
base -= stood(rod(PLATE + 0.15, -0.15, 16.15))  # a cradle the plates sit down into
base -= stood(rod(PLATE + 0.15, 23.85, 25.15))

# --- the model ----------------------------------------------------------------------------
model = Model("Clock movement", reference="table")
frame = model.group("Frame", shell=True)
train = model.group("Going train")
motion = model.group("Motion work")
hands = model.group("Hands")

# each goes its own way when the model is pulled apart: forward or back, by where it lies
model.part("base", base, label="Base", group=frame, color="grey", explode=(0, 0, -30))
model.part("back-plate", stood(back_plate), label="Back plate", group=frame, color="lightgrey", explode=(0, 60, 0))
model.part("pillars", stood(pillars), label="Pillars", group=frame, color="lightgrey", explode=(0, 40, 0))
model.part("front-plate", stood(front_plate), label="Front plate", group=frame, color="lightgrey", explode=(0, -20, 0))
model.part("dial", stood(dial), label="Dial", group=frame, color="white", explode=(0, -70, 0))

model.part("centre-wheel", stood(centre_wheel), label="Centre wheel", group=train, explode=(0, 20, 0))
model.part("third-wheel", stood(third_wheel), label="Third wheel", group=train, explode=(0, 10, 0))
model.part("fourth-wheel", stood(fourth_wheel), label="Fourth wheel", group=train, explode=(0, 0, 0))

model.part("minute-wheel", stood(minute_wheel), label="Minute wheel", group=motion, explode=(0, -35, 0))
model.part("hour-wheel", stood(hour_wheel), label="Hour wheel", group=motion, explode=(0, -50, 0))

model.part("seconds-hand", stood(seconds_hand), label="Seconds hand", group=hands, explode=(0, -85, 0))
model.part("hour-hand", stood(hour_hand), label="Hour hand", group=hands, explode=(0, -95, 0))
model.part("minute-hand", stood(minute_hand), label="Minute hand", group=hands, explode=(0, -105, 0))
model.write()

# where the arbors are once it is stood up, for tools/clock.js to turn the wheels about
for name, (x, y) in (("centre", CENTRE), ("third", THIRD), ("fourth", FOURTH), ("stud", STUD)):
    print(f"{name}: [{x:.3f}, 0, {y + HEIGHT:.3f}]")
