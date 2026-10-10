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
before it says it is done.

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

| Access | What Claude does |
|---|---|
| Full access | Never asks |
| Auto | Does what is routine and asks about the rest |
| Auto-accept edits | Edits files freely and asks before anything else |
| Supervised | Asks before it changes a file or runs anything |

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
