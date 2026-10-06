"""Writes a model that Enclose (https://enclose.dev) can show.

This file belongs to Enclose. Copy it into a project and leave it as it is: a later
version of the app may replace it. A project's own script builds the shapes with
build123d and hands them over, one part at a time:

    from build123d import Box, Cylinder, Pos
    from enclose import Model

    model = Model("Sensor box")
    case = model.group("Case", shell=True)     # the outside: see-through in glass mode
    fixings = model.group("Fixings")

    model.part("body", Box(60, 40, 20), label="Body", group=case, color="#e8e8e4")
    model.part("lid", Pos(0, 0, 11) * Box(60, 40, 2), label="Lid", group=case)
    model.part("screws", screws, label="Lid screws", group=fixings, finish="metal")
    model.write()

Units are millimetres and Z is up. Each part is drawn where its shape already is, so
build the parts in their assembled positions. `write()` puts everything in `build/`
beside the script that called it: a mesh and the edges of each part, a STEP file of each
part and of the whole, and `enclose.model.json`, which the app watches and reloads from.

Needs build123d (pip install build123d).
"""

from __future__ import annotations

import array
import copy
import json
import os
import re
import sys
import time

from build123d import Compound, export_gltf, export_step
from OCP.BRep import BRep_Tool
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.GCPnts import GCPnts_TangentialDeflection
from OCP.GeomAbs import GeomAbs_Cylinder, GeomAbs_Line, GeomAbs_Plane
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE
from OCP.TopExp import TopExp
from OCP.TopoDS import TopoDS
from OCP.TopTools import TopTools_IndexedDataMapOfShapeListOfShape

__all__ = ["Model"]

MANIFEST = "enclose.model.json"


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_") or "part"


def _shape(thing):
    """The build123d shape in whatever was handed over: a builder, a sketch-less part, a list."""
    if hasattr(thing, "part") and getattr(thing, "part") is not None:  # a BuildPart
        thing = thing.part
    if isinstance(thing, (list, tuple)):
        thing = Compound(children=list(thing))
    if not hasattr(thing, "wrapped") or thing.wrapped is None:
        raise TypeError(f"not a build123d shape: {thing!r}")
    return thing


def _same_surface(f1, f2) -> bool:
    """Two faces that are pieces of one plane or one cylinder: the edge between them is a
    leftover of how the solid was built, not a corner anyone would draw."""
    a, b = BRepAdaptor_Surface(f1), BRepAdaptor_Surface(f2)
    if a.GetType() != b.GetType():
        return False
    if a.GetType() == GeomAbs_Plane:
        p, q = a.Plane(), b.Plane()
        return (
            p.Axis().Direction().IsParallel(q.Axis().Direction(), 1e-4)
            and p.Distance(q.Location()) < 1e-4
        )
    if a.GetType() == GeomAbs_Cylinder:
        c, e = a.Cylinder(), b.Cylinder()
        return abs(c.Radius() - e.Radius()) < 1e-4 and c.Axis().IsCoaxial(
            e.Axis(), 1e-4, 1e-4
        )
    return False


def _write_edges(shape, path: str) -> int:
    """A part's real edges - the boundaries between its faces, as a CAD program draws
    them - as line segments: float32 x1 y1 z1 x2 y2 z2, in mm."""
    by_edge = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors_s(shape.wrapped, TopAbs_EDGE, TopAbs_FACE, by_edge)
    flat = array.array("f")
    for i in range(1, by_edge.Extent() + 1):
        edge = TopoDS.Edge_s(by_edge.FindKey(i))
        faces = by_edge.FindFromIndex(i)
        if BRep_Tool.Degenerated_s(edge):
            continue
        if faces.Extent() == 1 and BRep_Tool.IsClosed_s(
            edge, TopoDS.Face_s(faces.First())
        ):
            continue  # the seam where a round face closes on itself
        if faces.Extent() == 2 and _same_surface(
            TopoDS.Face_s(faces.First()), TopoDS.Face_s(faces.Last())
        ):
            continue
        curve = BRepAdaptor_Curve(edge)
        if curve.GetType() == GeomAbs_Line:
            points = [
                curve.Value(curve.FirstParameter()),
                curve.Value(curve.LastParameter()),
            ]
        else:
            walk = GCPnts_TangentialDeflection(curve, 0.2, 0.02)
            points = [walk.Value(k) for k in range(1, walk.NbPoints() + 1)]
        for a, b in zip(points, points[1:]):
            flat.extend((a.X(), a.Y(), a.Z(), b.X(), b.Y(), b.Z()))
    with open(path, "wb") as file:
        flat.tofile(file)
    return len(flat) // 6


class Model:
    """What a project is made of, gathered up to be written where Enclose looks for it."""

    def __init__(self, title: str | None = None, out: str = "build", fine: bool = False):
        """`out` is relative to the script being run. `fine` makes smoother curves and
        bigger files: worth it for small round things, not for a whole enclosure."""
        self.title = title
        self.fine = fine
        here = os.path.dirname(os.path.abspath(sys.argv[0] or "."))
        self.out = out if os.path.isabs(out) else os.path.join(here, out)
        self._groups: list[dict] = []
        self._parts: list[dict] = []
        self._shapes: dict[str, object] = {}
        self._keepouts: list[dict] = []

    def group(self, label: str, *, shell: bool = False, id: str | None = None) -> str:
        """A group the parts list shows, in the order groups are made. Returns its id,
        to give to `part`. `shell` marks the outside of the thing: what goes see-through
        in glass mode so that what it encloses shows."""
        group = {"id": id or _slug(label), "label": label}
        if shell:
            group["shell"] = True
        if any(g["id"] == group["id"] for g in self._groups):
            raise ValueError(f'two groups share the id "{group["id"]}"')
        self._groups.append(group)
        return group["id"]

    def part(
        self,
        id: str,
        shape,
        *,
        label: str | None = None,
        group: str | None = None,
        color: str | None = None,
        finish: str | None = None,
        explode: tuple[float, float, float] | None = None,
        glass: bool | None = None,
    ) -> None:
        """One part: a thing made, bought or fitted on its own. `id` is short, unique and
        stays the same between builds. `shape` is the build123d shape, already where it
        sits in the assembly. `color` is "#rrggbb"; `finish="metal"` draws bare metal.
        `explode` is where the part goes when the model is pulled apart, in mm; leave
        it out and the app works one out."""
        if id in self._shapes:
            raise ValueError(f'two parts share the id "{id}"')
        if group is None:
            group = self._groups[-1]["id"] if self._groups else self.group("Parts")
        elif not any(g["id"] == group for g in self._groups):
            raise ValueError(f'part "{id}" names a group that was never made: "{group}"')
        entry: dict = {"id": id, "label": label or id, "group": group}
        if color:
            entry["color"] = color
        if finish:
            entry["finish"] = finish
        if explode:
            entry["explode"] = [float(v) for v in explode]
        if glass is not None:
            entry["glass"] = glass
        self._shapes[id] = _shape(shape)
        self._parts.append(entry)

    def keepout(self, id: str, label: str, low, high) -> None:
        """A box of space that something not modelled needs - a plug, a cable's bend -
        given by two opposite corners, in mm. It is drawn, and listed with the parts."""
        self._keepouts.append(
            {"id": id, "label": label, "min": list(low), "max": list(high), "hits": []}
        )

    def write(self) -> str:
        """Write the meshes, the edges, the STEP files and then the manifest, which is
        what makes the app reload. Returns the path of the manifest."""
        if not self._parts:
            raise ValueError("a model needs at least one part")
        os.makedirs(os.path.join(self.out, "step"), exist_ok=True)
        linear, angular = (0.02, 0.15) if self.fine else (0.08, 0.5)
        downloads = []
        for entry in self._parts:
            started = time.time()
            id, shape = entry["id"], self._shapes[entry["id"]]
            # A bare solid exports an empty mesh: it has to be in a compound. A copy goes
            # in, because a shape that has been put inside another will not export as
            # STEP afterwards, and the project's own shapes are not ours to re-parent.
            wrapped = Compound(children=[copy.copy(shape)])
            wrapped.label = id
            export_gltf(
                wrapped,
                os.path.join(self.out, f"{id}.glb"),
                binary=True,
                linear_deflection=linear,
                angular_deflection=angular,
            )
            _write_edges(shape, os.path.join(self.out, f"{id}.edges.bin"))
            step = os.path.join(self.out, "step", f"{id}.step")
            export_step(shape, step)
            entry.update(file=f"{id}.glb", edges=f"{id}.edges.bin")
            downloads.append(
                {
                    "file": f"step/{id}.step",
                    "name": f"{id}.step",
                    "label": entry["label"],
                    "detail": "",
                    "kind": "part",
                    "part": id,
                    "bytes": os.path.getsize(step),
                }
            )
            print(f"  {entry['label']}: {time.time() - started:.1f}s")

        if len(self._parts) > 1:
            name = _slug(self.title or "model")
            bodies = []
            for entry in self._parts:
                body = copy.copy(self._shapes[entry["id"]])
                body.label = entry["label"]  # the name the body has in other CAD programs
                bodies.append(body)
            whole = Compound(children=bodies)
            whole.label = self.title or "model"
            step = os.path.join(self.out, "step", f"{name}.step")
            export_step(whole, step)
            downloads.insert(
                0,
                {
                    "file": f"step/{name}.step",
                    "name": f"{name}.step",
                    "label": self.title or "Everything",
                    "detail": "every part, in place",
                    "kind": "full",
                    "bytes": os.path.getsize(step),
                },
            )

        manifest = {
            "title": self.title,
            "groups": self._groups,
            "parts": self._parts,
            "keepouts": self._keepouts,
            "downloads": downloads,
        }
        # last, and all at once: the app reloads when this file changes, and by then
        # everything it names has to be there
        path = os.path.join(self.out, MANIFEST)
        with open(path + ".part", "w") as file:
            json.dump(manifest, file, indent=1)
        os.replace(path + ".part", path)
        print(f"wrote {len(self._parts)} parts to {os.path.relpath(self.out)}")
        return path
