# Screws

Screws are parts of the model like any other, and Claude puts them in: when what it
makes is screwed together (a lid on its box, a board on its posts), and when it is asked
for them. It does not draw them itself. They come from a library the app keeps beside
its exporter, [`kit/screws.py`](../kit/screws.py), which a project copies in the same
way.

## What is in the library

Metric screws, each to the sizes its standard gives, in the lengths screws are sold in,
and with its thread cut.

| | Standard | Sizes |
|---|---|---|
| Socket head | ISO 4762 | M1.6 to M12 |
| Button head | ISO 7380 | M3 to M12 |
| Countersunk head | ISO 10642 | M3 to M12 |
| Pan head | ISO 7045 | M1.6 to M8 |
| Hexagon head | ISO 4017 | M1.6 to M12 |
| Hex nut | ISO 4032 | M1.6 to M12 |
| Plain washer | ISO 7089 | M1.6 to M12 |

It gives what is cut for a screw as well: the hole it passes through, the hole it screws
into, and the recess a head sinks into.

## Which screw

Claude chooses the screw and says which it used, in its reply and in the part's name
("Lid screws, M3 × 8"), since few people can tell one size from another by looking.
Asked for a bigger or a smaller one with no size named, it asks which, and says what
each measures. (Codex and Grok do not ask: they go one size up or down, and say which.)

## How a thread is drawn

The edges of a thread are too near one another to draw: as lines they run together into
a black band, in the view and in a blueprint. So the exporter leaves out an edge that
winds round and round within a millimetre of the next, and a thread shows by its own
light and shade.
