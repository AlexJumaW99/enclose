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
    model.part("screws", screws, label="Lid screws, M3 × 8", group=fixings, finish="metal")
    model.write()

Units are millimetres and Z is up. Each part is drawn where its shape already is, so
build the parts in their assembled positions. `write()` puts everything in `build/`
beside the script that called it: a mesh and the edges of each part, a STEP file of each
part and of the whole, and `enclose.model.json`, which the app watches and reloads from.

A project that starts from CAD files made elsewhere reads them with `read_step`, which
gives every body in them as a part to hand over, or to change first:

    from enclose import Model, read_step

    model = Model("Clock")
    groups = {}
    for found in read_step("source/clock.step"):
        if found.group not in groups:
            groups[found.group] = model.group(found.group)
        model.part(found.id, found.shape, label=found.label, group=groups[found.group])
    model.write()

Screws are not drawn by hand. Enclose has them in a file of its own beside this one,
screws.py, which a project copies in as it does this: metric screws, nuts and washers
in their standard sizes, each with its thread and with the holes that fit it. Its
docstring shows how it is used.

A project can have a reference scene of its own as well: things of a known real size
that the app draws round the model when asked (Cmd+/), so that how big the model is can
be seen. It is no part of the model, and a script of its own builds it, `reference.py`,
beside the model's:

    from build123d import Box, Pos
    from enclose import Reference

    scene = Reference("Workbench", detail="180 × 60 cm", stand=(0, 0, 900))
    scene.part("top", Pos(0, 0, 880) * Box(1800, 600, 40))
    scene.part("legs", legs)
    scene.write()

`stand` is where a model stands in the scene, in mm: the top of the bench, here.
`write()` puts the scene in `reference/` beside the script, with
`enclose.reference.json`, and the app shows it in place of a scene of its own.

A scene can hold something that comes ready made as well, as a mesh in a glTF file: the
figure of a person, which the app has one of, beside its own scenes' scripts. Given as
a figure, it is for whoever is looking to show or hide, with a button under the view.

    scene.mesh("person", "person.glb", at=(0, 700, 0), figure=True)

Needs build123d (pip install build123d).
"""

from __future__ import annotations

import array
import copy
import json
import math
import os
import re
import struct
import sys
import time
from dataclasses import dataclass

from build123d import Color, Compound, Solid, export_gltf, export_step
from OCP.BRep import BRep_Builder, BRep_Tool
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepGProp import BRepGProp
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.Bnd import Bnd_Box
from OCP.GCPnts import GCPnts_TangentialDeflection
from OCP.GeomAbs import GeomAbs_Cylinder, GeomAbs_Line, GeomAbs_Plane
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.Quantity import Quantity_ColorRGBA
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.STEPConstruct import STEPConstruct
from OCP.StepShape import StepShape_SolidModel
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDF import TDF_Label
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_SHELL, TopAbs_SOLID
from OCP.TopExp import TopExp, TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS, TopoDS_Compound
from OCP.XCAFDoc import (
    XCAFDoc_ColorCurv,
    XCAFDoc_ColorGen,
    XCAFDoc_ColorSurf,
    XCAFDoc_ColorTool,
    XCAFDoc_DocumentTool,
)

# What build123d is built on changed some of its names with its version 8, which
# build123d 0.13 brought in: these are known by either.
try:
    from OCP.TDF import TDF_LabelSequence
    from OCP.TopTools import (
        TopTools_IndexedDataMapOfShapeListOfShape,
        TopTools_IndexedMapOfShape,
    )
except ImportError:
    import OCP.collections as _collections

    TDF_LabelSequence = _collections.Sequence_TDF_Label
    TopTools_IndexedDataMapOfShapeListOfShape = getattr(
        _collections,
        "IndexedDataMap_TopoDS_Shape_List_TopoDS_Shape_TopTools_ShapeMapHasher",
    )
    TopTools_IndexedMapOfShape = getattr(
        _collections, "IndexedMap_TopoDS_Shape_TopTools_ShapeMapHasher"
    )


def _as(kind: str):
    """What takes a shape for the kind it is known to be, by whichever name it has."""
    return getattr(TopoDS, f"{kind}_s", None) or getattr(TopoDS, kind)


_as_compound, _as_edge, _as_face, _as_solid = (
    _as("Compound"),
    _as("Edge"),
    _as("Face"),
    _as("Solid"),
)

__all__ = ["Model", "Reference", "read_step"]

MANIFEST = "enclose.model.json"
REFERENCE = "enclose.reference.json"


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


# How a curve is cut into flats to be drawn: how far a flat may be from the curve, in
# mm, and how far it may turn from the one before, in radians. As drawn, and `fine`.
_FLATS = {False: (0.02, 0.5), True: (0.01, 0.35)}


def _write_mesh(shape, id: str, path: str, fine: bool) -> None:
    """Write a shape as the mesh the app draws, with its curves cut into flats."""
    linear, angular = _FLATS[bool(fine)]
    # A bare solid exports an empty mesh: it has to be in a compound. A copy goes in,
    # because a shape that has been put inside another will not export as STEP
    # afterwards, and the project's own shapes are not ours to re-parent.
    wrapped = Compound(children=[copy.copy(shape)])
    wrapped.label = id
    # The curves are cut here, and not left to build123d, which measures how far a flat
    # may be from its curve against the size of the curve: so the rim of a dial came out
    # in as few flats as a pin, and showed every one. Measured in mm, a big curve gets
    # many and a small one few, and all look as round. What is cut already is kept:
    # build123d cuts only what has no flats within what it is told, which is anything.
    # (It writes each shape of a part made of several from that shape's own copy.)
    for node in (wrapped, *wrapped.descendants):
        if node.wrapped is not None:
            BRepMesh_IncrementalMesh(node.wrapped, linear, False, angular, True)
    export_gltf(
        wrapped,
        path,
        binary=True,
        linear_deflection=1e6,
        angular_deflection=angular,
    )


def _wound_fine(points, faces) -> bool:
    """An edge that goes round and round with less than a millimetre between it and the
    next, as the edges of a screw's thread do. Drawn, such lines run together into a
    black band. Left out, the thread still shows, by its own light and shade."""
    if len(points) < 12:
        return False
    length = sum(a.Distance(b) for a, b in zip(points, points[1:]))
    box = Bnd_Box()
    for point in points:
        box.Add(point)
    # round and round: several times as long as the room it is in is across
    if length * length < 25 * box.SquareExtent():
        return False
    # and near the next line: one of the faces it bounds is that narrow a ribbon
    for face in (faces.First(), faces.Last()):
        surface = GProp_GProps()
        BRepGProp.SurfaceProperties_s(face, surface)
        if surface.Mass() < length:
            return True
    return False


def _write_edges(shape, path: str) -> int:
    """A part's real edges - the boundaries between its faces, as a CAD program draws
    them - as line segments: float32 x1 y1 z1 x2 y2 z2, in mm."""
    by_edge = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors_s(shape.wrapped, TopAbs_EDGE, TopAbs_FACE, by_edge)
    flat = array.array("f")
    for i in range(1, by_edge.Extent() + 1):
        edge = _as_edge(by_edge.FindKey(i))
        faces = by_edge.FindFromIndex(i)
        if BRep_Tool.Degenerated_s(edge):
            continue
        # the seam where a round face closes on itself: one face, which may be listed
        # twice, once for each side of the seam
        if faces.First().IsSame(faces.Last()) and BRep_Tool.IsClosed_s(
            edge, _as_face(faces.First())
        ):
            continue
        if faces.Extent() == 2 and _same_surface(
            _as_face(faces.First()), _as_face(faces.Last())
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
        if _wound_fine(points, faces):
            continue
        for a, b in zip(points, points[1:]):
            flat.extend((a.X(), a.Y(), a.Z(), b.X(), b.Y(), b.Z()))
    with open(path, "wb") as file:
        flat.tofile(file)
    return len(flat) // 6


@dataclass
class Found:
    """One body found in a CAD file, as `read_step` gives it: what to hand to
    `Model.part`. `shape` is a build123d shape, where the file puts it."""

    id: str
    label: str
    group: str
    color: str | None
    shape: object


# what a CAD program calls a thing it was given no name for
_NO_NAME = re.compile(
    r"^(|compound|compsolid|solid|shell|face|none|unnamed|=>.*|open cascade.*)$",
    re.I,
)

_KINDS_OF_COLOUR = (XCAFDoc_ColorSurf, XCAFDoc_ColorGen, XCAFDoc_ColorCurv)


def _name(text) -> str | None:
    """A name as it was given, or None where it only stands in for there being none."""
    text = re.sub(r"\s+", " ", text or "").strip()
    return None if _NO_NAME.match(text) else text


def _name_of(label) -> str | None:
    """What an entry of the file's tree is called."""
    name = TDataStd_Name()
    # (asked for where there is none, a name is not merely not found: Python is ended)
    if not label.IsAttribute(TDataStd_Name.GetID_s()):
        return None
    if not label.FindAttribute(TDataStd_Name.GetID_s(), name):
        return None
    text = name.Get()
    letters = (text.Value(i) for i in range(1, text.Length() + 1))
    return _name("".join(c if isinstance(c, str) else chr(c) for c in letters))


def _hex(colour: Quantity_ColorRGBA) -> str:
    red, green, blue = tuple(Color(colour))[:3]
    return "#%02x%02x%02x" % tuple(round(255 * v) for v in (red, green, blue))


def _read(file: str) -> list[tuple[list[str], str | None, str | None, object]] | None:
    """The bodies in one STEP file, each with the names of what it is inside of (the
    outermost first), its own name if it has one, its colour, and its shape. None if
    it is no STEP file that can be read."""
    document = TDocStd_Document(TCollection_ExtendedString("XCAF"))
    tree = XCAFDoc_DocumentTool.ShapeTool_s(document.Main())
    colours = XCAFDoc_DocumentTool.ColorTool_s(document.Main())
    reader = STEPCAFControl_Reader()
    reader.SetNameMode(True)
    reader.SetColorMode(True)
    if reader.ReadFile(file) != IFSelect_RetDone:
        return None
    reader.Transfer(document)

    # A program that keeps its bodies in one product (Shapr3D does) names them where
    # the file tree does not reach: on the solids themselves. Those names are had from
    # the file's own entries, each of which knows the solid that was made of it.
    session = reader.Reader().WS()
    entries, made = session.Model(), session.TransferReader().TransientProcess()
    nowhere = TopLoc_Location()
    named, names = TopTools_IndexedMapOfShape(), [None]
    for i in range(1, entries.NbEntities() + 1):
        entry = entries.Value(i)
        if not isinstance(entry, StepShape_SolidModel) or entry.Name() is None:
            continue
        try:
            name = _name(entry.Name().ToCString())
        except UnicodeDecodeError:
            continue
        solid = STEPConstruct.FindShape_s(made, entry)
        if not name or solid.IsNull():
            continue
        # (adding one that is there already gives back the place it has)
        if named.Add(solid.Located(nowhere)) == len(names):
            names.append(name)

    def colour_of(shape, *labels) -> str | None:
        """The colour of a body: its own, or that of what it is one of, or failing
        those the colour of the biggest of its faces."""
        colour = Quantity_ColorRGBA()
        for kind in _KINDS_OF_COLOUR:
            if colours.GetColor(shape, kind, colour):
                return _hex(colour)
        for label in labels:
            for kind in _KINDS_OF_COLOUR:
                if XCAFDoc_ColorTool.GetColor_s(label, kind, colour):
                    return _hex(colour)
        biggest, found = -1.0, None
        faces = TopExp_Explorer(shape, TopAbs_FACE)
        while faces.More():
            face = faces.Current()
            if any(colours.GetColor(face, kind, colour) for kind in _KINDS_OF_COLOUR):
                box = Bnd_Box()
                BRepBndLib.Add_s(face, box)
                if box.SquareExtent() > biggest:
                    biggest, found = box.SquareExtent(), _hex(colour)
            faces.Next()
        return found

    bodies: list[tuple[list[str], str | None, str | None, object]] = []

    def walk(label, place, within: list[str], top: bool) -> None:
        if tree.IsReference_s(label):  # one use of something, put somewhere
            used = TDF_Label()
            tree.GetReferredShape_s(label, used)
            place = place.Multiplied(tree.GetLocation_s(label))
        else:
            used = label
        name = _name_of(used) or _name_of(label)
        # the file as a whole is not something its parts are "inside of"
        inside = within if top or not name else [*within, name]
        if tree.IsAssembly_s(used):
            children = TDF_LabelSequence()
            tree.GetComponents_s(used, children)
            for i in range(1, children.Length() + 1):
                walk(children.Value(i), place, inside, False)
            return

        whole = tree.GetShape_s(used)
        if whole.IsNull():
            return
        pieces = []
        solids = TopExp_Explorer(whole, TopAbs_SOLID)
        while solids.More():
            pieces.append(solids.Current())
            solids.Next()
        # surfaces that close no volume are a body too, all of them together
        loose, builder, any_loose = TopoDS_Compound(), BRep_Builder(), False
        builder.MakeCompound(loose)
        for kind, not_in in ((TopAbs_SHELL, TopAbs_SOLID), (TopAbs_FACE, TopAbs_SHELL)):
            others = TopExp_Explorer(whole, kind, not_in)
            while others.More():
                builder.Add(loose, others.Current())
                any_loose = True
                others.Next()
        if any_loose:
            pieces.append(loose)

        for piece in pieces:
            index = named.FindIndex(piece.Located(nowhere))
            own = names[index] if index else None
            moved = piece.Moved(place)
            shape = (
                Solid(_as_solid(moved))
                if piece.ShapeType() == TopAbs_SOLID
                else Compound(_as_compound(moved))
            )
            colour = colour_of(piece, label, used)
            if len(pieces) == 1:
                bodies.append((within, name or own, colour, shape))
            else:
                bodies.append((inside, own, colour, shape))

    free = TDF_LabelSequence()
    tree.GetFreeShapes(free)
    for i in range(1, free.Length() + 1):
        walk(free.Value(i), TopLoc_Location(), [], True)
    return bodies


def read_step(*files: str) -> list[Found]:
    """Every body in one or more STEP files, each as a part to hand to `Model.part`.

    A file path is relative to the script being run. A body is a part: a file that is
    an assembly gives one for each of its components, and a component that is several
    solids gives one for each solid. Each keeps the name the file has for it and stays
    where the file puts it. `group` is what the file holds it in, at the top: the
    sub-assembly it is part of, or the file it came from when several files are read,
    or "Parts" where there is nothing of the kind. `color` is its colour in the file,
    as "#rrggbb", unless every body wears the same one, which then says nothing about
    any of them: it is left out, and the app gives each group a colour of its own."""
    here = os.path.dirname(os.path.abspath(sys.argv[0] or "."))
    found: list[Found] = []
    taken: set[str] = set()
    for file in files:
        stem = os.path.splitext(os.path.basename(file))[0]
        bodies = _read(file if os.path.isabs(file) else os.path.join(here, file))
        if bodies is None:
            raise ValueError(f"{file} could not be read as a STEP file.")
        if not bodies:
            raise ValueError(f"{file} has nothing in it that can be shown.")
        counted: dict[str, int] = {}
        for within, name, colour, shape in bodies:
            if len(files) > 1 and len(bodies) > 1:
                within = [stem, *within]
            if not name:  # goes by what it is inside of, and a number
                among = within[-1] if within else stem
                counted[among] = counted.get(among, 0) + 1
                name = among if len(bodies) == 1 else f"{among} {counted[among]}"
            id = base = _slug(name)
            n = 1
            while id in taken:
                n += 1
                id = f"{base}_{n}"
            taken.add(id)
            found.append(Found(id, name, within[0] if within else "Parts", colour, shape))
    if len({body.color for body in found}) == 1:
        for body in found:
            body.color = None
    return found


class Model:
    """What a project is made of, gathered up to be written where Enclose looks for it."""

    def __init__(
        self,
        title: str | None = None,
        out: str = "build",
        fine: bool = False,
        reference: str | None = None,
        downloads: bool = True,
    ):
        """`out` is relative to the script being run. What is round is drawn round: in
        flats that keep within a fiftieth of a millimetre of the curve, however big the
        curve is. `fine` keeps them twice as near, which makes bigger files and is only
        worth it for something to be looked at very closely.
        `reference` names the one of the app's reference scenes that the thing is best
        seen in, by where it is used: "table" for what stands on a desk or is held in
        the hand, "room" for what stands on the floor. Leave it out and the app goes by
        how big the model is.
        `downloads=False` leaves out the STEP files the app offers of each part and of
        the whole: for a model read from a CAD file the project already has, which they
        would only be copies of, and bigger ones."""
        self.title = title
        self.fine = fine
        self.reference = reference
        self.downloads = downloads
        here = os.path.dirname(os.path.abspath(sys.argv[0] or "."))
        self.out = out if os.path.isabs(out) else os.path.join(here, out)
        self._groups: list[dict] = []
        self._parts: list[dict] = []
        self._shapes: dict[str, object] = {}
        self._keepouts: list[dict] = []

    def group(self, label: str, *, shell: bool = False, id: str | None = None) -> str:
        """A group the parts list shows, in the order groups are made. Returns its id,
        to give to `part`. `shell` marks the outside of the thing: what goes see-through
        in glass mode so that what it encloses shows, and what comes apart part by part
        when the model is pulled apart. In any other group, the parts that touch one
        another stay together then, as one object: a board with its components."""
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
        sits in the assembly. Leave `color` out and the app gives each group a colour of
        its own. Give one to have a part some other colour: by name, from the app's own
        (red, orange, yellow, lime, green, cyan, blue, indigo, violet, pink, white,
        lightgrey, grey), or as "#rrggbb", which is drawn as the nearest of those unless
        it is a grey.
        `finish="metal"` draws bare metal, and `finish="glass"` what is made of
        something clear, a window or a lens: it is seen through, whatever the view.
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
        os.makedirs(os.path.join(self.out, "step" if self.downloads else ""), exist_ok=True)
        downloads = []
        # how many there are to write, then each as it is done: the app shows how far
        # along a model is from these lines
        print(f"{len(self._parts)} part{'' if len(self._parts) == 1 else 's'}")
        for entry in self._parts:
            started = time.time()
            id, shape = entry["id"], self._shapes[entry["id"]]
            _write_mesh(shape, id, os.path.join(self.out, f"{id}.glb"), self.fine)
            _write_edges(shape, os.path.join(self.out, f"{id}.edges.bin"))
            entry.update(file=f"{id}.glb", edges=f"{id}.edges.bin")
            if self.downloads:
                step = os.path.join(self.out, "step", f"{id}.step")
                export_step(shape, step)
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

        if self.downloads and len(self._parts) > 1:
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
            **({"reference": self.reference} if self.reference else {}),
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


@dataclass
class _Mesh:
    """A mesh that comes ready made, and where it goes in a scene."""

    path: str
    at: tuple[float, float, float]
    turn: float
    figure: bool


def _place_mesh(mesh: _Mesh, to: str) -> None:
    """Copy a binary glTF file, with all that is in it moved to its place in a scene:
    under one more node, which is where a glTF file says such a thing."""
    with open(mesh.path, "rb") as file:
        data = file.read()
    if data[:4] != b"glTF" or len(data) < 20:
        raise ValueError(f"not a binary glTF file (.glb): {mesh.path}")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise ValueError(f"not a binary glTF file (.glb): {mesh.path}")
    doc = json.loads(data[20 : 20 + length])
    rest = data[20 + length :]
    scenes = doc.get("scenes") or []
    if not scenes or not doc.get("nodes"):
        raise ValueError(f"there is nothing in the glTF file: {mesh.path}")
    scene = scenes[doc.get("scene", 0)]
    x, y, z = (float(v) for v in mesh.at)
    half = math.radians(float(mesh.turn)) / 2
    doc["nodes"].append(
        {
            "children": scene.get("nodes", []),
            # glTF is in metres with Y up: the scene's upright is its Y, its front its Z
            "translation": [x / 1000, z / 1000, -y / 1000],
            "rotation": [0.0, math.sin(half), 0.0, math.cos(half)],
        }
    )
    scene["nodes"] = [len(doc["nodes"]) - 1]
    body = json.dumps(doc, separators=(",", ":")).encode()
    body += b" " * (-len(body) % 4)
    with open(to, "wb") as file:
        file.write(b"glTF")
        file.write(struct.pack("<II", 2, 12 + 8 + len(body) + len(rest)))
        file.write(struct.pack("<II", len(body), 0x4E4F534A))
        file.write(body)
        file.write(rest)


class Reference:
    """A reference scene: things of a known real size for a model to be seen beside, so
    that how big the model is can be told. The app draws a scene plainly, all in one
    quiet tone with a thin line round each thing in it, and stands the model in it."""

    def __init__(
        self,
        name: str,
        detail: str = "",
        *,
        stand: tuple[float, float, float] = (0.0, 0.0, 0.0),
        against: tuple[int, int] = (0, 0),
        floor: float = 0.0,
        out: str = "reference",
        fine: bool = False,
        suits: str | None = None,
        up_to: tuple[float, float, float] | None = None,
    ):
        """`name` is what the scene goes by in the app's list, and `detail` what the
        list says under it: the sizes that make it something to measure by, as a person
        would say them ("180 × 60 cm"). `stand` is where a model stands in the scene, in
        mm: the middle of the model's underside is put there, so it is the top of a
        table, or a place on the floor of a room. `against` is for a model that is to
        stand beside something, clear of it whatever its own size: (-1, 0) puts the
        model's -X side at `stand` in place of its middle, (0, 1) its +Y side. `floor`
        is how high up the ground is that the scene itself stands on, which is where the
        app rules its grid. `out` is relative to the script being run.

        The last two are for the scenes the app has of its own, which it chooses among:
        `suits` says what kind of thing the scene is for, and `up_to` how big a model
        it is for, at the most, along x, y and z."""
        self.name = name
        self.detail = detail
        self.stand = stand
        self.against = against
        self.floor = floor
        self.fine = fine
        self.suits = suits
        self.up_to = up_to
        here = os.path.dirname(os.path.abspath(sys.argv[0] or "."))
        self._here = here
        self.out = out if os.path.isabs(out) else os.path.join(here, out)
        # what is in it, in the order it was put there: a shape, or a mesh and its place
        self._things: dict[str, object] = {}

    def part(self, id: str, shape) -> None:
        """Something in the scene: a build123d shape, in mm with Z up, where it is in
        the scene. A solid is seen from every side. A face on its own (a Rectangle, put
        where it goes) is seen from the side it faces and seen through from behind,
        which is how a wall is made that does not hide the model from outside the room.

        Keep to a few plain shapes, at their true sizes: a scene is there to measure
        by, and the less there is in it to look at, the better it does that."""
        if id in self._things:
            raise ValueError(f'two parts share the id "{id}"')
        self._things[id] = _shape(shape)

    def mesh(
        self,
        id: str,
        file: str,
        *,
        at: tuple[float, float, float] = (0.0, 0.0, 0.0),
        turn: float = 0.0,
        figure: bool = False,
    ) -> None:
        """Something in the scene that is not built here but comes ready made, as a
        mesh in a glTF file (.glb): the figure of a person, a thing that was scanned.
        The file is as a 3D program writes one, in metres with Y up, and true to size.
        `at` is where its origin goes in the scene, in mm, and `turn` how far round it
        is turned about the upright, in degrees: at none, what faces the front in the
        file (its +Z) faces the front of the scene (-Y). `file` is relative to the
        script being run, and is copied into the scene as it is written.

        `figure` says that it is the figure of a person, there to be shown or not: the
        app leaves it out until whoever is looking asks for it, with a button under the
        view, and takes it away again the same way."""
        if id in self._things:
            raise ValueError(f'two parts share the id "{id}"')
        path = file if os.path.isabs(file) else os.path.join(self._here, file)
        if not os.path.isfile(path):
            raise FileNotFoundError(f'the mesh "{file}" is not there: {path}')
        self._things[id] = _Mesh(path, at, turn, figure)

    def write(self) -> str:
        """Write the meshes and then the manifest, which is what makes the app load
        the scene again. Returns the path of the manifest."""
        if not self._things:
            raise ValueError("a reference scene needs at least one part")
        os.makedirs(self.out, exist_ok=True)
        parts = []
        for id, thing in self._things.items():
            to = os.path.join(self.out, f"{id}.glb")
            part = {"id": id, "file": f"{id}.glb"}
            if isinstance(thing, _Mesh):
                _place_mesh(thing, to)
                if thing.figure:
                    part["figure"] = True
            else:
                _write_mesh(thing, id, to, self.fine)
            parts.append(part)
        against = [int(v) for v in self.against]
        manifest = {
            "name": self.name,
            "detail": self.detail,
            "stand": [round(float(v), 3) for v in self.stand],
            **({"against": against} if any(against) else {}),
            "floor": round(float(self.floor), 3),
            **({"suits": self.suits} if self.suits else {}),
            **({"upTo": [float(v) for v in self.up_to]} if self.up_to else {}),
            "parts": parts,
        }
        # last, and all at once, as a model's is
        path = os.path.join(self.out, REFERENCE)
        with open(path + ".part", "w") as file:
            json.dump(manifest, file, indent=1, ensure_ascii=False)
            file.write("\n")
        os.replace(path + ".part", path)
        print(f"wrote the reference scene to {os.path.relpath(self.out)}")
        return path
