// What the app's window on the page is filled with: the projects of someone who has
// had the app for months, and the conversation about the one that is open.

/** The window as it is drawn, in px, before the page scales it. */
export const WINDOW = { width: 1720, height: 1000, thread: 460 }

export type Conversation = {
  title: string
  /** when it was last carried on, as the app says it: "12h", "3d" */
  when: string
  said: string
}

export type Project = {
  id: string
  name: string
  when?: string
  said: string
  /** the branch its folder is on, where the folder is kept in git */
  branch?: string
  /** what there is to say of its conversation, in place of when it was */
  news?: 'working' | 'asking' | 'done'
  /** conversations had before, under its card */
  under?: Conversation[]
  /** not there when the page opens: one of those the scroll brings in */
  later?: boolean
}

export const OPEN = 'arm'

export const PROJECTS: Project[] = [
  {
    id: 'clock',
    name: 'Table clock',
    when: '12h',
    said: 'The base is white now; I left the feet under it dark.',
    under: [
      {
        title: 'What is this for? Maybe remove it',
        when: '12h',
        said: 'Assistant reports removed Spring readout, Wind slider and the barrel’s click.',
      },
      {
        title: 'Thinner bezel',
        when: '6d',
        said: 'The bezel is 2 mm across now, and the glass sits flush with it.',
      },
      {
        title: 'Count the teeth',
        when: '23d',
        said: 'Every wheel has the teeth a real movement gives it, barrel to balance.',
      },
    ],
  },
  {
    id: 'mount',
    name: 'Bike light mount',
    said: 'Reworking the clamp for a 31.8 mm bar.',
    news: 'working',
    later: true,
  },
  {
    id: 'lamp',
    name: 'Clip lamp',
    when: '2d',
    said: 'The shade tips 40° either way now, and the wire has the slack for it.',
    branch: 'wider-clip',
  },
  {
    id: 'arm',
    name: 'Robot arm',
    when: '12h',
    said: 'Assistant reports new Routine tab: arm mimes activities over an empty table.',
  },
  {
    id: 'stool',
    name: 'Counter stool',
    when: '3d',
    said: 'The seat is 650 mm up now, the height counters are sold at.',
    later: true,
  },
  {
    id: 'enclosure',
    name: 'Sensor enclosure',
    said: 'Which side should the USB-C port come out of?',
    news: 'asking',
    later: true,
  },
  {
    id: 'pillbox',
    name: 'Pill box',
    when: '41d',
    said: 'Seven lids, each on its own hinge pin, and a catch that clicks.',
    later: true,
  },
]

export type Item =
  | { kind: 'said'; text: string; part?: string }
  | { kind: 'worked'; took: string }
  | { kind: 'reply'; text: string; details?: boolean }

export const TITLE =
  'Let’s add a new tool to this project where the robot simulates a number of coordinated activities'

/** The conversation about the arm, from the day its file was opened. */
export const THREAD: Item[] = [
  { kind: 'said', text: 'What do you make of this file?' },
  { kind: 'worked', took: '2m 4s' },
  {
    kind: 'reply',
    text: 'It is the SO-101, an open-source arm with six joints: a base, a shoulder, an upper and a lower arm, a wrist, and a gripper with one jaw that moves. I named its 136 parts and grouped them by the link each one rides on.',
  },
  { kind: 'said', part: 'Jaw', text: 'How far can this open?' },
  { kind: 'worked', took: '48s' },
  {
    kind: 'reply',
    text: 'It is built 20° open. Its joint has room to go to 105° before the horn meets the gripper’s body.',
  },
  {
    kind: 'said',
    text: 'Make a tool that steers each joint with a slider, and a few poses to send it to.',
  },
  { kind: 'worked', took: '5m 31s' },
  {
    kind: 'reply',
    text: 'There is an Arm tab in the Tools panel: a slider for each joint, and Rest, Ready and Reach take the arm to a pose. The cables are drawn where they lie at rest, so I put them out of sight while the arm is moved.',
    details: true,
  },
  {
    kind: 'said',
    text: 'Let’s add a new tool to this project where the robot simulates a number of coordinated activities. Add a slider for the number of activities from 3 to 10',
  },
  { kind: 'worked', took: '7m 16s' },
  {
    kind: 'reply',
    text: 'There is a new Routine tab in the Tools panel, running now: the arm works through a list of activities in a loop, and the Activities slider (3 to 10) sets how many of them it does. I took "activities" to mean things like waving, pick and place, and stirring. The model has nothing for the arm to hold, so it mimes them over an empty table.',
    details: true,
  },
]

/** What is written in the message box as the page is scrolled, and sent. */
export const TYPED = { part: 'Jaw', text: 'Make the fingers 6 mm longer' }

export const PLACEHOLDER = 'Ask anything, @tag parts, $use skills or / for commands'

/** The buttons down the edge of the view, in the app's order, with their keys. */
export const SWITCHES = [
  { id: 'parts', label: 'Parts', key: 'P' },
  { id: 'grid', label: 'Grid', key: '⇧G' },
  { id: 'section', label: 'Section', key: 'S' },
  { id: 'explode', label: 'Explode', key: 'E' },
  { id: 'reference', label: 'Reference', key: '⌘/' },
  { id: 'blueprint', label: 'Blueprint', key: 'B' },
  { id: 'search', label: 'Search', key: '⌘F' },
  { id: 'tools', label: 'Tools', key: 'T' },
] as const

export type SwitchId = (typeof SWITCHES)[number]['id']

/** What the arm mimes, in the order its routine goes through them. */
export const ACTIVITIES = [
  'Waving',
  'Pick and place',
  'Stirring',
  'Pouring',
  'Sorting',
  'Wiping',
  'Stacking',
  'Pointing',
  'Drawing a circle',
  'Taking a bow',
]

/** The sheets shown of the ten the app draws, by their files in public/blueprint. */
export const SHEETS = [
  { name: 'Top Left', file: 'top-left.svg' },
  { name: 'Top Right', file: 'top-right.svg' },
  { name: 'Front', file: 'front.svg' },
  { name: 'Top', file: 'top.svg' },
  { name: 'Right', file: 'right.svg' },
]
