// The pictures that stand for what a guide says is needed to hand: a hex key, a tube of
// glue, a clamp. Each is a few lines on a square of twenty-four, drawn as the app's own
// icons are, a line and a half wide with round ends, so that they sit with the model
// beside them. A guide says which picture a thing has; where it does not, the page makes
// it out from what the thing is called, and failing that gives it a plain ring.
import { NEED_ICONS, type NeedIcon } from "@shared/assembly-format"

/**
 * A picture there is, or the ring that stands for a thing with none. And two that are of
 * nothing needed: the arrow going back round, which is on what puts the view back, and
 * the lamp that stands beside a tip.
 */
export type Icon = NeedIcon | "thing" | "again" | "lamp"

/** Each picture as the lines it is drawn with, on a square of 24. */
const LINES: Record<Icon, string[]> = {
  // an L of hexagonal bar, with its elbow rounded
  "hex-key": ["M7 3h3.5v10.5a2 2 0 0 0 2 2H21V19h-8.5A5.5 5.5 0 0 1 7 13.5z"],
  // its handle, and the shaft out of the end of it
  screwdriver: ["M17.5 3.5l3 3-6.5 6.5-3-3z", "M12.5 11.5L4 20"],
  // an open-ended spanner, jaws up
  wrench: [
    "M20.5 6.5a5 5 0 0 1-6.6 6.1L7 19.5a1.8 1.8 0 0 1-2.5-2.5l6.9-6.9a5 5 0 0 1 6.1-6.6l-3 3 .5 2.5 2.5.5z",
  ],
  // two jaws, the pin they turn on, and two handles
  pliers: [
    "M8.5 3.5l2.8 7",
    "M15.5 3.5l-2.8 7",
    "M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0",
    "M11 13.5C9.6 16 8.2 18.3 7 21",
    "M13 13.5c1.4 2.5 2.8 4.8 4 7.5",
  ],
  // a mallet: its head, and the handle under it
  hammer: [
    "M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z",
    "M12 11v10",
  ],
  // a bottle with a nozzle, and the band of its label
  glue: [
    "M8 11h8v8.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19.5z",
    "M10 11V8.5L12 3l2 5.5V11",
    "M8 15h8",
  ],
  // a roll, with the end of it pulled out
  tape: [
    "M3 12a7 7 0 1 0 14 0a7 7 0 1 0-14 0",
    "M7.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
    "M10 19h11",
  ],
  scissors: [
    "M3.5 7a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
    "M3.5 17a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
    "M8.2 8.4L20 18",
    "M8.2 15.6L20 6",
  ],
  // a craft knife: its handle, and the blade out of the end of it
  knife: ["M4 15l10-6.5 2.5 4-10 6.5z", "M14 8.5l6-3-3.5 7"],
  // its body, its chuck and bit, and the grip under it
  drill: [
    "M3 6h11a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3z",
    "M16 7.5h2.5v3H16",
    "M18.5 9H22",
    "M6 12l-1.5 8h5L11 12",
  ],
  // its handle, its tip, and the heat coming off that
  "soldering-iron": [
    "M17.5 3L21 6.5l-8 8L9.5 11z",
    "M11.2 12.8L4 20",
    "M3.5 14.5c1-.8 1-2.2 0-3",
    "M7 12c1-.8 1-2.2 0-3",
  ],
  // a rule, with its marks along one edge
  ruler: [
    "M3.5 8h17a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z",
    "M6.5 8v3",
    "M10.2 8v2",
    "M13.8 8v3",
    "M17.5 8v2",
  ],
  // a G clamp: its frame, its anvil, and the screw that closes on that
  clamp: [
    "M16 4H9a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h7",
    "M16 4v2.5",
    "M16 22v-8.5",
    "M14 13.5h4",
    "M13.5 22h5",
  ],
  // a cloth hung by its top edge, its foot in folds
  cloth: [
    "M5 5h14v11c-1.5 1.5-3 1.5-4.7 0-1.6-1.5-3.1-1.5-4.6 0-1.6 1.5-3.1 1.5-4.7 0z",
    "M5 8.5h14",
  ],
  pencil: [
    "M4 20l1.2-4.6L16.5 4.1a1.5 1.5 0 0 1 2.1 0l1.3 1.3a1.5 1.5 0 0 1 0 2.1L8.6 18.8z",
    "M14.5 6l3.5 3.5",
  ],
  // a box, seen from one of its corners
  box: ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M4 7.5l8 4.5 8-4.5", "M12 12v9"],
  // its head, its shank, and three turns of its thread
  screw: [
    "M7.5 4h9L15 7.5H9z",
    "M12 7.5V21",
    "M9.5 11l5-1.5",
    "M9.5 14l5-1.5",
    "M9.5 17l5-1.5",
  ],
  battery: [
    "M4 8.5A1.5 1.5 0 0 1 5.5 7h11A1.5 1.5 0 0 1 18 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 15.5z",
    "M20.5 10.5v3",
    "M7.5 10.5v3",
  ],
  // someone to hold the other end
  helper: [
    "M8.5 7.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0",
    "M5 20.5a7 7 0 0 1 14 0",
  ],
  thing: ["M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0"],
  // a light bulb: its glass, down to the neck, and the cap under it
  lamp: [
    "M9 17.5v-1.2c0-1-.5-1.9-1.3-2.6a6 6 0 1 1 8.6 0c-.8.7-1.3 1.6-1.3 2.6v1.2z",
    "M10 20.5h4",
  ],
  // most of a ring, gone round against the clock, and the head of its arrow
  again: ["M3.5 12a8.5 8.5 0 1 0 2.7-6.2L3.5 8.3", "M3.5 3.5v4.8h4.8"],
}

/**
 * What a thing is called, as the picture it most likely is: the first of these that it
 * reads as. A thing measured with is looked for before tape, and a hex key before
 * anything else that turns a screw.
 */
const READS_AS: [RegExp, NeedIcon][] = [
  [/\b(hex|allen)\b/, "hex-key"],
  [/measur|ruler|\brule\b|calip|\bsquare\b|spirit level/, "ruler"],
  [/screwdriver|phillips|pozi|torx|slotted|flat[- ]?head/, "screwdriver"],
  [/spanner|wrench|socket|ratchet/, "wrench"],
  [/plier|cutters|snips|nippers|tweezer/, "pliers"],
  [/hammer|mallet/, "hammer"],
  [
    /glue|adhesive|epoxy|cement|thread ?lock|sealant|silicone|grease|\boil\b/,
    "glue",
  ],
  [/\btape\b/, "tape"],
  [/scissor/, "scissors"],
  [/knife|blade|scalpel|deburr/, "knife"],
  [/drill/, "drill"],
  [/solder/, "soldering-iron"],
  [/clamp|\bvi[cs]e\b|strap/, "clamp"],
  [/cloth|blanket|towel|\brag\b|sandpaper|paper/, "cloth"],
  [/pencil|marker|\bpen\b/, "pencil"],
  [/screw|bolt|\bnuts?\b|washer|insert|rivet|\bnails?\b/, "screw"],
  [/batter/, "battery"],
  [/person|people|helper|pair of hands/, "helper"],
  [/\bbox\b|books?\b|block|stand\b|support|\bjig\b/, "box"],
]

/** The picture a thing has: the one its guide gives it, or the one its name reads as. */
export function iconFor(
  name: string,
  given: string | null
): NeedIcon | "thing" {
  if (given && (NEED_ICONS as readonly string[]).includes(given))
    return given as NeedIcon
  const called = name.toLowerCase()
  return READS_AS.find(([reads]) => reads.test(called))?.[1] ?? "thing"
}

const SVG = "http://www.w3.org/2000/svg"

/** A picture as something to put in the page: it is drawn in whatever colour the words round it are. */
export function drawn(icon: Icon): SVGSVGElement {
  const picture = document.createElementNS(SVG, "svg")
  picture.setAttribute("viewBox", "0 0 24 24")
  picture.setAttribute("aria-hidden", "true")
  for (const line of LINES[icon]) {
    const path = document.createElementNS(SVG, "path")
    path.setAttribute("d", line)
    picture.append(path)
  }
  return picture
}
