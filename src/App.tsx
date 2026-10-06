import * as React from "react"
import { FolderPlusIcon, SettingsIcon } from "lucide-react"

import { Settings } from "@/components/settings"
import { Sidebar } from "@/components/sidebar"
import { Thread } from "@/components/thread"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { bridge } from "@/components/viewport/bridge"
import { Viewport } from "@/components/viewport/viewport"
import { MAC } from "@/lib/platform"
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
        if (request.kind === "selection") {
          return window.cad.viewport.respond({
            id,
            ok: true,
            data: selection?.part ?? null,
          })
        }
        // A model that has only just been built is still being read in when Claude
        // first asks to see it: give it a few seconds to arrive before saying no.
        const answer = (tries: number) => {
          const ask =
            request.kind === "parts" ? bridge.parts : bridge.screenshot
          const { projects } = useStore.getState()
          const coming = projects.find((p) => p.id === activeId)?.manifest
          if (!ask && coming && tries > 0)
            return void setTimeout(() => answer(tries - 1), 250)
          if (!ask) return fail("No model is on screen.")
          try {
            window.cad.viewport.respond({ id, ok: true, data: ask() })
          } catch (error) {
            fail(error instanceof Error ? error.message : String(error))
          }
        }
        answer(40)
      }),
    []
  )
}

/**
 * Cmd+B shows the conversation, and puts it away again. Cmd+, does the same for the
 * settings, as it does in every Mac app.
 */
function useAppKeys() {
  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      // Ctrl+B on a Mac is a key for moving through text: left to do that
      const held = MAC ? event.metaKey && !event.ctrlKey : event.ctrlKey
      if (!held || event.altKey || event.shiftKey) return
      const state = useStore.getState()
      if (event.key === ",") {
        event.preventDefault()
        state.setSettingsOpen(!state.settingsOpen)
        return
      }
      if (event.key.toLowerCase() !== "b" || state.settingsOpen) return
      const { activeId, threadOpen, setThreadOpen } = state
      if (!activeId) return
      event.preventDefault()
      setThreadOpen(!threadOpen)
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [])
}

/**
 * A folder dropped anywhere on the window becomes a project. True while one is being
 * dragged over it.
 */
function useFolderDrop(): boolean {
  const [over, setOver] = React.useState(false)
  React.useEffect(() => {
    // entering a child fires before leaving its parent: count, so the two cancel
    let inside = 0
    const carriesFiles = (event: DragEvent) =>
      event.dataTransfer?.types.includes("Files") ?? false
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      inside++
      setOver(true)
    }
    const hover = (event: DragEvent) => {
      if (!carriesFiles(event) || !event.dataTransfer) return
      // without this the window would open what is dropped instead
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    }
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      inside = Math.max(0, inside - 1)
      if (inside === 0) setOver(false)
    }
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event) || !event.dataTransfer) return
      event.preventDefault()
      inside = 0
      setOver(false)
      const dirs = [...event.dataTransfer.files]
        .map((file) => window.cad.projects.pathOf(file))
        .filter(Boolean)
      void useStore.getState().addFolders(dirs)
    }
    window.addEventListener("dragenter", enter)
    window.addEventListener("dragover", hover)
    window.addEventListener("dragleave", leave)
    window.addEventListener("drop", drop)
    return () => {
      window.removeEventListener("dragenter", enter)
      window.removeEventListener("dragover", hover)
      window.removeEventListener("dragleave", leave)
      window.removeEventListener("drop", drop)
    }
  }, [])
  return over
}

export function App() {
  const ready = useStore((state) => state.ready)
  const threadOpen = useStore((state) => state.threadOpen)
  const project = useActiveProject()
  const settingsOpen = useStore((state) => state.settingsOpen)
  const setSettingsOpen = useStore((state) => state.setSettingsOpen)
  const dropping = useFolderDrop()
  useViewportRequests()
  useAppKeys()

  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-sidebar text-sidebar-foreground">
        <main className="relative min-w-0 flex-1">
          {ready && <Viewport project={project} />}
          {/* the top edge of the view is also what the window is dragged by */}
          <div className="drag absolute inset-x-0 top-0 h-3" />
          <Sidebar />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="absolute bottom-4 left-4.5 bg-background shadow-sm"
                  onClick={() => setSettingsOpen(true)}
                />
              }
            >
              <SettingsIcon />
              <span className="sr-only">Settings</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="has-data-[slot=kbd]:pr-2.5">
              Settings
              <Kbd>{MAC ? "⌘," : "Ctrl ,"}</Kbd>
            </TooltipContent>
          </Tooltip>
        </main>
        {threadOpen && project && <Thread project={project} />}
        {settingsOpen && <Settings />}
        {dropping && (
          <div className="pointer-events-none fixed inset-2 z-50 flex items-center justify-center rounded-2xl bg-background/70 ring-2 ring-foreground/40 backdrop-blur-sm ring-inset">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <FolderPlusIcon className="size-5" />
              Drop a folder to make it a project
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default App
