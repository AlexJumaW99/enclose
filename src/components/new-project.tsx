import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"

/**
 * The two ways a project starts: a new folder made where new projects go, under a name,
 * or a folder that is already somewhere on the disk.
 */
export function NewProject({
  autoFocus,
  onDone,
}: {
  autoFocus?: boolean
  /** a project was made or added */
  onDone?: () => void
}) {
  const createProject = useStore((state) => state.createProject)
  const addProject = useStore((state) => state.addProject)
  const [name, setName] = React.useState("")

  return (
    <div className="flex w-full flex-col gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void createProject(name).then(() => {
            setName("")
            onDone?.()
          })
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name of a new project"
          aria-label="Name of a new project"
          autoFocus={autoFocus}
        />
        <Button type="submit" className="shrink-0">
          Create
        </Button>
      </form>
      <Button
        variant="ghost"
        className="text-muted-foreground"
        onClick={() =>
          void addProject().then((added) => {
            if (added) onDone?.()
          })
        }
      >
        Or open a folder you already have…
      </Button>
    </div>
  )
}
