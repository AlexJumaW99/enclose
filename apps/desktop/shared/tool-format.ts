// Where a project keeps tools of its own: things to work its model with that were made
// for it, and are no part of the app. A slider that opens the lid, the hands of a clock
// set to a time. Each is one file of JavaScript, in a folder at the top of the project,
// and is a tab of its own in the panel the view has for them. kit/tools.md says how one
// is written, and is what an agent reads before it writes one.

/** The folder at the top of a project that its tools are in, one file each. */
export const TOOLS_FOLDER = "tools"

/** What a file in it is called to be a tool: lower case, and nothing an address cannot hold. */
export const TOOL_FILE = /^([a-z0-9][a-z0-9-]*)\.m?js$/

/** The most tools a project has shown, and the most that is read of one, in bytes. */
export const MOST_TOOLS = 12
export const MOST_TOOL_BYTES = 200_000
