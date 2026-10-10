"""A robot arm that was drawn elsewhere, to show a model made from somebody's CAD file,
and a tool that works it: see tools/arm.js.

The arm is the SO-101, an open-source arm by TheRobotStudio with Hugging Face's LeRobot
(https://github.com/TheRobotStudio/SO-ARM100), under the Apache License 2.0. Its
assembly is in source/, as it is published and unchanged: source/README.md says where
it is from and what its licence asks. Nothing of it is redrawn here. This script reads
the file and says what each of its 267 bodies is part of.

An arm is a chain. The base stands still; a servo in it turns the shoulder, a servo in
the shoulder lifts the upper arm, and so on out to the jaw of the gripper: six servos,
six joints. Each link of the chain is a group here, so that the tool can turn a link
and all that it carries:

- the printed parts are told by their names in the file;
- a servo's case goes with the link it is screwed into, and its horns, with the shaft
  they are on, with the link they turn;
- a screw or a nut goes with the printed part it goes through.

The cables go from one link to the next, and belong to neither: they are a group of
their own, which the tool puts out of sight when the arm is moved.

Where each joint is, and the line it turns about, is taken from the round of its
servo's horn, and printed for tools/arm.js to turn the links about.
"""

import os
import sys

import numpy
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_Cylinder

# the app's exporter, which a project of your own keeps a copy of beside its model.py
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))
from enclose import Model, read_step  # noqa: E402

SOURCE = "source/SO101 Assembly.step"

# --- the chain: its links from the base out, and the joint that turns each ---------------
LINKS = [
    ("base", "Base", None),
    ("shoulder", "Shoulder", "shoulder pan"),
    ("upper-arm", "Upper arm", "shoulder lift"),
    ("lower-arm", "Lower arm", "elbow"),
    ("wrist", "Wrist", "wrist flex"),
    ("gripper", "Gripper", "wrist roll"),
    ("jaw", "Jaw", "gripper"),
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
HORN, DRIVEN = "舵盘", "从动"  # a servo's horns ("metal servo horn"), and the idle one of the two
SHAFT = "GE_"  # the shaft a servo's horn is on, which turns with it
BOARD = ("Bus Servo Adapter", "050375033")  # the board that drives the servos, and its plugs
CABLE = "Component"


def printed(body):
    """The link a printed part is of, with its id and label here: None for anything else."""
    for begins, what in PRINTED.items():
        if body.label.startswith(begins) or str(body.group).startswith(begins):
            return what
    return None


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
cases = [[] for _ in range(6)]  # a servo's case, in the link it is screwed into
horns = [[] for _ in range(6)]  # and its horns and shaft, in the link they turn
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
        if HORN in body.label or body.label.startswith(SHAFT):
            horns[servo].append(body.shape)
            if HORN in body.label and DRIVEN not in body.label:
                joints[servo] = axis_of(body.shape)
        else:
            cases[servo].append(body.shape)
    elif str(body.group).startswith(BOARD):
        board.append(body.shape)
    elif body.label.startswith(CABLE):
        cables.append(body.shape)
    else:
        loose.append(body.shape)

# what is left is screws and nuts: each to the printed part it goes through
clouds = [(link, cloud(shape)) for link, _, shape in plastic.values()]
screws = [[] for _ in LINKS]
for shape in loose:
    screws[goes_through(shape, clouds)].append(shape)

# --- the model --------------------------------------------------------------------------
# It is as the file has it: folded, at rest, with its gripper to the front. The file
# itself is what there is to download of it, in source/: no copies are made of its parts.
model = Model("SO-101 robot arm", reference="table", downloads=False)
groups = [model.group(label, id=id) for id, label, _ in LINKS]
wiring = model.group("Cables", id="cables")

for id, (link, label, shape) in plastic.items():
    # no colour said: the app gives each link one of its own, which shows the chain
    model.part(id, shape, label=label, group=groups[link])
model.part("board", board, label="Servo driver board", group=groups[0], color="green")
for n in range(6):
    number, turns = n + 1, LINKS[n + 1][2]
    model.part(f"servo-{number}", cases[n], label=f"Servo {number}, {turns}", group=groups[n], color="grey")
    model.part(f"horns-{number}", horns[n], label=f"Horns of servo {number}", group=groups[n + 1], finish="metal")
for (id, label, _), fixings in zip(LINKS, screws):
    if fixings:
        model.part(f"screws-{id}", fixings, label=f"Screws, {label.lower()}", group=id, finish="metal")
for n, cable in enumerate(cables):
    model.part(f"cable-{n + 1}", cable, label=f"Cable {n + 1}", group=wiring, color="grey")
model.write()

# where the joints are, for tools/arm.js to turn the links about
for (id, _, turns), (at, way) in zip(LINKS[1:], joints):
    point = ", ".join(f"{v:.3f}" for v in at)
    line = ", ".join(f"{v:.4f}" for v in way)
    print(f"{turns}: turns {id} about [{point}] along [{line}]")
