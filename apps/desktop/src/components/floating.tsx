import * as React from "react"
import { cn } from "cn"

/**
 * What floats at the foot of the view, in the middle: a pill of frosted glass that comes
 * up from below. All the app has to tell there, or is at, is said in one of these, one
 * over another, so that it all looks alike and comes in alike.
 */
export function Floating({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "glass animate-in rounded-full bg-background/60 text-sm shadow-md ring-1 ring-foreground/10 duration-200 select-none fade-in slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  )
}
