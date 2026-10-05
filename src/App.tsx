import * as React from "react"

import { Sidebar } from "@/components/sidebar"
import { Thread } from "@/components/thread"
import { TooltipProvider } from "@/components/ui/tooltip"
import { bridge } from "@/components/viewport/bridge"
import { Viewport } from "@/components/viewport/viewport"
import { useActiveProject, useStore } from "@/lib/store"

/** Answer Claude's questions about what is on screen. */
function useViewportRequests() {
  React.useEffect(
    () =>
      window.cad.viewport.onRequest((request) => {
        const { id } = request
        const fail = (error: string) =>
          window.cad.viewport.respond({ id, ok: false, error })
        const { activeId, selection } = useStore.getState()
        if (request.projectId !== activeId) {
          return fail(
            "The app is showing a different project right now, so this one is not on screen."
          )
        }
        try {
          if (request.kind === "selection") {
            return window.cad.viewport.respond({
              id,
              ok: true,
              data: selection?.part ?? null,
            })
          }
          const answer =
            request.kind === "parts" ? bridge.parts : bridge.screenshot
          if (!answer) return fail("No model is on screen.")
          window.cad.viewport.respond({ id, ok: true, data: answer() })
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error))
        }
      }),
    []
  )
}

export function App() {
  const ready = useStore((state) => state.ready)
  const threadOpen = useStore((state) => state.threadOpen)
  const project = useActiveProject()
  useViewportRequests()

  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-sidebar text-sidebar-foreground">
        <Sidebar />
        <main className="relative min-w-0 flex-1">
          {ready && <Viewport project={project} />}
          {/* the top edge of the view is also what the window is dragged by */}
          <div className="drag absolute inset-x-0 top-0 h-3" />
        </main>
        {threadOpen && project && <Thread project={project} />}
      </div>
    </TooltipProvider>
  )
}

export default App
