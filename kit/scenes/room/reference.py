"""An empty room, for a model that stands on the floor to be seen in: 12 feet by 10,
with a ceiling 8 feet up and a doorway in the far wall.

This is one of Enclose's own reference scenes. Copied into a project as reference.py,
beside the project's enclose.py, it is that project's scene to change: run it, and the
app shows what it wrote in place of this.
"""

from build123d import Plane, Pos, Rectangle

from enclose import Reference

FOOT = 304.8
WIDTH, DEPTH, HEIGHT = 12 * FOOT, 10 * FOOT, 8 * FOOT
# a door as doors are made: 32 inches by 80
DOOR_WIDE, DOOR_HIGH = 32 * 25.4, 80 * 25.4
# and how far along the far wall it is, from the wall's middle
DOOR_AT = WIDTH / 4

# The floor and the walls are faces, not slabs: each is seen from inside the room and
# seen through from outside it, so that the room is looked into from wherever the
# camera is and no wall is ever in front of the model.
floor = Rectangle(WIDTH, DEPTH)


def wall(length, middle, facing, along):
    """A wall as long as this, standing with the middle of its foot here and facing
    this way: `along` is the way its length runs."""
    x, y = middle
    upright = Plane(origin=(x, y, HEIGHT / 2), x_dir=along, z_dir=facing)
    return upright, Rectangle(length, HEIGHT)


walls = None
for length, middle, facing, along, doorway in (
    (WIDTH, (0, DEPTH / 2), (0, -1, 0), (1, 0, 0), True),
    (WIDTH, (0, -DEPTH / 2), (0, 1, 0), (-1, 0, 0), False),
    (DEPTH, (-WIDTH / 2, 0), (1, 0, 0), (0, 1, 0), False),
    (DEPTH, (WIDTH / 2, 0), (-1, 0, 0), (0, -1, 0), False),
):
    upright, face = wall(length, middle, facing, along)
    if doorway:
        face -= Pos(DOOR_AT, -(HEIGHT - DOOR_HIGH) / 2) * Rectangle(
            DOOR_WIDE, DOOR_HIGH
        )
    placed = upright * face
    walls = placed if walls is None else walls + placed

scene = Reference(
    "Room",
    detail="12 × 10 ft",
    # a model stands in the middle of the floor
    stand=(0, 0, 0),
    # (how the app chooses among its own scenes: a project's own has no use for these)
    suits="a thing that stands on the floor, or is too big for a table",
    # what goes in it with room to spare: anything bigger is past its walls
    up_to=(3000, 2400, 2300),
)
scene.part("floor", floor)
scene.part("walls", walls)
scene.write()
