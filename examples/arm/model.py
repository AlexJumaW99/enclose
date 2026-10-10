"""A robot arm that was drawn elsewhere, to show a model made from somebody's CAD file,
and a tool that works it: see tools/arm.js.

The arm is the SO-101, an open-source arm by TheRobotStudio with Hugging Face's LeRobot
(https://github.com/TheRobotStudio/SO-ARM100), under the Apache License 2.0. Its
assembly is in source/, as it is published and unchanged: source/README.md says where
it is from and what its licence asks. Nothing of it is redrawn here. This script reads
the file and says what each of its 267 bodies is, and what it is part of.

An arm is a chain. The base stands still; a servo in it turns the shoulder, a servo in
the shoulder lifts the upper arm, and so on out to the jaw of the gripper: six servos,
six joints. Each link of the chain is a group here, so that the tool can turn a link
and all that it carries:

- the printed parts are told by their names in the file;
- a servo's case, with the motor and the board in it, goes with the link it is screwed
  into, and its horns, with the shaft they are on, with the link they turn;
- a screw or a nut goes with the printed part it goes through.

The cables go from one link to the next, and belong to neither: they are a group of
their own, which the tool puts out of sight when the arm is moved.

Two things are this script's own doing. The file has the jaw of the gripper thrown
right back, further open than it is ever used: it is turned to rest a little way open.
And pulled apart (E), the arm comes apart twice over: the links go away from one
another, and every piece of a link away from the rest of it, each screw back out along
its own length.

Where each joint is, and the line it turns about, is taken from the round of its
servo's horn, and printed for tools/arm.js to turn the links about.
"""

import os
import sys

import numpy
from build123d import Axis, Compound
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_Cylinder

# the app's exporter, which a project of your own keeps a copy of beside its model.py
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))
from enclose import Model, read_step  # noqa: E402

SOURCE = "source/SO101 Assembly.step"

# --- the chain: its links from the base out, the joint that turns each, and where each
# goes when the arm is pulled apart (mm) -------------------------------------------------
LINKS = [
    ("base", "Base", None, (0, 35, -70)),
    ("shoulder", "Shoulder", "shoulder pan", (0, -15, -30)),
    ("upper-arm", "Upper arm", "shoulder lift", (0, 70, 5)),
    ("lower-arm", "Lower arm", "elbow", (0, 60, 65)),
    ("wrist", "Wrist", "wrist flex", (0, -25, 70)),
    ("gripper", "Gripper", "wrist roll", (0, -95, 10)),
    ("jaw", "Jaw", "gripper", (0, -110, 85)),
]

# The printed parts, by how the file's name for each begins: the link it is of, and what
# it goes by here.
PRINTED = {
    "Base_SO101": (0, "base", "Base"),
    "Base_08p": (0, "base-motor-holder", "Base motor holder"),
    "WaveShare_Mounting_Plate": (0, "board-mount", "Board mount"),
    "Rotation_Pitch_SO101": (1, "shoulder", "Shoulder"),
    "Motor_holder_SO101_Base": (1, "shoulder-motor-holder", "Shoulder motor holder"),
    "Upper_arm_SO101": (2, "upper-arm", "Upper arm"),
    "Under_arm_SO101": (3, "lower-arm", "Lower arm"),
    "Motor_holder_SO101_Wrist": (3, "wrist-motor-holder", "Wrist motor holder"),
    "Wrist_Roll_Pitch": (4, "wrist", "Wrist"),
    "Wrist_Roll_Follower": (5, "gripper", "Gripper"),
    "Moving_Jaw": (6, "jaw", "Jaw"),
}

# What the file calls the other things in it.
SERVOS = "ST3215 Servo"  # the six servos: each begins with its case, "ZK_..."
# what is in a servo's case, by how its name begins (they are short for the Chinese)
INSIDE = {
    "ZK_": ("case", "case"),
    "SG-": ("top", "top cover"),
    "XG-": ("bottom", "bottom cover"),
    "MOTOR": ("motor", "motor"),
    "PCB": ("board", "board"),
}
SHAFT = "GE_"  # the shaft a servo's horn is on, which turns with it
HORN, DRIVEN = "舵盘", "从动"  # a servo's horns ("metal servo horn"), and the idle one of the two
BOARD = ("Bus Servo Adapter", "050375033")  # the board that drives the servos, and its plugs
CABLE = "Component"
# the screws and nuts, by a word of the file's long name for each
FIXINGS = {"M3 x 6": "Screw, M3 × 6", "Tapping": "Tapping screw", "Nut": "Nut, M3"}

# How far open the jaw is in the file, and how far it is built here, in degrees from shut.
FILE_OPEN, BUILT_OPEN = 105.0, 20.0


def printed(body):
    """The link a printed part is of, with its id and label here: None for anything else."""
    for begins, what in PRINTED.items():
        if body.label.startswith(begins) or str(body.group).startswith(begins):
            return what
    return None


def middle(shape) -> numpy.ndarray:
    """The middle of the box round a shape."""
    box = shape.bounding_box()
    return numpy.array(((box.min.X + box.max.X) / 2, (box.min.Y + box.max.Y) / 2, (box.min.Z + box.max.Z) / 2))


def lengthways(shape) -> numpy.ndarray:
    """The way a long thin thing lies: the longest side of the box round it."""
    box = shape.bounding_box()
    way = numpy.zeros(3)
    way[numpy.argmax((box.max.X - box.min.X, box.max.Y - box.min.Y, box.max.Z - box.min.Z))] = 1
    return way


def cloud(shape) -> numpy.ndarray:
    """The corners of a shape's surface, cut into flats: enough to say how near it is."""
    corners, _ = shape.tessellate(0.3)
    return numpy.array([(v.X, v.Y, v.Z) for v in corners])


def along(shape) -> numpy.ndarray:
    """Three points down the middle of a long thin thing: a screw."""
    box = shape.bounding_box()
    low = numpy.array((box.min.X, box.min.Y, box.min.Z))
    high = numpy.array((box.max.X, box.max.Y, box.max.Z))
    long = numpy.argmax(high - low)
    points = numpy.tile((low + high) / 2, (3, 1))
    points[:, long] = low[long] + numpy.array((0.15, 0.5, 0.85)) * (high - low)[long]
    return points


def goes_through(shape, parts: list) -> int:
    """Which of the printed parts a screw goes through: the one that is nearest all
    down its length. Returns that part's link."""
    points = along(shape)

    def nearness(part):
        _, corners = part
        apart = numpy.linalg.norm(corners[None, :, :] - points[:, None, :], axis=2).min(axis=1)
        return float(numpy.median(apart))

    return min(parts, key=nearness)[0]


def axis_of(horn):
    """The line a horn turns about: a point on it and its direction, from the biggest
    round face the horn has."""
    rounds = [
        BRepAdaptor_Surface(face.wrapped).Cylinder()
        for face in horn.faces()
        if BRepAdaptor_Surface(face.wrapped).GetType() == GeomAbs_Cylinder
    ]
    rim = max(rounds, key=lambda cylinder: cylinder.Radius())
    at, way = rim.Location(), rim.Axis().Direction()
    return (at.X(), at.Y(), at.Z()), (way.X(), way.Y(), way.Z())


# --- sort the file's bodies into the links ---------------------------------------------
bodies = read_step(SOURCE)

plastic = {}  # id: (link, label, shape)
servos = [[] for _ in range(6)]  # what is in each servo's case: (id, label, shape)
turning = [[] for _ in range(6)]  # and its horns and shaft, which turn the next link
joints = [None] * 6
board, cables, loose = [], [], []
servo = -1
for body in bodies:
    part = printed(body)
    if part:
        link, id, label = part
        plastic[id] = (link, label, body.shape)
    elif str(body.group).startswith(SERVOS):
        if body.label.startswith("ZK_"):
            servo += 1
        number = servo + 1
        if HORN in body.label:
            idle = DRIVEN in body.label
            turning[servo].append(
                (f"servo-{number}-{'idle-horn' if idle else 'horn'}", f"Servo {number} {'idle horn' if idle else 'horn'}", body.shape)
            )
            if not idle:
                joints[servo] = axis_of(body.shape)
        elif body.label.startswith(SHAFT):
            turning[servo].append((f"servo-{number}-shaft", f"Servo {number} shaft", body.shape))
        else:
            id, what = next(named for begins, named in INSIDE.items() if body.label.startswith(begins))
            servos[servo].append((f"servo-{number}-{id}", f"Servo {number} {what}", body.shape))
    elif str(body.group).startswith(BOARD):
        board.append(body.shape)
    elif body.label.startswith(CABLE):
        cables.append(body.shape)
    else:
        loose.append(body)

# what is left is screws and nuts: each to the printed part it goes through
clouds = [(link, cloud(shape)) for link, _, shape in plastic.values()]
screws = [[] for _ in LINKS]
for body in loose:
    label = next(named for word, named in FIXINGS.items() if word in body.label)
    screws[goes_through(body.shape, clouds)].append((label, body.shape))

# --- the jaw, turned from where the file has it to where it rests -----------------------
at, way = joints[5]
hinge = Axis(at, way)


def rested(shape):
    return shape.rotate(hinge, FILE_OPEN - BUILT_OPEN)


plastic["jaw"] = (6, "Jaw", rested(plastic["jaw"][2]))
turning[5] = [(id, label, rested(shape)) for id, label, shape in turning[5]]
screws[6] = [(label, rested(shape)) for label, shape in screws[6]]

# --- how it comes apart -----------------------------------------------------------------
# A link's own middle is that of its printed parts. Everything of the link goes with it,
# and then out from that middle; a screw goes back out along its own length.
hearts = [
    numpy.mean([middle(shape) for link, _, shape in plastic.values() if link == n], axis=0)
    for n in range(len(LINKS))
]
whole = numpy.mean(hearts, axis=0)


def out_from(heart, shape, least: float, most: float, part: float = 0.6):
    """How far a thing goes from the middle of what it is part of: further the further
    out it already is, between `least` and `most`."""
    off = middle(shape) - heart
    far = numpy.linalg.norm(off)
    return off / far * min(most, least + part * far) if far > 1e-6 else numpy.zeros(3)


def apart(link: int, shape, screw: bool = False):
    carried = numpy.array(LINKS[link][3], dtype=float)
    if screw:
        way = lengthways(shape)
        if numpy.dot(way, middle(shape) - hearts[link]) < 0:
            way = -way
        return tuple(carried + 26 * way)
    return tuple(carried + out_from(hearts[link], shape, 8, 42))


# --- the model --------------------------------------------------------------------------
# It is as the file has it, but for the jaw: folded, at rest, with its gripper to the
# front. The file itself is what there is to download of it, in source/: no copies are
# made of its parts.
model = Model("SO-101 robot arm", reference="table", downloads=False)
groups = [model.group(label, id=id) for id, label, _, _ in LINKS]
wiring = model.group("Cables", id="cables")

for n, (link_id, link_label, _, _) in enumerate(LINKS):
    for id, (link, label, shape) in plastic.items():
        if link == n:
            # no colour said: the app gives each link one of its own, which shows the chain
            model.part(id, shape, label=label, group=groups[n], explode=apart(n, shape))
    if n == 0:
        driver = Compound(children=board)  # the board and all that is soldered to it, as one
        model.part("board", driver, label="Servo driver board", group=groups[0], color="green", explode=apart(0, driver))
    if n < 6:
        # the servo this link carries: it goes out as one, and then comes open
        case = next(shape for id, _, shape in servos[n] if id.endswith("-case"))
        gone = numpy.array(apart(n, case))
        for id, label, shape in servos[n]:
            opened = gone + out_from(middle(case), shape, 6, 26, part=0.9)
            model.part(id, shape, label=label, group=groups[n], color="grey", explode=tuple(opened))
    if n > 0:
        # and what turns it: the horns of the servo in the link before
        for id, label, shape in turning[n - 1]:
            model.part(id, shape, label=label, group=groups[n], finish="metal", explode=apart(n, shape))
    for k, (label, shape) in enumerate(screws[n]):
        model.part(f"screw-{link_id}-{k + 1}", shape, label=label, group=groups[n], finish="metal", explode=apart(n, shape, screw=True))
for n, cable in enumerate(cables):
    away = tuple(out_from(whole, cable, 60, 90))
    model.part(f"cable-{n + 1}", cable, label=f"Cable {n + 1}", group=wiring, color="grey", explode=away)
model.write()

# where the joints are, for tools/arm.js to turn the links about
for (id, _, turns, _), (at, way) in zip(LINKS[1:], joints):
    point = ", ".join(f"{v:.3f}" for v in at)
    line = ", ".join(f"{v:.4f}" for v in way)
    print(f"{turns}: turns {id} about [{point}] along [{line}]")
print(f"the jaw is built {BUILT_OPEN:.0f} degrees open, of {FILE_OPEN:.0f}")
