# Assembly guides

A project in Enclose can have assembly guides: how the thing that is modelled is put
together, a step at a time, for someone who has its parts on the table and has never
seen it before. The user asks for one in the app's Assembly view, or in a message.

You write the guide and the app makes the page. The page shows the model's own parts,
as they are built, beside the steps: as the reader goes down the steps, the parts of
each step come in from where you say and go on, lit, over the ones that are on already.
So a guide is only words and the ids of parts. It holds no geometry and no HTML, and it
changes nothing in the model.

The reader has every part loose on the table. What they need from the guide is how each
one goes to the next: which way round, into what, held by what. The picture is what
tells them, so whatever is put together has to be seen being put together. A guide that
brings a ring in with its dot already in it, or a carrier with its gears already on,
has left out the very thing it was asked for. **Take the guide down to the single
part.**

A guide is given to the app, whole, with its `guide` tool (the one in the `assembly`
set: your instructions name it as you know it). The app checks it against the model,
files it as `assembly/<name>-v<n>.json` at the top of the project and shows its cover in
the Assembly view, where the user opens it in a browser or takes it away as a zip. Do
not write that file yourself.

## Working it out

Do this before you write a word of the guide.

1. **Know the parts.** The app's `parts` tool gives every part: its id, what it is
   called, its group, and its box (`min`, `max`, in mm). Read the model's script as
   well (`model.py`): it says what the boxes cannot, which is how things are held. A
   hole and the screw that goes through it, a tab and its slot, a press fit, a thread.
   Take a screenshot if you want to see the thing whole.
2. **Go through them one at a time.** For each part, say to yourself what it touches
   and how it is joined to that: pressed in, screwed on, glued, hooked, dropped in.
   Every part in the list is a piece in the reader's hand, and every joint between two
   of them is something the reader does and the guide shows. The model's groups are no
   help here. A group is how the model is sorted, not how it goes together: a clock's
   "Face" may be three rings with a dot to press into each, which is three things to
   make up and six parts to show. Never write a step to a group.

   The one exception is a thing that comes to the reader in one piece, which the model
   may have as several parts: a bought movement with its case, shaft and contacts, a
   motor and its shaft, a switch with its nut on. That goes on as one, and you say in
   the text that it is the one thing.

3. **Find what is put together before it goes on.** Not every part goes straight on to
   the main thing. A dot is pressed into its ring before the ring goes on. Two gears go
   on their shafts, and the shafts into a carrier, before the carrier does. A plate is
   glued into a leg before the leg is hooked on. Each of these is a sub-assembly: made
   up on the table, apart, and then fitted as one piece (see "Things made up first",
   below). The sign of one is a part that can only be reached, or only goes in, while
   what it belongs to is still off the main thing; or simply two parts that are easier
   to join in the hand than in place.
4. **Find what everything is fitted to.** Most things have one part the rest goes on:
   a base, a chassis, the bottom half of a case. That is the first step. Where the
   thing is built upside down or on its side, start with the part that lies on the
   table then.
5. **Order the rest by what gets in the way of what.** A part that is shut in goes on
   before whatever shuts it in. What is inside goes in before the outside closes. What
   is screwed down goes on before what covers its screws. Where the order does not
   matter, go from large to small, and do what is done from one side before turning
   the thing over.
6. **Check every step as a hand would do it.** With only the parts of the steps before
   on the table: is there a way in for this part, in a straight line, with nothing in
   it? That line is the step's `from`. Once on, what holds it there: a screw, a snap,
   its own weight? If nothing does until a later step, say what to do meanwhile ("hold
   it there", "keep the case on its back").
7. **Look for what cannot be done.** A model is drawn put together, and may never have
   been taken apart in anyone's head: a part with no way in, a screw whose head is
   covered, nothing that holds a part where it sits. Do not write a step that cannot be
   done as if it could. Write the guide for what there is, and tell the user in your
   reply what is in the way. Change the model only if they ask.

## Steps

A step is one thing a person does: one kind of part, going on in one way. The page
brings everything a step puts on in together, along one line, as one. So what is in a
step is seen to arrive, and nothing is seen of how the things in it go to each other.

- **Parts that are alike and go on alike are one step**: the four legs, the six cover
  screws, the two planet gears.
- **Parts that are not alike are different steps.** "Set the lid on" is a step, and
  "fix it with the four screws" is the next. So are a bearing and what it is pressed
  into, a shaft and the gear that goes on it, a ring and its dot. Do this even where
  the hands would do both without stopping: the reader has to see the second thing go
  to the first.
- **A thing that comes in one piece is one step**, however many parts the model has it
  as (the bought movement, above). It is the only step that puts on parts of more than
  one kind.
- **A step can put on nothing.** Turning the thing over, or checking that something
  turns freely, is a step with no parts.
- **Every part goes on in one step.** A guide to the whole thing leaves no part out:
  the app tells you which you missed.
- **There are as many steps as there are things to do.** A thing of twenty-five parts
  seldom takes fewer than fifteen steps, and may take thirty. Do not gather parts
  into a step to keep the guide short: the app also tells you which steps put on parts
  of more than one kind, so that you can split them. And do not split one action in
  two to have more.

### Things made up first: `sub` and `fits`

A step done to a sub-assembly says so with `sub`: what the sub-assembly is called, as
the reader is told ("Outer ring", "Hour carrier", "Front legs"). Every step that makes
it up gives the same name. The page shows a sub-assembly alone while it is made up:
only its own parts, close to, filling the window, with the rest of the model out of
sight. That is what lets a small thing, like a dot going into the back of a ring, be
seen at all.

- Its **first step lays down the part the rest go on to** ("Lay the outer ring face
  down"), as the first step of the guide does for the whole thing. That part arrives
  alone.
- **Each step after puts one kind of part on to it**, like any other step: with a
  `from`, a `view` where that helps, and a `tip` where there is one.
- Then **one step fits it**: a step that names it in `fits`, and is done to what it
  goes on to, which is mostly the main thing, so that the step has no `sub`. The page
  brings the whole sub-assembly in as one piece, from that step's `from`, on to the
  main thing, which is back in sight. Such a step usually has no `parts` of its own.

      { "sub": "Outer ring", "title": "Lay the outer ring face down",
        "text": "…", "parts": ["outer_ring"], "view": [1, -1, -1] },
      { "sub": "Outer ring", "title": "Twist in the minute dot",
        "text": "…", "parts": ["minute_dot"], "from": [0, 0, -25] },
      { "title": "Press the outer ring on to its posts",
        "text": "…", "parts": [], "fits": ["Outer ring"], "from": [0, 0, 50] }

Rules that keep it readable:

- **Make a thing up just before it goes on.** Put a sub-assembly's steps right before
  the step that fits it, so the reader makes one thing and puts it on, and does not
  make five things and then look for where each goes.
- **Every sub-assembly is fitted once**, by a step that comes after all of its own.
  The app rejects a guide that makes one up and leaves it on the table.
- **Things that are alike are made up together.** Both front legs with their plates
  are one sub-assembly, "Front legs": lay down the two legs, glue in the two plates,
  and one step hooks both on. They are shown where the model has them, side by side.
- **One sub-assembly can go into another.** The step that fits the smaller one gives
  the bigger one as its `sub`.
- **A part that goes straight on needs no `sub`.** Use one only where something is
  joined to a part before that part goes on. A single part is never a sub-assembly.
- The parts of a sub-assembly are shown where the model has them and the right way
  up, in the model's frame, as everything is: `from` and `view` mean what they always
  mean. Where it is made up face down on the table, say so in the text and give a
  `view` from underneath.

### What a step says

`title` is what is done, in a few words, as an order: "Fit the legs", "Close the case".

`text` is how, in two to four plain sentences, said to the person doing it:

- Call parts by what they are called (their labels), never by their ids.
- Say which way round, what it goes into, and how far: "with the notch towards the
  back", "until it clicks", "flush with the edge".
- Name the fastener and what turns it, with its size: "the four M4 × 16 screws, with
  the 3 mm hex key". Say how tight where it matters: "finger tight for now".
- Leave out what the picture shows. The reader sees the part arrive.

`tip` is one sentence for the thing that goes wrong in this step, where there is one:
"Do not tighten these yet: the legs need the play." Most steps have none. The page
sets it apart under the step, with a lamp beside it. So whenever a step has something
of that kind to say (a caution, a knack, a thing to check before going on), it goes in
`tip` and nowhere else: never write "Tip:", "Note:" or a warning into `text`, where
it would read as one more thing to do.

### Where the parts come from: `from`

`from` is where the step's parts start, as `[x, y, z]` in mm measured from where they
end up. The model's own frame: millimetres, **Z is up, and the front of the model is
its −Y side**.

    [0, 0, 60]     they come down from 60 mm above
    [0, 0, -80]    they come up from below
    [0, -40, 0]    they go in from the front
    [50, 0, 0]     they come in from the right

Give the way the part really goes on, which is the line you checked in step 4 above.
Make it long enough for the part to start clear of everything: about its own length
along that line, and never so long that it starts out of sight (more than the whole
thing is across). All the parts of a step share the one `from`.

Leave `from` out only where the parts of a step are alike but go on from different
sides: four bolts through four legs, the screws round a flange. The page then brings
each in its own way from outside, back along the way the model comes apart. For
anything else that is a guess, so give `from` for every other step that puts a part
on.

### Where it is seen from: `view`

The page draws the model as a blueprint does: with no perspective, from one of its
corners, three of its sides turned equally to the eye. `view` says which corner, as the
way from the model to the eye, `[x, y, z]` in the same frame. Only the signs count:
right or left, front or back, above or below.

    [1, -1, 1]      from the right, the front and above: where the page begins
    [-1, -1, 1]     from the left, the front and above
    [1, 1, 1]       from the right and behind, above
    [1, -1, -1]     from the right and the front, underneath

The page does not turn the thing over: it stays as it is built. So where a step is
done with the thing upside down, say so in the text ("turn it over") and give a `view`
from underneath, so the reader sees the side they are working on. Left out, the view
stays where the last step done to the same thing had it: a sub-assembly's views are
its own, and when the main thing comes back it is seen as it last was. Give one
whenever what goes on would be hidden from there, and do not swing the view about for
no reason.

How near the model is, is the page's own doing: it fills the window with what the step
is done to, so far. So the first part is seen close to, the view draws back as the rest
go on, and a sub-assembly has the window to itself.

## The rest of a guide

- `title`: what the guide is to. For the whole thing, what the model is called
  ("Counter stool"); the page writes "Assembly Guide" under it.
- `summary`: a line or two for the top. What is being put together, and anything to
  know before starting: how long it takes, that it needs two people, a soft surface.
- `needs`: what is needed that is no part of the model, each with its `name` in a few
  words: tools with their sizes ("3 mm hex key"), glue, thread lock, something to
  stand the thing on, a second pair of hands, and anything to buy that the model does
  not have as a part. The page shows each with a small picture. Say which with `icon`,
  the nearest of: `hex-key`, `screwdriver`, `wrench`, `pliers`, `hammer`, `glue`,
  `tape`, `scissors`, `knife`, `drill`, `soldering-iron`, `ruler`, `clamp`, `cloth`,
  `pencil`, `box`, `screw`, `battery`, `helper`. Leave `icon` out where none of them
  is near. Every guide gives `needs`: the page has a place for it at the top of each.
  Think through every step for what the hand holds in it. Only a thing that goes
  together by hand alone gives an empty list, and the page then says so.
- `already`: only for a guide to part of the model (below).
- `cover`: how the thing is drawn on the guide's cover (below). Every guide gives one.

Sizes come from the model and its script, or from the standard for a thing that has
one. Do not make one up: a tool size you had to guess is said as a guess in your reply.

## The cover

Every guide has a cover in the app: an upright sheet given over, from edge to edge and
from top to foot, to one line drawing of the thing, with a small title over it in the
top left corner. You have just worked out what the thing is. Say how it is drawn, with `cover`,
and compose it as an art director would an advertisement for it.

Think of how Apple shows a product. One object, large. The angle it looks its best
from, which is seldom the angle that explains it. Close, and cropped with confidence,
so that its best feature fills the frame and the rest of it runs off the edge. The
steps are there to explain the thing; the cover is there to make someone want it.

- `view`: where it is drawn from, as the way from the thing to the eye, `[x, y, z]` in
  the model's frame. Unlike a step's view, this is any way at all, not only a corner.
  Find the most flattering one:

      [1, -2, 0.5]      a low three-quarter view from the front right: the usual hero
      [-1, -2, 0.5]     the same from the left, for a thing that leans or faces that way
      [0, -1, 0.1]      square on from the front, for a thing with a face
      [1, 0, 0.05]      in profile, for a thing with a strong outline
      [0.3, -0.5, 1]    from nearly overhead, for a thing whose top is its face
      [1, -1.5, -0.4]   from below, looking up at it, to make it stand tall

  Look at the thing first (take a screenshot), and think about which side carries
  what is distinctive: the curve, the dial, the joint, the thin edge. Draw it from
  where that shows. A thing is rarely at its best from the corner the app opens on.

- `parts`: the ids of the parts the cover is filled with. Not the whole thing: the
  feature that sells it and says at a glance what it is. A stool's seat and backrest,
  a lamp's shade and arm, a clock's dial and bezel. The drawing is made as big as
  makes these fill the sheet. The whole thing is still drawn, and what
  there is no room for runs off the sheet's edge: legs off the foot, a cable off the
  side. That crop is the point.

Name the parts that make up between a third and two thirds of the thing as it is seen
from your `view`: fewer, and the cover is a close-up nobody can place; more, and it is
only the thing fitted on a page. Leave `parts` out only for a thing that is all one
shape, with no one feature to give the sheet to.

## A guide to part of the model

Asked for a guide to one thing in the model (a sub-assembly, or how one part is
fitted), write it for that alone:

- `title` is that thing: "Footrest".
- The steps put on its parts and no others.
- `already` names the parts it is fitted to, by id, where the reader needs to see
  them: they are shown from the start, in place, and no step puts them on. Keep it to
  what the thing touches, not the whole model.
- It goes down to the single part like any other guide, and more so: someone who asks
  for a guide to one group wants to see what is inside it. Asked for a clock's face,
  do not write "fit the three rings". Each ring is made up with its dot, as a
  sub-assembly, and then goes on.

## Giving it

Give the whole guide in one call. If the app rejects it, it says why in words (an id
the model does not have, a part put on twice, a sub-assembly that is never fitted): put
that right and give it again. If it says parts were left out and the guide is to the
whole thing, add them. If it says a step puts on parts of more than one kind, look at
that step again: unless those parts come to the reader as one piece, split it, and
give the guide again. Giving it again in the same turn replaces what you gave before;
in a later turn it is filed as the next version, and the earlier ones are kept for the
user to go back to.

You cannot see the page. Check the guide against the parts instead: read down your
steps with the list of parts beside you, and see that each part is in one step, that
no step holds two parts of which one goes into the other, that each `from` points away
from what is already there, and that nothing goes on after the thing that shuts it in.

Then reply to the user, shortly: that the guide is in the Assembly view, and what in
it you were not sure of.

## An example

```json
{
  "title": "Desk lamp",
  "summary": "A lamp with a weighted base and a shade that tilts. It goes together in about ten minutes.",
  "needs": [
    { "name": "2.5 mm hex key", "icon": "hex-key" },
    { "name": "Phillips screwdriver, PH1", "icon": "screwdriver" }
  ],
  "cover": { "view": [-1, -2, 0.5], "parts": ["shade", "hinge-pin", "post"] },
  "steps": [
    {
      "title": "Start with the base",
      "text": "Lay the base plate on the table with its felt side down. The post and the weight both go on to it.",
      "parts": ["base-plate"],
      "view": [1, -1, 1]
    },
    {
      "title": "Drop in the weight",
      "text": "Lower the steel weight into the recess in the base plate, with its flat side up. It sits loose until the cover goes on.",
      "parts": ["weight"],
      "from": [0, 0, 50]
    },
    {
      "title": "Set the cover on",
      "text": "Set the base cover over the weight so that the cable slot faces the back. Its three holes line up with the three in the base plate.",
      "parts": ["base-cover"],
      "from": [0, 0, 70]
    },
    {
      "title": "Screw the cover down",
      "text": "Fix the cover from above with the three M3 × 10 screws, using the 2.5 mm hex key.",
      "parts": ["cover-screws"],
      "from": [0, 0, 40],
      "tip": "Turn each screw in a little before tightening any of them, so the cover settles flat."
    },
    {
      "title": "Screw in the post",
      "text": "Feed the cable down through the hole in the cover, then turn the post into the thread by hand until it is firm.",
      "parts": ["post"],
      "from": [0, 0, 180]
    },
    {
      "sub": "Shade",
      "title": "Lay the shade on its side",
      "text": "Lay the shade on the table with its open end towards you and its two hinge lugs up.",
      "parts": ["shade"],
      "view": [1, -1, 1]
    },
    {
      "sub": "Shade",
      "title": "Clip in the lamp holder",
      "text": "Push the lamp holder into the neck of the shade from inside, cable end first, until its two clips snap over the rim.",
      "parts": ["lamp-holder"],
      "from": [0, -60, 0],
      "tip": "Both clips should click: pull gently on the holder to check."
    },
    {
      "title": "Hang the shade",
      "text": "Hold the shade against the head of the post, with a lug either side of it and the holes in line.",
      "parts": [],
      "fits": ["Shade"],
      "from": [0, 0, 60],
      "view": [1, 1, 1]
    },
    {
      "title": "Push in the hinge pin",
      "text": "Push the hinge pin through the lugs and the post from the right. Tighten its screw with the screwdriver until the shade stays where it is tilted.",
      "parts": ["hinge-pin"],
      "from": [60, 0, 0]
    }
  ]
}
```
