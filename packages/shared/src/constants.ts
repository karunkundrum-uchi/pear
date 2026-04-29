export const SITE_PRESETS = [
  { label: "TikTok", hostname: "tiktok.com" },
  { label: "Instagram", hostname: "instagram.com" },
  { label: "X / Twitter", hostname: "x.com" },
  { label: "YouTube", hostname: "youtube.com" },
  { label: "Reddit", hostname: "reddit.com" },
  { label: "Facebook", hostname: "facebook.com" }
] as const

export const DEFAULT_GRACE_PERIOD_MS = 10 * 60 * 1000
export const WAIT_OVERRIDE_MS = 60 * 1000
