// The clock's tool: it sets the time the hands show, and runs the movement.
//
// The wheels turn by the numbers of their teeth (model.py), so their teeth stay in
// mesh. For each hour the centre wheel goes round once, and with it the minute hand and
// the knob at the back; the barrel that drives it an eighth of a turn the other way; the
// third wheel eight times, the fourth sixty and the escape wheel 480; and in front of
// the plates the hour wheel a twelfth of a turn.
//
// At the clock's own pace it goes as a clock does, in steps: the balance swings twice a
// second, and each time it passes the middle the pallet fork lets one tooth of the
// escape wheel by, which lets the whole train on. Four beats a second. Run faster than
// that, the train goes smoothly and the balance is left swinging at its own pace, to
// be watched.

// Where each arbor is, in mm: model.py prints these when it builds.
const CENTRE = [0, 0, 82]
const THIRD = [21.515, 0, 65.688]
const FOURTH = [0, 0, 52]
const BARREL = [0, 0, 109.75]
const ESCAPE = [-14.8, 0, 46.613]
const PALLET = [-19.808, 0, 56.966]
const BALANCE = [-28.991, 0, 53.009]
const STUD = [-16.971, 0, 98.971]

// How many times each part goes round in an hour: clockwise, seen from the front.
const TURNING = [
  { part: "barrel", about: BARREL, perHour: -8 / 66 },
  { part: "centre-wheel", about: CENTRE, perHour: 1 },
  { part: "minute-hand", about: CENTRE, perHour: 1 },
  { part: "setting-knob", about: CENTRE, perHour: 1 },
  { part: "third-wheel", about: THIRD, perHour: -64 / 8 },
  { part: "fourth-wheel", about: FOURTH, perHour: 60 },
  { part: "seconds-hand", about: FOURTH, perHour: 60 },
  { part: "escape-wheel", about: ESCAPE, perHour: (-60 * 56) / 7 },
  { part: "minute-wheel", about: STUD, perHour: -12 / 36 },
  { part: "hour-wheel", about: CENTRE, perHour: 1 / 12 },
  { part: "hour-hand", about: CENTRE, perHour: 1 / 12 },
]

// The escapement: how many beats to the second, how far the fork rocks either way and
// the balance swings (degrees), and how much of a beat the fork takes to cross.
const BEATS = 4
const FORK = 7
const SWING = 150
const CROSSING = 0.3

const HALF_DAY = 12 * 60 * 60
// what the model is built showing, in seconds past twelve: ten past ten
const BUILT = 10 * 3600 + 10 * 60
const RUNNING = { back: -1, paused: 0, forward: 1 }

/** The time shown, in seconds past twelve. Null until the first frame. */
let time = null
/** How long the balance has been swinging while the hands were run fast, in seconds. */
let swung = 0

/** From nought to one, starting and ending gently. */
const eased = (part) => part * part * (3 - 2 * part)

const two = (n) => String(Math.floor(n)).padStart(2, "0")
const worded = (seconds) =>
  `${Math.floor(seconds / 3600) || 12}:${two((seconds / 60) % 60)}:${two(seconds % 60)}`

function computerTime() {
  const now = new Date()
  return (
    (now.getHours() % 12) * 3600 +
    now.getMinutes() * 60 +
    now.getSeconds() +
    now.getMilliseconds() / 1000
  )
}

export default {
  name: "Clock",
  controls: {
    shown: {
      kind: "readout",
      title: "Time",
      description: "What the hands show.",
    },
    set: {
      kind: "slider",
      title: "Set",
      description: "Drag to move the hands.",
      min: 0,
      max: 12 * 60 - 1,
      step: 1,
      value: BUILT / 60,
      format: (minutes) =>
        `${Math.floor(minutes / 60) || 12}:${two(minutes % 60)}`,
      change(minutes, tool) {
        time = minutes * 60
        tool.values.follow = false
      },
    },
    run: {
      kind: "choice",
      title: "Run",
      description: "Run it, pause it or wind it back.",
      options: [
        { id: "back", icon: "rewind" },
        { id: "paused", icon: "pause" },
        { id: "forward", icon: "play" },
      ],
      value: "paused",
      change(_, tool) {
        tool.values.follow = false
      },
    },
    speed: {
      kind: "choice",
      title: "Speed",
      description: "How fast it runs.",
      options: [
        { id: "1", label: "1×" },
        { id: "60", label: "60×" },
        { id: "600", label: "600×" },
      ],
      value: "60",
      change(_, tool) {
        tool.values.follow = false
      },
    },
    follow: {
      kind: "toggle",
      title: "Computer time",
      description: "Keep to this computer’s clock.",
      value: false,
    },
    jump: {
      kind: "buttons",
      title: "Jump",
      description: "Go straight to an hour.",
      options: [
        { id: "0", label: "12:00" },
        { id: "3", label: "3:00" },
        { id: "6", label: "6:00" },
        { id: "9", label: "9:00" },
      ],
      press(hour, tool) {
        time = Number(hour) * 3600
        tool.values.follow = false
      },
    },
  },

  frame(tool) {
    // (started again, it goes on from where its slider was left)
    if (time === null) time = tool.values.set * 60
    if (tool.values.follow) time = computerTime()
    else time += RUNNING[tool.values.run] * Number(tool.values.speed) * tool.dt
    time = ((time % HALF_DAY) + HALF_DAY) % HALF_DAY

    tool.values.shown = worded(time)
    tool.values.set = Math.floor(time / 60)

    // which beat it is on, and how far through it
    const ownPace = tool.values.follow || tool.values.speed === "1"
    const running = tool.values.follow || tool.values.run !== "paused"
    if (!ownPace && running) swung += tool.dt
    const beats = (ownPace ? time : swung) * BEATS
    const beat = Math.floor(beats)
    const crossed = eased(Math.min(1, (beats - beat) / CROSSING))
    // at its own pace the train goes on a step at each beat, as the fork lets it
    const going = ownPace ? (beat + crossed) / BEATS : time

    // a turn about +Y is clockwise seen from the front, which is the way a clock goes
    const hours = (going - BUILT) / 3600
    for (const { part, about, perHour } of TURNING)
      tool.part(part).turn({ by: hours * perHour * 360, axis: "y", about })

    // the fork lies to one side and then the other, and the balance swings through
    // the middle as it goes over
    const side = beat % 2 === 0 ? 1 : -1
    tool
      .part("pallet-fork")
      .turn({ by: side * FORK * (2 * crossed - 1), axis: "y", about: PALLET })
    tool.part("balance").turn({
      by: SWING * Math.sin(Math.PI * beats),
      axis: "y",
      about: BALANCE,
    })
  },
}
