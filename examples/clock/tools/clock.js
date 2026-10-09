// The clock's tool: it sets the time the hands show, and runs the movement.
//
// The wheels turn by the numbers of their teeth (model.py), so their teeth stay in
// mesh: for each hour the centre wheel goes round once, the third wheel eight times the
// other way, the fourth sixty times, and the hour wheel a twelfth of a turn.

// Where each arbor is, in mm: model.py prints these when it builds.
const CENTRE = [0, 0, 72]
const THIRD = [21.515, 0, 55.688]
const FOURTH = [0, 0, 42]
const STUD = [-16.971, 0, 88.971]

// How many times each part goes round in an hour: clockwise, seen from the front.
const TURNING = [
  { part: "centre-wheel", about: CENTRE, perHour: 1 },
  { part: "minute-hand", about: CENTRE, perHour: 1 },
  { part: "third-wheel", about: THIRD, perHour: -64 / 8 },
  { part: "fourth-wheel", about: FOURTH, perHour: 60 },
  { part: "seconds-hand", about: FOURTH, perHour: 60 },
  { part: "minute-wheel", about: STUD, perHour: -12 / 36 },
  { part: "hour-wheel", about: CENTRE, perHour: 1 / 12 },
  { part: "hour-hand", about: CENTRE, perHour: 1 / 12 },
]

const HALF_DAY = 12 * 60 * 60
// what the model is built showing, in seconds past twelve: ten past ten
const BUILT = 10 * 3600 + 10 * 60
const RUNNING = { back: -1, paused: 0, forward: 1 }

/** The time shown, in seconds past twelve. Null until the first frame. */
let time = null

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
      format: (minutes) => `${Math.floor(minutes / 60) || 12}:${two(minutes % 60)}`,
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

    // a turn about +Y is clockwise seen from the front, which is the way a clock goes
    const hours = (time - BUILT) / 3600
    for (const { part, about, perHour } of TURNING)
      tool.part(part).turn({ by: hours * perHour * 360, axis: "y", about })
  },
}
