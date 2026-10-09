import { cn } from "cn"

/** A theme the window can be drawn in. */
type Drawn = "light" | "dark"

/** What a model is drawn in, which is the same whatever the theme. */
const MODEL = {
  top: "#d8d8d6",
  left: "#bfbebc",
  right: "#b3b2b0",
  edge: "#0e1012",
}
/** Parts of it that have been given colours of their own. */
const PARTS = [
  { cx: 127.7, cy: 77.6, fill: "#d9a5a3" },
  { cx: 139, cy: 69.8, fill: "#a9b5d6" },
  { cx: 149.1, cy: 62.6, fill: "#c3d9c3" },
]

/** A button floating over the view, and one that is on. */
const ROUND = "fill-background/60 stroke-foreground/15"
const LIT = "fill-primary"
/** A line of writing, too small to be read: what is said, and what is said of it. */
const SAID = "fill-foreground/60"
const QUIET = "fill-muted-foreground/60"

/** How the model is looked at: the buttons half way down the view's right-hand edge. */
const LOOKS = [81.5, 90.5, 99.5, 108.5, 117.5, 126.5]
/** Where the picture is split, when it is of two themes: half way across. */
const SPLIT = 160

/**
 * The window in small, as a theme draws it: the view with a model in it, the projects'
 * cards and the buttons over it, and the conversation beside it. Each half of it stands
 * inside the class that sets a theme's colours and is drawn in nothing but those, so it
 * shows a theme whether or not the app is in it. `system` is light on the left and dark
 * on the right, the model whole across the two.
 */
export function Miniature({
  theme,
  className,
}: {
  theme: Drawn | "system"
  className?: string
}) {
  const left: Drawn = theme === "dark" ? "dark" : "light"
  const right: Drawn = theme === "light" ? "light" : "dark"
  return (
    <svg
      viewBox="0 0 320 208"
      aria-hidden
      strokeWidth={1}
      // lines are a pixel wide however small the picture is
      className={cn(
        "block w-full **:[vector-effect:non-scaling-stroke]",
        className
      )}
    >
      <g className={left}>
        {/* the view: all of it, so that the other half is drawn over this one and no
            gap shows between two halves that are the same */}
        <rect width="236" height="208" className="fill-sidebar" />

        {/* the projects' cards, the open one lit, and under them the button for a new
            one */}
        <rect
          x="4.5"
          y="10"
          width="42"
          height="12.5"
          rx="2.4"
          className="fill-sidebar-accent/90 stroke-foreground/15"
        />
        <rect x="7.5" y="13.2" width="12" height="2" rx="1" className={SAID} />
        <rect x="7.5" y="17.3" width="22" height="2" rx="1" className={QUIET} />
        <rect
          x="4.5"
          y="24.5"
          width="42"
          height="12.5"
          rx="2.4"
          className="fill-sidebar-accent/45 stroke-foreground/5"
        />
        <rect x="7.5" y="27.7" width="16" height="2" rx="1" className={SAID} />
        <rect x="7.5" y="31.8" width="18" height="2" rx="1" className={QUIET} />
        <circle cx="8.2" cy="43.4" r="3.6" className={ROUND} />
        {/* the settings, in the corner */}
        <circle cx="10" cy="197.6" r="3.6" className={ROUND} />
      </g>

      <g className={right}>
        {/* the rest of the view, and the conversation beside it */}
        <rect
          x={SPLIT}
          width={236 - SPLIT}
          height="208"
          className="fill-sidebar"
        />
        <rect x="236" width="84" height="208" className="fill-background" />
        <line x1="236" x2="236" y2="208" className="stroke-border" />

        {/* down the view's right-hand edge: the conversation, which is open, and the
            model as a file; then how the model is looked at */}
        <circle cx="228.4" cy="7" r="3.6" className={LIT} />
        <circle cx="228.4" cy="16" r="3.6" className={ROUND} />
        {LOOKS.map((cy) => (
          <circle key={cy} cx="228.4" cy={cy} r="3.6" className={ROUND} />
        ))}

        {/* the model's three axes, in the corner */}
        <g strokeLinecap="round">
          <line
            x1="221"
            y1="197.5"
            x2="221"
            y2="191.4"
            stroke="var(--axis-z)"
          />
          <line
            x1="221"
            y1="197.5"
            x2="225.2"
            y2="194"
            stroke="var(--axis-y)"
          />
          <line
            x1="221"
            y1="197.5"
            x2="226.6"
            y2="199.6"
            stroke="var(--axis-x)"
          />
          <circle cx="221" cy="191.4" r="1.9" fill="var(--axis-z)" />
          <circle cx="225.2" cy="194" r="1.9" fill="var(--axis-y)" />
          <circle cx="226.6" cy="199.6" r="1.9" fill="var(--axis-x)" />
        </g>

        {/* the conversation: what it is called, what was asked, and what Claude said */}
        <rect
          x="243"
          y="5.4"
          width="28"
          height="2.2"
          rx="1.1"
          className={SAID}
        />
        <rect
          x="268"
          y="20"
          width="45"
          height="13.5"
          rx="4"
          className="fill-muted"
        />
        <rect x="272" y="24" width="37" height="2" rx="1" className={SAID} />
        <rect x="272" y="28.2" width="22" height="2" rx="1" className={SAID} />
        <rect x="243" y="43" width="60" height="2" rx="1" className={SAID} />
        <rect x="243" y="47.6" width="66" height="2" rx="1" className={SAID} />
        <rect x="243" y="52.2" width="44" height="2" rx="1" className={SAID} />
        <rect x="243" y="60.4" width="30" height="2" rx="1" className={QUIET} />
        <rect x="243" y="68.6" width="56" height="2" rx="1" className={SAID} />
        <rect x="243" y="73.2" width="38" height="2" rx="1" className={SAID} />

        {/* the message box: what it asks for, how it will be answered, and the button
            that sends it */}
        <rect
          x="241"
          y="177.5"
          width="73.5"
          height="25"
          rx="4.5"
          className="fill-input/30 stroke-input"
        />
        <rect x="245" y="182" width="42" height="2" rx="1" className={QUIET} />
        <circle cx="246.2" cy="196.4" r="1.4" fill="#d97757" />
        <rect
          x="249.5"
          y="195.4"
          width="32"
          height="2"
          rx="1"
          className={QUIET}
        />
        <circle cx="308.4" cy="196.3" r="3.2" className={LIT} />
      </g>

      {/* the model, over both halves: a slab seen from above one corner, with what is
          on top of it */}
      <g
        transform="translate(118 106) scale(0.86) translate(-115.5 -115.5)"
        stroke={MODEL.edge}
        strokeWidth={0.75}
        strokeLinejoin="round"
      >
        <polygon points="20,91 130,152 129,191 27,128" fill={MODEL.left} />
        <polygon points="130,152 211,79 205,116 129,191" fill={MODEL.right} />
        <polygon points="109,40 211,79 130,152 20,91" fill={MODEL.top} />
        <ellipse cx="117.7" cy="89.3" rx="64.7" ry="36.7" fill="none" />
        <ellipse cx="117.7" cy="86.6" rx="40" ry="22.6" fill="none" />
        {PARTS.map((part) => (
          <ellipse key={part.fill} {...part} rx="7" ry="3.8" />
        ))}
      </g>
    </svg>
  )
}
