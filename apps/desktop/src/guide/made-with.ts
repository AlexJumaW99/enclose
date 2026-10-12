// What the page says of itself, where only someone who opens the browser's console looks:
// what it was made with, in letters as big as a console has, and where that is to be had.
// The page itself says nothing of it: a guide is its maker's, and carries no mark of the
// app's.

const MADE_WITH = String.raw`
███╗   ███╗ █████╗ ██████╗ ███████╗    ██╗    ██╗██╗████████╗██╗  ██╗
████╗ ████║██╔══██╗██╔══██╗██╔════╝    ██║    ██║██║╚══██╔══╝██║  ██║
██╔████╔██║███████║██║  ██║█████╗      ██║ █╗ ██║██║   ██║   ███████║
██║╚██╔╝██║██╔══██║██║  ██║██╔══╝      ██║███╗██║██║   ██║   ██╔══██║
██║ ╚═╝ ██║██║  ██║██████╔╝███████╗    ╚███╔███╔╝██║   ██║   ██║  ██║
╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝     ╚══╝╚══╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝

███████╗███╗   ██╗ ██████╗██╗      ██████╗ ███████╗███████╗   ██████╗ ███████╗██╗   ██╗
██╔════╝████╗  ██║██╔════╝██║     ██╔═══██╗██╔════╝██╔════╝   ██╔══██╗██╔════╝██║   ██║
█████╗  ██╔██╗ ██║██║     ██║     ██║   ██║███████╗█████╗     ██║  ██║█████╗  ██║   ██║
██╔══╝  ██║╚██╗██║██║     ██║     ██║   ██║╚════██║██╔══╝     ██║  ██║██╔══╝  ╚██╗ ██╔╝
███████╗██║ ╚████║╚██████╗███████╗╚██████╔╝███████║███████╗██╗██████╔╝███████╗ ╚████╔╝
╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝╚═════╝ ╚══════╝  ╚═══╝
`

/** Where the app is to be had, and its source. */
const SITE = "https://enclose.dev"
const SOURCE = "https://github.com/enclosedev/enclose"

/** Say it in the console, once. */
export function madeWith() {
  console.log(
    `%c${MADE_WITH}%c\nThis assembly guide was made with Enclose: ${SITE}\nIt is open source: ${SOURCE}\n`,
    "font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.1; white-space: pre",
    "font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; line-height: 1.6"
  )
}
