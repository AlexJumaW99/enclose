# Working with Claude

Claude is the Claude Code already on your machine, run through the
[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) in the project's folder.
The app has no login of its own, and keeps no credentials but a key you give it yourself
as a variable in the settings (Providers); if you need to sign in again, do it in Claude
Code. Cmd+B shows the conversation, and puts it away again.

## What Claude works on

Claude works on the project, and not on the app. What it makes for you is made in the
project's folder: the model, a reference scene, tools. It is told that Enclose itself is
not its to change, whoever asks: not its code or the files it keeps for projects to
copy, and not how its view, its panels or a tool's controls look and work. Asked for
that, it says so and offers what can be done in the project. The app is open source:
fork it to make it otherwise.

## What Claude is given

On top of what Claude Code can already do, the app gives Claude three tools: a
screenshot of the view as you see it, the list of parts with their groups and sizes, and
your current selection. It has two more for a project's own tools, the ones it makes for
you to work the model with: how they stand, with the error of one that did not load, and
a hand on one of their controls, so that it can try what it made and look at the model
before it says it is done. It has one that an [assembly guide](#assembly-guides) is
written with: Claude gives the guide, and the app checks it against the model and files
it. And it has one that begins [a new version](#asking-for-a-new-version) of the
project, when you ask for one.

## What Claude has just made

Parts that Claude adds to a model are shown coming. When the model it built is on
screen they are all light for a moment, where they stand; a light goes across them,
once, and leaves them as they are; and then the camera goes to them, as
[Space](selecting.md#on-its-own-close-to-out-of-sight) takes it to what is picked out.
What of them is behind another part shows more faintly. The first model a project has
comes like this all at once, and is framed whole as any model is when it opens.

It is only what is new that comes so: not a part that was changed, and not parts that
come back when [a change is taken back](#taking-a-change-back) or another conversation
is turned to. If the window was out of sight, it waits until the window is back. Under a
blueprint, and for a part that is not on show, nothing happens; and if your system is
set for less motion, the camera goes and nothing else.

## Assembly guides

**Assembly** (A) puts the model's assembly guides where the view was, as
[Blueprint](blueprints.md) puts its sheets there: A again, the button or Esc brings the
view back. The cards of the other projects close up meanwhile, as they do for the
sheets. A guide says how the thing is put together, a step at a time, for whoever has
its parts on the table. Claude writes it, and the app makes it a page.

### Asking for one

At the foot of the guides is **New assembly guide**, and where a model has no guide yet
the empty sheet in the middle of the view asks for one too. Claude looks at the parts, their
sizes and places, and at how the model is built, works out an order they can go on in,
and writes the steps: what is done in each, which parts it puts on and where they come
from, and what is needed to hand. With something picked out of the model before the
guides are turned to, the button offers a guide to that alone, how it is put together
and fitted, with **Whole model** beside it.

A guide goes down to the single part, and not to the model's groups: a step puts on one
kind of part, in one way. What is put together before it goes on, as a dot is pressed
into its ring or two gears go on the carrier they turn in, is a sub-assembly. It has
steps of its own, and then one that fits it. Only a thing that comes in one piece, like
a bought movement, goes on as one, however many parts the model has it as.

It is asked in the conversation, as a message would be. It can be asked for there in
words too, and changed the same way ("split step 3 in two"). While Claude is at it, the
foot of the view says how long it has been and what it is doing, with a button that
stops it. Writing a guide changes nothing in the model.

### The covers

Each guide has a cover, the one written last first. At its top left, small, is what it
is a guide to, the day it was written and how many steps and parts it has, and at its
top right which version it is. All of the sheet is a line drawing of the thing, which
Claude composes as an advertisement would show it: from the angle it looks its best,
and as big as fills the sheet with the parts that make it what it is, the rest running
off the sheet's edge. A guide written again is the next version, and the ones before
are kept.

Click a cover and the guide opens in your browser. The arrow over it saves it as a zip,
and the red button beside that moves the guide to the Trash, where it can be had back
from.

### The page

A guide is a page: the steps down the left, and the model beside them, drawn as the app
draws it and looked at as a blueprint is, from one of its corners and with no
perspective. A turn of the wheel, a swipe or an arrow key goes on one step, or back
one. The parts of each step come in and go on, lit, over the ones that are on already,
and going back takes the thing apart again. The model fills the window with what is on
so far: the first part is seen close to, and the view draws back as the rest go on. A
sub-assembly is shown alone while it is made up, filling the window, with what it is
called beside the step's number; then the rest comes back, and it goes on as one piece.
A part that goes on behind something shows through it faintly. The model is turned by
pulling it, moved across the window by pulling it with Shift held, and brought nearer
with a pinch. The round button at the top right puts it back as the page had it.

Before the first step the page says what is needed to hand, each thing with a small
picture of it: a hex key, glue, a clamp. Every guide says, and one for a thing that goes
together by hand alone says that.

Opened from the app, the page is served from your own machine and shows the model as it
is now: nothing is copied for it, and it is there for as long as the app is open. The
zip is what to send to someone or to put on a site: a folder with the page and the
parts it shows in it, which opens from its `index.html` with nothing else needed. It
has the model as it was when the zip was saved.

### Where they are kept

In `assembly/` at the top of the project, a small file to a guide
(`assembly/counter-stool-v1.json`), which names the model's parts and holds no copy of
them. So a guide follows the model: a part that has been changed is shown as it now is,
and one the model no longer has is left out, which the cover says. The files are the
project's own, so [each conversation has its own](#versions), and a turn that wrote one
can be [taken back](#taking-a-change-back). [`kit/assembly.md`](../kit/assembly.md)
says how a guide is written, and is what Claude reads before it writes one.

## Conversations

A project can have any number of conversations, and none of them is deleted while the
project is in the app. Its card is the one being carried on. A conversation left alone
for three days (the settings say how many) settles: it goes under the card with the
earlier ones, and the card offers a new session. The edge of the card that shows beneath
is what spreads them out, and any of them can be opened and carried on where it left
off. One thing at a time is done in a project's folder, so only one of them runs at
once.

A conversation goes by the first thing said in it, until it is given a name: click the
name at the top of the conversation and write another.

A card says the last of its conversation in two lines: what was asked, while Claude is
at work on it, and otherwise what was last said, which of a reply of Claude's is the
short part. A message too long for that is summed up in a few words by the quickest of
your Claude Code's models, which is given the message and nothing else. If Claude is at
work in a conversation under the card, the edge of the card says so.

## Versions

Each conversation has the project its own way. A new one begins from the model as it is
on screen, and what is done from there, by Claude or by you, is done to its version
alone: the conversation it began from keeps the model as it was left. Turn to a
conversation, on a project's card or under it, and the view shows the model as that
conversation left it, with the colours and groups you gave its parts there.

It is the project's folder that changes. There is one, and it holds the version of the
conversation you turned to last: when you turn to another, the app copies the folder
aside for the one you leave, and puts it as it was copied for the other. (On a Mac's own
disk a copy takes no room until one of the two is written to.) So what you open in
Finder or in an editor is the version on screen, and what you change there is that
conversation's. What is not the project's own is the same for all of them, and left
alone: `.git`, `node_modules`, a Python environment. Two versions are not brought
together: to have in one what another has, ask for it there.

The folder is not put another way while Claude is at work in it: turn to another
conversation meanwhile, and its model is shown when the turn is over. A folder with more
than 20,000 files in it, or 4 GB, is not copied aside, and has the one version.

The [settings](settings.md) switch this off (Versions). The conversations then all
change the one model, and turning to one changes nothing. The versions kept until then
stay as they were, for when it is switched on again.

### Asking for a new version

A new version can be asked for in words, in the conversation you are in: "try this as a
new version, with the seat 15 mm thicker". Claude changes nothing there. It sums up what
you asked for, and the foot of the conversation says **Creating a new version** while
its turn comes to an end, with a faint light going across the conversation behind what
is said in it. Then the app begins a new conversation, says in it what Claude
summed up as your own message, marked **New version**, and turns to it, with Claude
already at work. The pictures that came with your message go with it. Nothing else of
the conversation you asked in is known in the new one, which is answered as that one
was: by the same agent, with the same model, effort and access.

The conversation you asked in keeps the model as it was, and says that a new version
was created from there. What was waiting to be said in it waits to be sent by hand.

Stop Claude while the new version is being created, and none is. Claude begins one only
when asked. With versions switched off, or in a folder too big to have them, there is
none to begin: Claude says so, and changes nothing.

## Replies

What Claude says at the end of a turn is short: a sentence or two, since what it did is
already there in the view. It says what you could not tell by looking (something it
could not do, a guess that decided what you got, a question for you) and keeps the rest,
how it went about it and the sizes and clearances, under a Details line beneath the
reply, which opens as the steps above it do. A question is answered outright, at the
length it needs.

What Claude says on the way, between one step and the next, is not its answer: it shows
while Claude is at work and is then kept with the steps, under the line that says how
long it worked.

Claude is told to answer so, and sets the rest off in a `<details>` block for the app to
fold away; a reply with nothing set off is shown whole, as every earlier one is.

## Sizes

What Claude makes is drawn at the size it is to be made, so it is told where sizes come
from: what you said, what is already in the model, the standard for a thing that has one
(looked up, not made up), and only then what such a thing commonly measures. It says
which sizes decided the shape, and leads with any that were its own guess.

## Questions

Mostly Claude shows its guess and lets you correct it. Where a wrong guess would waste
the build (the thing has to fit something of yours whose size it cannot know, or what
you asked for could be quite different things) it asks first, in the conversation, one
question at a time: a few likely answers to click, and a line to write your own. A click
goes on to the next question, and the last one sends them all (a question that takes
several answers waits for Next); **Skip** leaves a
question to Claude, which goes by its best guess and says what it was. Whatever access
Claude has, what it asks is put to you: a question is no leave to do something.

## Model, effort and access

Under the message, one line says how it will be answered: "Using Opus 5.5, High, Full
access". Click it for the three choices behind it: which of Claude Code's models
answers, how hard it thinks, and what it may do without asking. The models are the ones
your Claude Code offers; "Default" leaves the model, and how hard it thinks, as Claude
Code is set.

Claude starts out with full access and never asks leave.

| Access            | What Claude does                                 |
| ----------------- | ------------------------------------------------ |
| Full access       | Never asks                                       |
| Auto              | Does what is routine and asks about the rest     |
| Auto-accept edits | Edits files freely and asks before anything else |
| Supervised        | Asks before it changes a file or runs anything   |

## Taking a change back

Cmd+Z takes back the last thing done to the model, and Cmd+Shift+Z puts it back. That is
a colour you gave a part, a group you made, broke up or renamed, or what Claude did in a
turn, whichever was done later; press it again for the one before.

What Claude did is taken back whole and at once, without asking it for anything and
without building anything: before each turn the app puts the project's files aside, and
keeps of them whatever the turn then wrote to, made or took away, the built model with
the rest. A turn you stopped part of the way is taken back like any other. The
conversation says that it was done, and Claude is told with your next message, so that
it does not go on as though its change were still there.

Nothing of Claude's is taken back while Claude is at work, or over a file that has been
changed since the turn, by you in an editor say: the app names the file that is in the way and
leaves all of it as it is. The last twelve turns that changed anything are kept for each
conversation, which are the ones Cmd+Z takes back in [its version](#versions) of the
project; with versions switched off, for each project. What is not the project's own is
left out, and left alone: `.git`,
`node_modules`, a Python environment. A folder with more than 20,000 files in it, or
4 GB, is not put aside at all, and nothing Claude does in it can be taken back.

In a box you are writing in, Cmd+Z is the writing's for as long as there is any; in an
empty one, as the message box is after a message is sent, it is the model's.

## Other agents

Claude is the one the app is made round, but not the only one it can put a message to.
Codex and Grok answer as well, each its maker's command-line agent, installed on your
machine and signed in there, once it is switched on: only Claude is on to begin with.
The [settings](settings.md) show which of them the app found (Providers), switch each on
or off, and hold what each is started with. Grok cannot see
[pictures](messages.md#pictures).

The marks of all three are in a row over the [three choices](#model-effort-and-access)
under the message. Click one and the next conversation is had with that agent, with its
models to choose from. A conversation under way is carried on by the agent it began
with, so there another's mark begins a new one, [from the model as it is](#versions),
and keeps what you were writing. A mark drawn grey cannot be picked, and says why with
the pointer on it: the agent is switched off, or was not found on the machine.
