import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Download } from "@/lib/model"

function size(bytes: number) {
  if (!bytes) return ""
  return bytes >= 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : `${Math.round(bytes / 1e3)} kB`
}

function Item({
  download,
  projectId,
}: {
  download: Download
  projectId: string
}) {
  return (
    <DropdownMenuItem
      onClick={() =>
        void window.cad.model.saveCopy(projectId, download.file, download.name)
      }
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{download.label}</span>
        {download.detail && (
          <span className="text-xs text-muted-foreground">
            {download.detail}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {size(download.bytes)}
      </span>
    </DropdownMenuItem>
  )
}

/** The files the model's build wrote for taking elsewhere: all of it, or one part. */
export function DownloadMenu({
  downloads,
  projectId,
}: {
  downloads: Download[]
  projectId: string
}) {
  const whole = downloads.filter((d) => d.kind !== "part")
  const parts = downloads.filter((d) => d.kind === "part")
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" />}
            />
          }
        >
          <DownloadIcon />
          <span className="sr-only">Download STEP</span>
        </TooltipTrigger>
        <TooltipContent side="left">Download STEP</TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="left" align="start" className="w-80">
        {whole.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Everything in one file</DropdownMenuLabel>
            {whole.map((d) => (
              <Item key={d.file} download={d} projectId={projectId} />
            ))}
          </DropdownMenuGroup>
        )}
        {whole.length > 0 && parts.length > 0 && <DropdownMenuSeparator />}
        {parts.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>One part</DropdownMenuLabel>
            {parts.map((d) => (
              <Item key={d.file} download={d} projectId={projectId} />
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
