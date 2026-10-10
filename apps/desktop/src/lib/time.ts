import * as React from "react"

/** How long ago, in as few characters as a sidebar has room for: "now", "8m", "2h", "3d". */
export function ago(from: number, now: number): string {
  const minutes = Math.floor((now - from) / 60_000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** How long something took, to the second: "40s", "3m 12s", "2h 5m 9s". */
export function duration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  const parts = [
    [Math.floor(seconds / 3600), "h"],
    [Math.floor((seconds % 3600) / 60), "m"],
    [seconds % 60, "s"],
  ] as const
  // a part there is none of is not said: two minutes flat is "2m"
  return parts
    .filter(([count]) => count > 0)
    .map(([count, unit]) => `${count}${unit}`)
    .join(" ")
}

/** The current time, refreshed often enough for labels that count in minutes. */
export function useNow(everyMs = 20_000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
