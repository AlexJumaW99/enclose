import { Floating } from "@/components/floating"
import { GitHubIcon } from "@/components/icons"
import { Spinner } from "@/components/ui/spinner"
import { useStore } from "@/lib/store"

/**
 * At the foot of the view, while every project is being backed up to GitHub, as it is
 * once GitHub is connected: how many of them are done.
 */
export function BackingUp() {
  const backingUp = useStore((state) => state.github.backingUp)
  if (!backingUp) return null
  return (
    <Floating
      role="status"
      className="flex items-center gap-2.5 py-2.5 pr-4 pl-4"
    >
      <GitHubIcon className="size-4 shrink-0" />
      <span className="truncate">
        Backing up projects to GitHub
        <span className="text-muted-foreground tabular-nums">
          {" "}
          · {backingUp.done} of {backingUp.total}
        </span>
      </span>
      <Spinner className="size-4 text-muted-foreground" />
    </Floating>
  )
}
