import * as React from "react"
import { FolderPlusIcon, ImagePlusIcon, SettingsIcon } from "lucide-react"

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
import { toolsAsked, toolUsed } from "@/lib/custom-tools/asked"
import { isPicture } from "@/lib/pictures"
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
        // The project's own tools, made to work its model with: how they stand, or a
        // hand on one of their controls.
        if (request.kind === "tools" || request.kind === "tool") {
          const asked =
            request.kind === "tool"
              ? toolUsed(request.projectId, request.use)
              : toolsAsked(request.projectId)
          return void asked.then(
            (data) => window.cad.viewport.respond({ id, ok: true, data }),
            (error: unknown) =>
              fail(error instanceof Error ? error.message : String(error))
          )
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
 * A folder dropped anywhere on the window becomes a project, and so do CAD files. A
 * picture dropped on it, with a project open, goes with that project's next message.
 * Says what is being dragged over the window, while something is: pictures alone, or
 * anything else.
 */
function useFolderDrop(): "pictures" | "files" | null {
  const [over, setOver] = React.useState<"pictures" | "files" | null>(null)
  React.useEffect(() => {
    // entering a child fires before leaving its parent: count, so the two cancel
    let inside = 0
    const carriesFiles = (event: DragEvent) =>
      event.dataTransfer?.types.includes("Files") ?? false
    // what kind each file is can be told while it is still on its way, and no more
    const allPictures = (event: DragEvent) => {
      const files = [...(event.dataTransfer?.items ?? [])].filter(
        (item) => item.kind === "file"
      )
      return (
        useStore.getState().activeId !== null &&
        files.length > 0 &&
        files.every((item) => item.type.startsWith("image/"))
      )
    }
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      event.preventDefault()
      inside++
      setOver(allPictures(event) ? "pictures" : "files")
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
      if (inside === 0) setOver(null)
    }
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event) || !event.dataTransfer) return
      event.preventDefault()
      inside = 0
      setOver(null)
      const files = [...event.dataTransfer.files]
      // pictures go with the open project's next message, and the rest is opened
      const { activeId, attach, openPaths } = useStore.getState()
      const pictures = activeId ? files.filter(isPicture) : []
      if (pictures.length > 0) void attach(pictures, true)
      const paths = files
        .filter((file) => !pictures.includes(file))
        .map((file) => window.cad.projects.pathOf(file))
        .filter(Boolean)
      void openPaths(paths)
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
              {dropping === "pictures" ? (
                <>
                  <ImagePlusIcon className="size-5" />
                  Drop an image to send it with your message
                </>
              ) : (
                <>
                  <FolderPlusIcon className="size-5" />
                  Drop a file or folder to make it a project
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default App
