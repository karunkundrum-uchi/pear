import type { TableRow } from "./database.types"

type BlockWindow = Pick<
  TableRow<"block_windows">,
  "day_of_week" | "start_time" | "end_time" | "timezone" | "enabled"
>

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
}

export function isBlockWindowActive(window: BlockWindow, now = new Date()) {
  if (!window.enabled) {
    return false
  }

  const local = getLocalParts(now, window.timezone)
  const start = timeToMinutes(window.start_time)
  const end = timeToMinutes(window.end_time)

  if (start === end) {
    return false
  }

  if (start < end) {
    return local.dayOfWeek === window.day_of_week && local.minutes >= start && local.minutes < end
  }

  const nextDay = (window.day_of_week + 1) % 7
  return (
    (local.dayOfWeek === window.day_of_week && local.minutes >= start) ||
    (local.dayOfWeek === nextDay && local.minutes < end)
  )
}

export function timeToMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":")
  return Number(hour) * 60 + Number(minute)
}

function getLocalParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  })

  const parts = formatter.formatToParts(date)
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun"
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)

  return {
    dayOfWeek: WEEKDAY_TO_INDEX[weekday] ?? 0,
    minutes: hour * 60 + minute
  }
}
