"""Makes the figure of a person that Enclose's reference scenes stand beside a model:
person.glb, a man 1.75 m tall (5 ft 9), standing with his arms at his sides.

It is made from the realistic male body in Blender Studio's Human Base Meshes, which
are in the public domain (CC0): see README.md, beside this. The body there stands with
its arms held out from its sides, for sculpting, and has more to it than a figure seen
from across a room wants. So here the arms are lowered, the hollows of its eyes are
closed over, it is made the height it is to be and stood on the ground over the origin,
and it is thinned to a few thousand triangles.

It is run by Blender, not by Python, and only when the figure is to be made again:
what it writes is kept with the app.

    blender -b -Y --factory-startup --python kit/figure/person.py -- \\
        human_base_meshes_bundle.blend kit/scenes/person/person.glb
"""

import sys

import bpy
import numpy as np

BODY = "GEO-body_male_realistic"
# how tall it is made, in metres
HEIGHT = 1.75
# how far each arm is lowered, in degrees, and about where: the shoulder, as far out
# from the middle of the body and as high up as this, in the body's own metres
LOWERED = 13.0
SHOULDER = (0.165, 1.405)
# the way an arm runs as it comes, from the shoulder to the wrist, and how far along
# it the lowering is eased in over
ALONG = (0.365, -0.931)
EASED = 0.14
# its eyes are found above this height and in front of this, in the body's own metres:
# they are closed over, with the skin this many points round them, by evening them out
# this many times
EYES_ABOVE, EYES_BEFORE = 1.55, -0.1
ROUND_EYES, EVENED = 2, 80
# how many of its faces are kept
KEPT = 0.3


def lowered(points, arm):
    """The points of the body with those of its arms turned in towards it, each arm
    about its shoulder, by more the further along the arm a point is."""
    out = points.copy()
    for side in (1.0, -1.0):
        pivot = np.array([side * SHOULDER[0], 0.0, SHOULDER[1]])
        along = np.array([side * ALONG[0], 0.0, ALONG[1]])
        mine = arm & (side * points[:, 0] > 0)
        share = np.clip((points[mine] - pivot) @ along / EASED, 0.0, 1.0)
        angle = np.radians(LOWERED) * share * share * (3 - 2 * share) * side
        x = points[mine, 0] - pivot[0]
        z = points[mine, 2] - pivot[2]
        out[mine, 0] = pivot[0] + x * np.cos(angle) + z * np.sin(angle)
        out[mine, 2] = pivot[2] - x * np.sin(angle) + z * np.cos(angle)
    return out


def eyes():
    """The points of the body's eyes, which are hollows for an eye to sit in, and of
    the skin for a little way round each: by the regions the body is marked out in."""
    near = [set(), set()]
    for inside in regions.values():
        at = points[sorted(inside)]
        # an eye's region is a small one, off to one side, high on the front of the head
        high, before = at[:, 2].min() > EYES_ABOVE, at[:, 1].max() < EYES_BEFORE
        if len(inside) < 400 and high and before:
            near[0 if at[:, 0].mean() > 0 else 1].update(inside)
    for side in near:
        for _ in range(ROUND_EYES):
            pairs = [tuple(edge.vertices) for edge in mesh.edges]
            side.update([v for pair in pairs if side.intersection(pair) for v in pair])
    return near


def closed(points, hollows):
    """The points of the body with each of these hollows drawn up level with the skin
    round it: every point in one is moved, over and over, to the middle of its
    neighbours, and what is round the hollow stays where it is."""
    beside: dict[int, list[int]] = {}
    for edge in mesh.edges:
        a, b = edge.vertices
        beside.setdefault(a, []).append(b)
        beside.setdefault(b, []).append(a)
    out = points.copy()
    for hollow in hollows:
        rim = {v for inside in hollow for v in beside[inside]} - hollow
        moved = sorted(hollow - rim)
        for _ in range(EVENED):
            out[moved] = [out[beside[v]].mean(axis=0) for v in moved]
    return out


bundle, to = sys.argv[sys.argv.index("--") + 1 :][:2]
for other in list(bpy.data.objects):
    bpy.data.objects.remove(other)
with bpy.data.libraries.load(bundle, link=False) as (theirs, ours):
    ours.objects = [BODY]
body = ours.objects[0]
bpy.context.scene.collection.objects.link(body)
# its eyes are things of their own, and it stands in a row with the other bodies
for child in list(body.children):
    bpy.data.objects.remove(child)
body.modifiers.clear()
body.matrix_world.identity()
mesh = body.data

points = np.empty(len(mesh.vertices) * 3)
mesh.vertices.foreach_get("co", points)
points = points.reshape(-1, 3)
# The body is marked out in regions. An arm is the ones that lie wholly out to one
# side of it, above the legs and below the neck.
regions: dict[int, set[int]] = {}
marks = mesh.attributes[".sculpt_face_set"].data
for face, mark in zip(mesh.polygons, marks):
    regions.setdefault(mark.value, set()).update(face.vertices)
arm = np.zeros(len(points), bool)
for inside in regions.values():
    of = sorted(inside)
    at = points[of]
    if np.abs(at[:, 0]).min() > 0.1 and 0.65 < at[:, 2].min() and at[:, 2].max() < 1.45:
        arm[of] = True
points = lowered(points, arm)
points = closed(points, eyes())
points *= HEIGHT / (points[:, 2].max() - points[:, 2].min())
points[:, 2] -= points[:, 2].min()
points[:, 0] -= (points[:, 0].max() + points[:, 0].min()) / 2
feet = points[points[:, 2] < 0.1]
points[:, 1] -= (feet[:, 1].max() + feet[:, 1].min()) / 2
mesh.vertices.foreach_set("co", points.ravel())
mesh.update()

for layer in list(mesh.uv_layers):
    mesh.uv_layers.remove(layer)
mesh.materials.clear()
bpy.context.view_layer.objects.active = body
body.select_set(True)
fewer = body.modifiers.new("fewer", "DECIMATE")
fewer.ratio = KEPT
bpy.ops.object.modifier_apply(modifier=fewer.name)
bpy.ops.object.shade_smooth()
bpy.ops.export_scene.gltf(
    filepath=to,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_texcoords=False,
    export_normals=True,
    export_materials="NONE",
    export_animations=False,
    export_skins=False,
    export_morph=False,
)
print(f"wrote {len(body.data.polygons)} faces to {to}")
