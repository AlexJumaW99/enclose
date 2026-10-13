// Run in the app's window by `npm run sandbox`: brings the project's tools up, as the T
// key does, which sets them to work, and waits for what the one that tries to get out
// has to say (scripts/sandbox/tool.js). What it says is on its readout.
;(async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms))
  const began = Date.now()
  const button = () => document.querySelector('[data-opens="tools"]')
  const said = () =>
    document.querySelector('[title^="ESCAPE "]')?.getAttribute("title")
  // the button is there once the model is, and the project's tools have been found
  while (!button() && Date.now() - began < 40_000) await wait(300)
  if (!button()) return { failed: "The project's tools never came up." }
  await wait(1000)
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "t", bubbles: true })
  )
  while (!said() && Date.now() - began < 70_000) await wait(300)
  const found = said()
  return found
    ? JSON.parse(found.slice("ESCAPE ".length))
    : { failed: "The tool never said what it found." }
})()
