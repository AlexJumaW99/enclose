"""A person, for a model that stands on the ground to be seen beside: a man 5 feet 9
tall (1.75 m), standing at the model's left.

This is one of Enclose's own reference scenes. Copied into a project as reference.py,
beside the project's enclose.py and with person.glb beside it too, it is that project's
scene to change: run it, and the app shows what it wrote in place of this.
"""

from enclose import Reference

# how wide the figure is, hand to hand, and how far clear of it the model stands
WIDE, CLEAR = 600, 150

scene = Reference(
    "Person",
    detail="5′9″",
    # the model's left side is put this far to the right of the figure, whatever its
    # size: it stands on the same ground, level with where the figure stands
    stand=(WIDE / 2 + CLEAR, 0, 0),
    against=(-1, 0),
    # (how the app chooses among its own scenes: a project's own has no use for this)
    suits="a thing too big to go in a room: a shed, a boat, a car",
)
# the figure comes ready made (see kit/figure): it faces the front, as the model does
scene.mesh("person", "person.glb")
scene.write()
