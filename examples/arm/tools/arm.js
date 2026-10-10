// The arm's tool: it steers the arm joint by joint, and takes it to a pose.
//
// The controls say where each joint is to be, and the arm goes there as an arm does:
// every joint off from rest gently and gently to rest again, all of them arriving
// together however far each has to go (tool.glide). Sent to a pose it takes its time;
// under a hand on a slider it follows closely.
//
// An arm is a chain (model.py): base, shoulder, upper arm, lower arm, wrist, gripper,
// jaw. Each link is a group of the model, and each joint turns its link and every link
// further out. So a frame starts at the jaw and works inwards: the jaw is turned about
// its own joint, then jaw and gripper about the gripper's, and so on down to the base.
//
// The model is built at rest, folded: the upper arm lying back, the lower arm forward
// over it, the jaw a little way open. Every control starts there, and says how far its
// joint is from there.

// Where each joint is as built, and the line it turns about, in mm: model.py prints
// these when it builds, from the round of each servo's horn. `way` makes the control's
// "more" the way that is said beside it.
const JOINTS = [
  // seen from above, anticlockwise
  { id: "turn", link: "shoulder", about: [-0.099, -7.543, 62.43], axis: [0, -0.0087, 1], way: 1 },
  // up from lying back, and on over to the front
  { id: "shoulder", link: "upper-arm", about: [-13.654, -38.86, 119.757], axis: [-1, -0.0087, -0.0001], way: -1 },
  // open, from folded on the upper arm
  { id: "elbow", link: "lower-arm", about: [-12.143, 73.581, 148.473], axis: [-0.9999, -0.0086, -0.0088], way: 1 },
  // up
  { id: "wrist", link: "wrist", about: [-10.061, -60.577, 152.295], axis: [-0.9998, 0.0002, -0.0175], way: 1 },
  { id: "roll", link: "gripper", about: [7.062, -118.775, 152.082], axis: [0, -1, -0.0088], way: 1 },
  // shut: the control says how far it is open, so this is how far it is from built
  { id: "grip", link: "jaw", about: [22.765, -145.704, 172.057], axis: [1, -0.0001, 0.0087], way: 1 },
]
// the links from the shoulder out: a joint turns its own and all after it
const CHAIN = JOINTS.map((joint) => joint.link)

// How far open the jaw is as built, and how far it goes, in degrees from shut: model.py
// prints the first.
const BUILT = 20
const OPEN = 105

// The poses it goes to, by how each control stands.
const POSES = {
  rest: { turn: 0, shoulder: 0, elbow: 0, wrist: 0, roll: 0, grip: BUILT },
  ready: { turn: 0, shoulder: 90, elbow: 90, wrist: 0, roll: 0, grip: BUILT },
  reach: { turn: 35, shoulder: 140, elbow: 150, wrist: 20, roll: 0, grip: 70 },
}
// How long the arm takes to get where its controls say, in seconds: to a pose, and
// after a joint moved by hand.
const TO_POSE = 1.6
const BY_HAND = 0.3

/** How long it is taking just now: a pose's time, until a joint is moved by hand. */
let taking = BY_HAND

const degrees = (value) => `${Math.round(value)}°`
/** A joint's control: moved by hand, the arm follows the hand again. */
const joint = (title, description, min, max, value = 0) => ({
  kind: "slider",
  title,
  description,
  min,
  max,
  step: 1,
  value,
  format: degrees,
  change() {
    taking = BY_HAND
  },
})

export default {
  name: "Arm",
  controls: {
    pose: {
      kind: "buttons",
      title: "Pose",
      description: "Take the arm to a pose.",
      options: [
        { id: "rest", label: "Rest" },
        { id: "ready", label: "Ready" },
        { id: "reach", label: "Reach" },
      ],
      press(id, tool) {
        // the controls go to the pose at once, and the arm after them
        for (const joint in POSES[id]) tool.values[joint] = POSES[id][joint]
        taking = TO_POSE
      },
    },
    turn: joint("Turn", "Swings the arm round on its base.", -110, 110),
    shoulder: joint("Shoulder", "Lifts the upper arm.", 0, 190),
    elbow: joint("Elbow", "Opens the lower arm.", 0, 180),
    wrist: joint("Wrist", "Tips the gripper up or down.", -95, 95),
    roll: joint("Roll", "Turns the gripper about its length.", -160, 160),
    grip: joint("Grip", "How far the jaw is open.", 0, OPEN, BUILT),
  },

  frame(tool) {
    // from the jaw inwards: each joint turns its link and all that it carries
    let moved = false
    for (let n = JOINTS.length - 1; n >= 0; n--) {
      const { id, about, axis, way } = JOINTS[n]
      // where the joint has got to, on its way to where its control says
      const at = tool.glide(id, tool.values[id], taking)
      const from = id === "grip" ? BUILT - at : at
      if (Math.abs(from) < 0.001) continue
      moved = true
      for (const link of CHAIN.slice(n))
        tool.group(link).turn({ by: way * from, axis, about })
    }

    // the cables are drawn as they lie at rest, from one link to the next: moved, the
    // arm would leave them behind
    if (moved) tool.group("cables").hide()
  },
}
