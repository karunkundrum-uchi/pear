import { createClerkClient } from "@clerk/chrome-extension/background"
import {
  DEFAULT_GRACE_PERIOD_MS,
  hostMatchesBlockedSite,
  isBlockWindowActive,
  normalizeHostname,
  type TableRow
} from "@pear/shared"
import { createExtensionSupabaseClient } from "./lib/supabase"

type BlockWindow = TableRow<"block_windows">
type BlockedSite = TableRow<"blocked_sites">
type Notification = TableRow<"notifications">
type RuntimeMessage =
  | { type: "PEAR_REFRESH_CONFIG" }
  | {
      type: "PEAR_GRANT_GRACE"
      tabId: number
      hostname: string
      targetUrl: string
      method: "wait" | "reason"
      reason?: string
    }
  | {
      type: "PEAR_SEND_PING"
      recipientUserId: string
      notificationId: string
      message?: string
    }

type ConfigCache = {
  fetchedAt: number
  windows: BlockWindow[]
  sites: BlockedSite[]
}

type PendingPing = {
  senderUserId: string
  notificationId: string
  senderUsername: string
}

const CONFIG_CACHE_MS = 60 * 1000
const GRACE_STORAGE_KEY = "pear_grace_periods"
const SEEN_NOTIFICATIONS_KEY = "pear_seen_notifications"
const SEEN_PINGS_KEY = "pear_seen_pings"
const DIGEST_QUEUE_KEY = "pear_digest_queue"
const POLL_ALARM = "pear-poll-notifications"
const DIGEST_ALARM = "pear-daily-digest"

const clerkPublishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const clerkSyncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST
type DigestEntry = {
  id: string
  senderUserId: string
  hostname: string
  method: "wait" | "reason"
  reason: string | null
  exposure_level: "event_only" | "reason_summary" | "counts_only"
  createdAt: string
}

let configCache: ConfigCache | null = null
let realtimeChannel: ReturnType<ReturnType<typeof createExtensionSupabaseClient>["channel"]> | null = null
const pendingPings = new Map<string, PendingPing>()
const usernameCache = new Map<string, string>()
const cadenceCache = new Map<string, "realtime" | "daily_digest">()

if (!clerkPublishableKey || !clerkSyncHost) {
  throw new Error("Missing Clerk extension environment variables")
}

const CLERK_PUBLISHABLE_KEY: string = clerkPublishableKey
const CLERK_SYNC_HOST: string = clerkSyncHost

chrome.runtime.onInstalled.addListener(() => {
  void refreshConfig()
  void schedulePollAlarm()
  void scheduleDigestAlarm()
  void setupRealtimeSubscriptions()
  void pollNewNotifications()
})

chrome.runtime.onStartup.addListener(() => {
  void refreshConfig()
  void schedulePollAlarm()
  void scheduleDigestAlarm()
  void setupRealtimeSubscriptions()
  void pollNewNotifications()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    // Reconnect Realtime if the channel dropped, then poll as fallback
    void setupRealtimeSubscriptions()
    void pollNewNotifications()
  }
  if (alarm.name === DIGEST_ALARM) {
    void drainDigestQueue()
  }
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

chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
  if (buttonIndex === 0) {
    const pending = pendingPings.get(notifId)
    if (pending) {
      const pingUrl = chrome.runtime.getURL(
        `tabs/ping.html?notificationId=${encodeURIComponent(pending.notificationId)}&recipientUserId=${encodeURIComponent(pending.senderUserId)}&senderUsername=${encodeURIComponent(pending.senderUsername)}`
      )
      void chrome.tabs.create({ url: pingUrl })
      pendingPings.delete(notifId)
    }
  }
})

async function setupRealtimeSubscriptions() {
  // If channel is already subscribed, leave it alone — the open WebSocket keeps the SW alive
  if (realtimeChannel) {
    const state = realtimeChannel.state
    if (state === "joined" || state === "joining") {
      return
    }
    // Channel dropped — clean up before reconnecting
    void realtimeChannel.unsubscribe()
    realtimeChannel = null
  }

  const identity = await getIdentity()
  if (!identity) {
    return
  }

  const supabase = createExtensionSupabaseClient(identity.token)

  realtimeChannel = supabase
    .channel("pear-accountability")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_user_id=eq.${identity.userId}`
      },
      (payload) => {
        void handleIncomingNotification(payload.new as Notification, supabase)
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "pings",
        filter: `recipient_user_id=eq.${identity.userId}`
      },
      (payload) => {
        void handleIncomingPing(payload.new as TableRow<"pings">, supabase)
      }
    )
    .subscribe()
}

async function handleIncomingNotification(
  notification: Notification,
  supabase: ReturnType<typeof createExtensionSupabaseClient>
) {
  const seen = await getSeenIds(SEEN_NOTIFICATIONS_KEY)
  if (seen.includes(notification.id)) return

  const identity = await getIdentity()
  const cadence = identity
    ? await lookupNotificationCadence(supabase, identity.userId, notification.sender_user_id)
    : "realtime"

  if (cadence === "daily_digest") {
    await enqueueDigest(notification)
  } else {
    await showOverrideNotification(notification, supabase)
  }
  await markSeen(SEEN_NOTIFICATIONS_KEY, [notification.id])
}

async function handleIncomingPing(
  ping: TableRow<"pings">,
  supabase: ReturnType<typeof createExtensionSupabaseClient>
) {
  const seen = await getSeenIds(SEEN_PINGS_KEY)
  if (seen.includes(ping.id)) return
  await showPingNotification(ping, supabase)
  await markSeen(SEEN_PINGS_KEY, [ping.id])
}

async function schedulePollAlarm() {
  const existing = await chrome.alarms.get(POLL_ALARM)
  if (!existing) {
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 })
  }
}

async function scheduleDigestAlarm() {
  const existing = await chrome.alarms.get(DIGEST_ALARM)
  if (!existing) {
    chrome.alarms.create(DIGEST_ALARM, { delayInMinutes: 24 * 60, periodInMinutes: 24 * 60 })
  }
}

async function lookupNotificationCadence(
  supabase: ReturnType<typeof createExtensionSupabaseClient>,
  recipientUserId: string,
  senderUserId: string
): Promise<"realtime" | "daily_digest"> {
  const cacheKey = `${recipientUserId}:${senderUserId}`
  const cached = cadenceCache.get(cacheKey)
  if (cached) return cached

  const { data: connection } = await supabase
    .from("friend_connections")
    .select("id")
    .eq("user_id", recipientUserId)
    .eq("friend_user_id", senderUserId)
    .eq("status", "active")
    .maybeSingle()

  if (!connection) {
    cadenceCache.set(cacheKey, "realtime")
    return "realtime"
  }

  const { data: pref } = await supabase
    .from("accountability_preferences")
    .select("notification_cadence")
    .eq("owner_user_id", recipientUserId)
    .eq("friend_connection_id", connection.id)
    .eq("scope_type", "friend_default")
    .maybeSingle()

  const cadence: "realtime" | "daily_digest" =
    pref?.notification_cadence === "daily_digest" ? "daily_digest" : "realtime"
  cadenceCache.set(cacheKey, cadence)
  return cadence
}

async function enqueueDigest(notification: Notification) {
  const result = await chrome.storage.local.get(DIGEST_QUEUE_KEY)
  const queue: DigestEntry[] = result[DIGEST_QUEUE_KEY] ?? []
  const entry: DigestEntry = {
    id: notification.id,
    senderUserId: notification.sender_user_id,
    hostname: notification.hostname,
    method: notification.method,
    reason: notification.reason,
    exposure_level: notification.exposure_level,
    createdAt: notification.created_at
  }
  queue.push(entry)
  await chrome.storage.local.set({ [DIGEST_QUEUE_KEY]: queue })
}

async function drainDigestQueue() {
  const identity = await getIdentity()
  if (!identity) return

  const result = await chrome.storage.local.get(DIGEST_QUEUE_KEY)
  const queue: DigestEntry[] = result[DIGEST_QUEUE_KEY] ?? []
  if (queue.length === 0) return

  await chrome.storage.local.set({ [DIGEST_QUEUE_KEY]: [] })

  const supabase = createExtensionSupabaseClient(identity.token)
  const senderIds = [...new Set(queue.map((e) => e.senderUserId))]
  const names = await Promise.all(senderIds.map((id) => resolveUsername(id, supabase)))
  const nameList = names.map((n) => `@${n}`).join(", ")

  chrome.notifications.create("pear-digest", {
    type: "basic",
    iconUrl: getIconUrl(),
    title: `Pear — ${queue.length} override${queue.length > 1 ? "s" : ""} today`,
    message: `From ${nameList}`
  })
}

async function getSeenIds(key: string): Promise<string[]> {
  const result = await chrome.storage.local.get(key)
  return result[key] ?? []
}

async function markSeen(key: string, ids: string[]) {
  const existing = await getSeenIds(key)
  const next = Array.from(new Set([...existing, ...ids])).slice(-100)
  await chrome.storage.local.set({ [key]: next })
}

async function pollNewNotifications() {
  const identity = await getIdentity()
  if (!identity) {
    return
  }

  const supabase = createExtensionSupabaseClient(identity.token)

  const [notifResult, pingResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_user_id", identity.userId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("pings")
      .select("*")
      .eq("recipient_user_id", identity.userId)
      .order("created_at", { ascending: false })
      .limit(20)
  ])

  const [seenNotifications, seenPings] = await Promise.all([
    getSeenIds(SEEN_NOTIFICATIONS_KEY),
    getSeenIds(SEEN_PINGS_KEY)
  ])

  const newNotifications = (notifResult.data ?? []).filter((n) => !seenNotifications.includes(n.id))
  const newPings = (pingResult.data ?? []).filter((p) => !seenPings.includes(p.id))

  for (const notification of newNotifications) {
    const cadence = await lookupNotificationCadence(supabase, identity.userId, notification.sender_user_id)
    if (cadence === "daily_digest") {
      await enqueueDigest(notification)
    } else {
      await showOverrideNotification(notification, supabase)
    }
  }
  for (const ping of newPings) {
    await showPingNotification(ping, supabase)
  }

  if (newNotifications.length > 0) await markSeen(SEEN_NOTIFICATIONS_KEY, newNotifications.map((n) => n.id))
  if (newPings.length > 0) await markSeen(SEEN_PINGS_KEY, newPings.map((p) => p.id))
}

async function handleMessage(message: RuntimeMessage) {
  if (message.type === "PEAR_REFRESH_CONFIG") {
    await refreshConfig()
    return { ok: true }
  }

  if (message.type === "PEAR_GRANT_GRACE") {
    return grantGrace(message)
  }

  if (message.type === "PEAR_SEND_PING") {
    return sendPing(message)
  }

  return { ok: false, error: "Unknown message" }
}

async function sendPing(message: Extract<RuntimeMessage, { type: "PEAR_SEND_PING" }>) {
  const identity = await getIdentity()
  if (!identity) {
    return { ok: false, error: "Not signed in." }
  }

  const supabase = createExtensionSupabaseClient(identity.token)
  const { error } = await supabase.from("pings").insert({
    sender_user_id: identity.userId,
    recipient_user_id: message.recipientUserId,
    notification_id: message.notificationId || null,
    message: message.message?.trim() || null
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

async function resolveUsername(
  userId: string,
  supabase: ReturnType<typeof createExtensionSupabaseClient>
): Promise<string> {
  const cached = usernameCache.get(userId)
  if (cached) {
    return cached
  }

  const { data } = await supabase.rpc("get_public_profiles", { profile_ids: [userId] })
  const profile = (data as Array<{ id: string; username: string; display_name: string | null }> | null)?.[0]
  const username = profile?.username ?? userId
  usernameCache.set(userId, username)
  return username
}

function getIconUrl(): string {
  const icons = chrome.runtime.getManifest().icons as Record<string, string> | undefined
  if (!icons) return ""
  const path = icons["128"] ?? icons["64"] ?? icons["48"] ?? Object.values(icons)[0]
  return path ? chrome.runtime.getURL(path) : ""
}

async function showOverrideNotification(
  notification: Notification,
  supabase: ReturnType<typeof createExtensionSupabaseClient>
) {
  const senderUsername = await resolveUsername(notification.sender_user_id, supabase)
  const notifId = `pear-override-${notification.id}`

  let title: string
  let message: string

  if (notification.exposure_level === "counts_only") {
    title = "Pear"
    message = `@${senderUsername} had an override (details private)`
  } else {
    title = `@${senderUsername} opened ${notification.hostname}`
    message =
      notification.exposure_level === "reason_summary" && notification.reason
        ? `"${notification.reason}"`
        : notification.method === "reason"
          ? "Continued with a reason"
          : "Waited it out"
  }

  chrome.notifications.create(notifId, {
    type: "basic",
    iconUrl: getIconUrl(),
    title,
    message,
    buttons: [{ title: "Ping them" }]
  })

  pendingPings.set(notifId, {
    senderUserId: notification.sender_user_id,
    notificationId: notification.id,
    senderUsername
  })
}

async function showPingNotification(
  ping: TableRow<"pings">,
  supabase: ReturnType<typeof createExtensionSupabaseClient>
) {
  const senderUsername = await resolveUsername(ping.sender_user_id, supabase)
  const message = ping.message ? `"${ping.message}"` : "They're checking in on you."

  chrome.notifications.create(`pear-ping-${ping.id}`, {
    type: "basic",
    iconUrl: getIconUrl(),
    title: `@${senderUsername} sent you a ping`,
    message
  })
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
  if (!hostname || (await hasGrace(details.tabId, hostname))) {
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
  const identity = await getIdentity()
  if (!identity) {
    return { ok: false, error: "Sign in on the Pear web app first, then reopen the extension." }
  }

  const supabase = createExtensionSupabaseClient(identity.token)

  const hostname = normalizeHostname(message.hostname)
  await setGrace(message.tabId, hostname)

  const { error } = await supabase.from("override_events").insert({
    user_id: identity.userId,
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

  const identity = await getIdentity()
  if (!identity) {
    configCache = { fetchedAt: Date.now(), windows: [], sites: [] }
    return configCache
  }

  const supabase = createExtensionSupabaseClient(identity.token)

  const [windowsResult, sitesResult] = await Promise.all([
    supabase.from("block_windows").select("*").eq("user_id", identity.userId).eq("enabled", true),
    supabase.from("blocked_sites").select("*").eq("user_id", identity.userId)
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

async function hasGrace(tabId: number, hostname: string) {
  const grace = await getGrace()
  const key = getGraceKey(tabId, hostname)
  const expiresAt = grace[key]

  if (!expiresAt) {
    return false
  }

  if (expiresAt > Date.now()) {
    return true
  }

  delete grace[key]
  await chrome.storage.local.set({ [GRACE_STORAGE_KEY]: grace })
  return false
}

async function setGrace(tabId: number, hostname: string) {
  const grace = await getGrace()
  grace[getGraceKey(tabId, hostname)] = Date.now() + DEFAULT_GRACE_PERIOD_MS
  await chrome.storage.local.set({ [GRACE_STORAGE_KEY]: grace })
}

async function getGrace(): Promise<Record<string, number>> {
  const result = await chrome.storage.local.get(GRACE_STORAGE_KEY)
  return result[GRACE_STORAGE_KEY] ?? {}
}

function getGraceKey(tabId: number, hostname: string) {
  return `${tabId}:${hostname}`
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearGraceForTab(tabId)
})

async function clearGraceForTab(tabId: number) {
  const grace = await getGrace()
  let changed = false

  for (const key of Object.keys(grace)) {
    if (key.startsWith(`${tabId}:`)) {
      delete grace[key]
      changed = true
    }
  }

  if (changed) {
    await chrome.storage.local.set({ [GRACE_STORAGE_KEY]: grace })
  }
}

async function getIdentity() {
  const clerk = await createClerkClient({
    publishableKey: CLERK_PUBLISHABLE_KEY,
    syncHost: CLERK_SYNC_HOST
  })

  if (!clerk.session || !clerk.user) {
    return null
  }

  const token = await clerk.session.getToken()
  if (!token) {
    return null
  }

  return {
    token,
    userId: clerk.user.id
  }
}
