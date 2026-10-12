# Assembly guides

A project in Enclose can have assembly guides: how the thing that is modelled is put
together, a step at a time, for someone who has its parts on the table and has never
seen it before. The user asks for one in the app's Assembly view, or in a message.

You write the guide and the app makes the page. The page shows the model's own parts,
as they are built, beside the steps: as the reader goes down the steps, the parts of
each step come in from where you say and go on, lit, over the ones that are on already.
So a guide is only words and the ids of parts. It holds no geometry and no HTML, and it
changes nothing in the model.

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
2. **Find what everything is fitted to.** Most things have one part the rest goes on:
   a base, a chassis, the bottom half of a case. That is the first step. Where the
   thing is built upside down or on its side, start with the part that lies on the
   table then.
3. **Order the rest by what gets in the way of what.** A part that is shut in goes on
   before whatever shuts it in. What is inside goes in before the outside closes. What
   is screwed down goes on before what covers its screws. Where the order does not
   matter, go from large to small, and do what is done from one side before turning
   the thing over.
4. **Check every step as a hand would do it.** With only the parts of the steps before
   on the table: is there a way in for this part, in a straight line, with nothing in
   it? That line is the step's `from`. Once on, what holds it there: a screw, a snap,
   its own weight? If nothing does until a later step, say what to do meanwhile ("hold
   it there", "keep the case on its back").
5. **Look for what cannot be done.** A model is drawn put together, and may never have
   been taken apart in anyone's head: a part with no way in, a screw whose head is
   covered, nothing that holds a part where it sits. Do not write a step that cannot be
   done as if it could. Write the guide for what there is, and tell the user in your
   reply what is in the way. Change the model only if they ask.

## Steps

A step is one thing a person does in one go, with the parts it puts on.

- **Parts that are alike and go on alike are one step**: the four legs, the six cover
  screws. Parts that go on in different ways are different steps.
- **Fasteners go with what they fasten** when they go in at once ("set the lid on and
  fix it with the four screws"), and are a step of their own when something is lined up
  or held first.
- **A step can put on nothing.** Turning the thing over, or checking that something
  turns freely, is a step with no parts.
- **Every part goes on in one step.** A guide to the whole thing leaves no part out:
  the app tells you which you missed.
- Most things take three to ten steps. Do not split one action in two to have more,
  and do not make one step of a dozen parts that go on in different ways.

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
"Do not tighten these yet: the legs need the play." Most steps have none.

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

`view` turns the model so the step can be seen: the way from the model to the eye, as
`[x, y, z]` in the same frame. Only its direction counts.

    [1, -1, 0.8]    from the front right, a little above: how a model opens
    [-1, -1, 0.8]   from the front left
    [1, -1, -0.7]   from the front right, from below
    [0, 0, 1]       straight down from above

The page does not turn the thing over: it stays as it is built. So where a step is
done with the thing upside down, say so in the text ("turn it over") and give a `view`
from below, so the reader sees the side they are working on. Left out, the view stays
where the step before had it. Give one whenever what goes on would be hidden from
there, and do not swing the view about for no reason.

## The rest of a guide

- `title`: what the guide is to. For the whole thing, what the model is called
  ("Counter stool"); the page writes "Assembly Guide" under it.
- `summary`: a line or two for the top. What is being put together, and anything to
  know before starting: how long it takes, that it needs two people, a soft surface.
- `needs`: what is needed that is no part of the model, each in a few words. Tools
  with their sizes ("3 mm hex key"), glue, thread lock, and anything to buy that the
  model does not have as a part. Leave it out if nothing is needed.
- `already`: only for a guide to part of the model (below).

Sizes come from the model and its script, or from the standard for a thing that has
one. Do not make one up: a tool size you had to guess is said as a guess in your reply.

## A guide to part of the model

Asked for a guide to one thing in the model (a sub-assembly, or how one part is
fitted), write it for that alone:

- `title` is that thing: "Footrest".
- The steps put on its parts and no others.
- `already` names the parts it is fitted to, by id, where the reader needs to see
  them: they are shown from the start, in place, and no step puts them on. Keep it to
  what the thing touches, not the whole model.

## Giving it

Give the whole guide in one call. If the app rejects it, it says why in words (an id
the model does not have, a part put on twice): put that right and give it again. If
it says parts were left out and the guide is to the whole thing, add them. Giving it
again in the same turn replaces what you gave before; in a later turn it is filed as
the next version, and the earlier ones are kept for the user to go back to.

You cannot see the page. Check the guide against the parts instead: read down your
steps with the list of parts beside you, and see that each part is in one step, that
each `from` points away from what is already on, and that nothing goes on after the
thing that shuts it in.

Then reply to the user, shortly: that the guide is in the Assembly view, and what in
it you were not sure of.

## An example

```json
{
  "title": "Desk lamp",
  "summary": "A lamp with a weighted base and a shade that tilts. It goes together in about ten minutes.",
  "needs": ["2.5 mm hex key", "Phillips screwdriver, PH1"],
  "steps": [
    {
      "title": "Start with the base",
      "text": "Lay the base plate on the table with its felt side down. The post and the weight both go on to it.",
      "parts": ["base-plate"],
      "view": [1, -1, 0.8]
    },
    {
      "title": "Drop in the weight",
      "text": "Lower the steel weight into the recess in the base plate, with its flat side up. It sits loose until the cover goes on.",
      "parts": ["weight"],
      "from": [0, 0, 50]
    },
    {
      "title": "Fix the cover",
      "text": "Set the base cover over the weight so that the cable slot faces the back. Fix it from above with the three M3 × 10 screws, using the 2.5 mm hex key.",
      "parts": ["base-cover", "cover-screws"],
      "from": [0, 0, 70],
      "tip": "Turn each screw in a little before tightening any of them, so the cover settles flat."
    },
    {
      "title": "Screw in the post",
      "text": "Feed the cable down through the hole in the cover, then turn the post into the thread by hand until it is firm.",
      "parts": ["post"],
      "from": [0, 0, 180]
    },
    {
      "title": "Hang the shade",
      "text": "Hold the shade against the head of the post with the hinge pin lined up, and push the pin through from the right. Tighten its screw with the screwdriver until the shade stays where it is tilted.",
      "parts": ["shade", "hinge-pin"],
      "from": [60, 0, 0],
      "view": [1, -0.6, 0.5]
    }
  ]
}
```
