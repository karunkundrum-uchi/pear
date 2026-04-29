import {
  DEFAULT_GRACE_PERIOD_MS,
  hostMatchesBlockedSite,
  isBlockWindowActive,
  normalizeHostname,
  type TableRow
} from "@pear/shared"
import { getExtensionSupabase } from "./lib/supabase"

type BlockWindow = TableRow<"block_windows">
type BlockedSite = TableRow<"blocked_sites">
type RuntimeMessage =
  | { type: "PEAR_REFRESH_CONFIG" }
  | {
      type: "PEAR_GRANT_GRACE"
      hostname: string
      targetUrl: string
      method: "wait" | "reason"
      reason?: string
    }

type ConfigCache = {
  fetchedAt: number
  windows: BlockWindow[]
  sites: BlockedSite[]
}

const CONFIG_CACHE_MS = 60 * 1000
const GRACE_STORAGE_KEY = "pear_grace_periods"
let configCache: ConfigCache | null = null

chrome.runtime.onInstalled.addListener(() => {
  void refreshConfig()
})

chrome.runtime.onStartup.addListener(() => {
  void refreshConfig()
})

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((error: Error) => sendResponse({ ok: false, error: error.message }))

  return true
})

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  void maybeBlockNavigation(details)
})

async function handleMessage(message: RuntimeMessage) {
  if (message.type === "PEAR_REFRESH_CONFIG") {
    await refreshConfig()
    return { ok: true }
  }

  if (message.type === "PEAR_GRANT_GRACE") {
    return grantGrace(message)
  }

  return { ok: false, error: "Unknown message" }
}

async function maybeBlockNavigation(details: chrome.webNavigation.WebNavigationFramedCallbackDetails) {
  if (details.frameId !== 0 || details.tabId < 0) {
    return
  }

  let target: URL
  try {
    target = new URL(details.url)
  } catch {
    return
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return
  }

  const hostname = normalizeHostname(target.hostname)
  if (!hostname || (await hasGrace(hostname))) {
    return
  }

  const config = await getConfig()
  const isBlockedSite = config.sites.some((site) => hostMatchesBlockedSite(hostname, site.hostname))
  const isActiveWindow = config.windows.some((window) => isBlockWindowActive(window))

  if (!isBlockedSite || !isActiveWindow) {
    return
  }

  const blockUrl = chrome.runtime.getURL(`tabs/block.html?target=${encodeURIComponent(details.url)}`)
  await chrome.tabs.update(details.tabId, { url: blockUrl })
}

async function grantGrace(message: Extract<RuntimeMessage, { type: "PEAR_GRANT_GRACE" }>) {
  const supabase = getExtensionSupabase()
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { ok: false, error: "Sign in to Pear first." }
  }

  const hostname = normalizeHostname(message.hostname)
  await setGrace(hostname)

  const { error } = await supabase.from("override_events").insert({
    user_id: session.user.id,
    hostname,
    method: message.method,
    reason: message.method === "reason" ? message.reason?.trim() || null : null
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, targetUrl: message.targetUrl }
}

async function refreshConfig() {
  configCache = null
  await getConfig()
}

async function getConfig(): Promise<ConfigCache> {
  if (configCache && Date.now() - configCache.fetchedAt < CONFIG_CACHE_MS) {
    return configCache
  }

  const supabase = getExtensionSupabase()
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session?.user) {
    configCache = { fetchedAt: Date.now(), windows: [], sites: [] }
    return configCache
  }

  const [windowsResult, sitesResult] = await Promise.all([
    supabase.from("block_windows").select("*").eq("user_id", session.user.id).eq("enabled", true),
    supabase.from("blocked_sites").select("*").eq("user_id", session.user.id)
  ])

  if (windowsResult.error || sitesResult.error) {
    configCache = { fetchedAt: Date.now(), windows: [], sites: [] }
    return configCache
  }

  configCache = {
    fetchedAt: Date.now(),
    windows: windowsResult.data ?? [],
    sites: sitesResult.data ?? []
  }

  return configCache
}

async function hasGrace(hostname: string) {
  const grace = await getGrace()
  const expiresAt = grace[hostname]

  if (!expiresAt) {
    return false
  }

  if (expiresAt > Date.now()) {
    return true
  }

  delete grace[hostname]
  await chrome.storage.local.set({ [GRACE_STORAGE_KEY]: grace })
  return false
}

async function setGrace(hostname: string) {
  const grace = await getGrace()
  grace[hostname] = Date.now() + DEFAULT_GRACE_PERIOD_MS
  await chrome.storage.local.set({ [GRACE_STORAGE_KEY]: grace })
}

async function getGrace(): Promise<Record<string, number>> {
  const result = await chrome.storage.local.get(GRACE_STORAGE_KEY)
  return result[GRACE_STORAGE_KEY] ?? {}
}
