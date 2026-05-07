"use client"

import { useEffect, useMemo, useState } from "react"
import { isBlockWindowActive, type TableRow } from "@pear/shared"
import { ProtectedPage } from "@/components/protected-page"
import { createClerkSupabaseClient } from "@/lib/supabase"

type BlockWindow = TableRow<"block_windows">
type BlockedSite = TableRow<"blocked_sites">
type Group = TableRow<"groups">
type GroupMembership = TableRow<"group_memberships">
type OverrideEvent = TableRow<"override_events">
type Notification = TableRow<"notifications">
type Profile = TableRow<"profiles">
type ProtectedSession = {
  getToken: () => Promise<string | null>
}

type DashboardModel = {
  activeNow: boolean
  handle: string
  protectedToday: boolean
  totalOverrides: number
  weeklyOverrides: number
  reasonCount: number
  waitCount: number
  sitesCount: number
  windowsCount: number
  scheduleSummary: string
  sitesSummary: string
  topSites: Array<[string, number]>
  currentWindowLabel: string
  mostRecentEventTime: string
  uniqueDayLabels: string[]
  windowTimeRange: string
  siteHostnames: string[]
}

type SupabaseClient = ReturnType<typeof createClerkSupabaseClient>

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function isMissingGroupSchemaError(message?: string) {
  return Boolean(message && message.includes("Could not find the table 'public.group"))
}

// "17:00:00" or "17:00" → "5:00 PM"
function formatTime12h(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

// ISO timestamp → "May 7 · 3:45 PM"
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
}

export function DashboardScreen() {
  return (
    <ProtectedPage>
      {({ session, user }) => <DashboardContent session={session} userId={user.id} />}
    </ProtectedPage>
  )
}

function DashboardContent({
  session,
  userId
}: {
  session: ProtectedSession
  userId: string
}) {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [windows, setWindows] = useState<BlockWindow[]>([])
  const [sites, setSites] = useState<BlockedSite[]>([])
  const [events, setEvents] = useState<OverrideEvent[]>([])
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [friendUsernames, setFriendUsernames] = useState<Map<string, string>>(new Map())
  const [supabase] = useState(() => createClerkSupabaseClient(session))

  useEffect(() => {
    async function loadDashboard() {
      const [windowsResult, sitesResult, eventsResult, membershipsResult, groupsResult, profileResult, notifsResult] =
        await Promise.all([
          supabase.from("block_windows").select("*").eq("user_id", userId).order("day_of_week", { ascending: true }),
          supabase.from("blocked_sites").select("*").eq("user_id", userId).order("label", { ascending: true }),
          supabase.from("override_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
          supabase.from("group_memberships").select("*").eq("user_id", userId).eq("status", "active"),
          supabase.from("groups").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false }),
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase.from("notifications").select("*").eq("recipient_user_id", userId).order("created_at", { ascending: false }).limit(10)
        ])

      const groupSchemaMissing =
        isMissingGroupSchemaError(membershipsResult.error?.message) || isMissingGroupSchemaError(groupsResult.error?.message)

      if (
        windowsResult.error ||
        sitesResult.error ||
        eventsResult.error ||
        profileResult.error ||
        (!groupSchemaMissing && (membershipsResult.error || groupsResult.error))
      ) {
        setMessage(
          windowsResult.error?.message ??
            sitesResult.error?.message ??
            eventsResult.error?.message ??
            profileResult.error?.message ??
            membershipsResult.error?.message ??
            groupsResult.error?.message ??
            ""
        )
        setLoading(false)
        return
      }

      setWindows(windowsResult.data ?? [])
      setSites(sitesResult.data ?? [])
      setEvents(eventsResult.data ?? [])
      setMemberships(groupSchemaMissing ? [] : (membershipsResult.data ?? []))
      setGroups(groupSchemaMissing ? [] : (groupsResult.data ?? []))
      setProfile(profileResult.data ?? null)
      setMessage(groupSchemaMissing ? "Groups are not available until the new social layer is ready." : "")

      const notifs = notifsResult.data ?? []
      setNotifications(notifs)

      const senderIds = [...new Set(notifs.map((n) => n.sender_user_id))]
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase.rpc("get_public_profiles", { profile_ids: senderIds })
        const map = new Map<string, string>()
        for (const p of (profiles as Array<{ id: string; username: string }> | null) ?? []) {
          map.set(p.id, p.username)
        }
        setFriendUsernames(map)
      }

      setLoading(false)
    }

    void loadDashboard()
  }, [session, userId, supabase])

  const model = useMemo<DashboardModel>(() => {
    const activeNow = windows.some((window) => isBlockWindowActive(window))
    const totalOverrides = events.length
    const waitCount = events.filter((event) => event.method === "wait").length
    const reasonCount = totalOverrides - waitCount
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const weeklyOverrides = events.filter((event) => new Date(event.created_at).getTime() >= weekAgo).length
    const topSites = buildTopSites(events)
    const uniqueDays = Array.from(new Set(windows.map((window) => window.day_of_week))).sort((a, b) => a - b)
    const scheduleSummary =
      windows.length === 0
        ? "No protection window set yet."
        : `${uniqueDays.map((day) => DAY_LABELS[day]).join(", ")} • ${formatTime12h(windows[0]!.start_time)}–${formatTime12h(windows[0]!.end_time)}`
    const sitesSummary =
      sites.length === 0 ? "No sites under protection yet." : sites.slice(0, 4).map((site) => site.hostname).join(", ")
    const timezone = windows[0]?.timezone ?? "America/Chicago"
    const today = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date())
    const protectedToday = new Set(windows.map((window) => DAY_LABELS[window.day_of_week])).has(today)

    const uniqueDayLabels = uniqueDays.map((day) => DAY_LABELS[day])
    const windowTimeRange =
      windows.length === 0
        ? ""
        : `${formatTime12h(windows[0]!.start_time)} – ${formatTime12h(windows[0]!.end_time)}`

    return {
      activeNow,
      handle: profile?.username ? `@${profile.username}` : "@pending",
      protectedToday,
      totalOverrides,
      weeklyOverrides,
      reasonCount,
      waitCount,
      sitesCount: sites.length,
      windowsCount: windows.length,
      scheduleSummary,
      sitesSummary,
      topSites,
      currentWindowLabel: activeNow ? "Protection is live right now." : protectedToday ? "Protected later today." : "No active protection today.",
      mostRecentEventTime: events[0] ? formatTimestamp(events[0].created_at) : "No activity logged yet.",
      uniqueDayLabels,
      windowTimeRange,
      siteHostnames: sites.slice(0, 8).map((s) => s.hostname)
    }
  }, [events, profile?.username, sites, windows])

  if (loading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm text-slate-600">Loading dashboard...</p>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      {message ? <p className="text-sm text-[#6b544e]">{message}</p> : null}
      <FocusDashboard
        model={model}
        events={events}
        notifications={notifications}
        friendUsernames={friendUsernames}
        supabase={supabase}
        userId={userId}
      />
    </main>
  )
}

function FocusDashboard({
  model,
  events,
  notifications,
  friendUsernames,
  supabase,
  userId
}: {
  model: DashboardModel
  events: OverrideEvent[]
  notifications: Notification[]
  friendUsernames: Map<string, string>
  supabase: SupabaseClient
  userId: string
}) {
  const focusScore = Math.max(0, 100 - model.weeklyOverrides * 9 - model.waitCount * 3)

  return (
    <section className="rounded-[2rem] border border-[#e7d8d5] bg-[linear-gradient(145deg,#fff7f4_0%,#fffdf8_48%,#f6efe7_100%)] p-6 shadow-[0_24px_70px_rgba(88,53,46,0.08)]">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] bg-[#fffdf9] p-6 ring-1 ring-[#ecdcd7]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a6d62]">Daily focus</p>
                <h3 className="mt-2 text-3xl font-semibold leading-tight text-[#2d201c]">
                  A clear look at how your focus held.
                </h3>
              </div>
              <span className="rounded-full bg-[#f4e4de] px-3 py-1 text-sm font-medium text-[#7b4f45]">{model.handle}</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-[1.5rem] bg-[#2d201c] p-5 text-white">
                <p className="text-xs uppercase tracking-[0.18em] text-[#d6bbb2]">Focus score</p>
                <p className="mt-3 text-5xl font-semibold">{focusScore}</p>
                <p className="mt-3 text-sm leading-6 text-[#ead7d1]">{model.currentWindowLabel}</p>
              </div>
              <LedgerCard label="Bypasses this week" value={`${model.weeklyOverrides}`} note="Times you got through the block." />
              <LedgerCard label="Reason bypasses" value={`${model.reasonCount}`} note="Times you entered a reason to continue." />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Your overrides" subtitle="A log of every time you bypassed a block.">
              <PersonalFeed events={events} />
            </Panel>
            <Panel title="Top sites" subtitle="The sites that pull hardest when focus slips.">
              {model.topSites.length > 0 ? (
                <div className="space-y-3">
                  {model.topSites.map(([hostname, count]) => (
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 text-sm last:border-b-0 last:pb-0" key={hostname}>
                      <span className="text-slate-800">{hostname}</span>
                      <span className="rounded-full bg-[#f5ece8] px-2 py-1 text-[#7b4f45]">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <MutedBox text="No patterns yet. Keep going." />
              )}
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <StatusCard model={model} />

          <Panel title="Friend overrides" subtitle="When your people slip, you'll know.">
            <FriendsFeed
              notifications={notifications}
              friendUsernames={friendUsernames}
              supabase={supabase}
              userId={userId}
            />
          </Panel>
        </div>
      </div>
    </section>
  )
}

function StatusCard({ model }: { model: DashboardModel }) {
  const isActive = model.activeNow
  const hasWindow = model.windowsCount > 0

  return (
    <section className="rounded-[1.5rem] bg-white/85 p-5 shadow-sm ring-1 ring-[#eadcd7]">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-[#2d201c]">Status</h4>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            isActive
              ? "bg-[#dcfce7] text-[#166534]"
              : "bg-[#f1f5f9] text-[#64748b]"
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${isActive ? "bg-[#22c55e]" : "bg-[#94a3b8]"}`}
          />
          {isActive ? "Protected now" : model.protectedToday ? "On later today" : "Standing by"}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {hasWindow ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#9a6d62]">Schedule</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {model.uniqueDayLabels.map((day) => (
                <span
                  className="rounded-md bg-[#f7eeea] px-2 py-0.5 text-xs font-medium text-[#6b544e]"
                  key={day}
                >
                  {day}
                </span>
              ))}
            </div>
            {model.windowTimeRange && (
              <p className="mt-1.5 text-sm font-medium text-[#2d201c]">{model.windowTimeRange}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#9a6d62]">No protection window set yet.</p>
        )}

        {model.siteHostnames.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#9a6d62]">Blocking</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {model.siteHostnames.map((host) => (
                <span
                  className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-xs text-[#475569]"
                  key={host}
                >
                  {host}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#9a6d62]">No sites under protection yet.</p>
        )}

        <div className="border-t border-[#efe4df] pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#9a6d62]">Last override</p>
          <p className="mt-1 text-sm text-[#473632]">{model.mostRecentEventTime}</p>
        </div>
      </div>
    </section>
  )
}

function PersonalFeed({ events }: { events: OverrideEvent[] }) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 3
  const visible = expanded ? events : events.slice(0, LIMIT)
  const hasMore = events.length > LIMIT

  if (events.length === 0) {
    return <MutedBox text="No overrides logged yet." />
  }

  return (
    <div className="space-y-3">
      {visible.map((event) => (
        <div className="border-b border-[#efe4df] pb-3 last:border-b-0 last:pb-0" key={event.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-800">{event.hostname}</span>
            <div className="flex items-center gap-2">
              <MethodBadge method={event.method} />
              <span className="text-xs text-[#9a6d62]">{formatTimestamp(event.created_at)}</span>
            </div>
          </div>
          {event.reason ? (
            <p className="mt-1 text-xs italic text-slate-500">"{event.reason}"</p>
          ) : null}
        </div>
      ))}
      {hasMore && (
        <button
          className="mt-1 text-xs font-medium text-[#7b4f45] hover:text-[#2d201c] transition-colors"
          onClick={() => setExpanded((e) => !e)}
          type="button"
        >
          {expanded ? "Show less" : `Show more (${events.length - LIMIT} more)`}
        </button>
      )}
    </div>
  )
}

type PingState = "idle" | "composing" | "sending" | "sent"

function FriendsFeed({
  notifications,
  friendUsernames,
  supabase,
  userId
}: {
  notifications: Notification[]
  friendUsernames: Map<string, string>
  supabase: SupabaseClient
  userId: string
}) {
  const [pingStates, setPingStates] = useState<Record<string, PingState>>({})
  const [pingMessages, setPingMessages] = useState<Record<string, string>>({})
  const [pingErrors, setPingErrors] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 3

  if (notifications.length === 0) {
    return <MutedBox text="No friend activity yet." />
  }

  const visible = expanded ? notifications : notifications.slice(0, LIMIT)
  const hasMore = notifications.length > LIMIT

  async function sendPing(notif: Notification) {
    setPingStates((s) => ({ ...s, [notif.id]: "sending" }))
    const message = pingMessages[notif.id]?.trim() || null
    const { error } = await supabase.from("pings").insert({
      sender_user_id: userId,
      recipient_user_id: notif.sender_user_id,
      notification_id: notif.id,
      message
    })
    if (error) {
      setPingErrors((e) => ({ ...e, [notif.id]: error.message }))
      setPingStates((s) => ({ ...s, [notif.id]: "composing" }))
    } else {
      setPingStates((s) => ({ ...s, [notif.id]: "sent" }))
    }
  }

  return (
    <div className="space-y-4">
      {visible.map((notif) => {
        const handle = `@${friendUsernames.get(notif.sender_user_id) ?? notif.sender_user_id}`
        const pingState = pingStates[notif.id] ?? "idle"
        const isCountsOnly = notif.exposure_level === "counts_only"

        return (
          <div className="border-b border-[#efe4df] pb-4 last:border-b-0 last:pb-0" key={notif.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#2d201c]">{handle}</span>
                  {!isCountsOnly && <MethodBadge method={notif.method} />}
                  {!isCountsOnly && (
                    <span className="text-sm text-slate-700">{notif.hostname}</span>
                  )}
                </div>
                <p className="text-xs text-[#9a6d62]">{formatTimestamp(notif.created_at)}</p>
              </div>

              {!isCountsOnly && pingState === "idle" && (
                <button
                  className="rounded-full bg-[#f4e4de] px-3 py-1 text-xs font-medium text-[#7b4f45] hover:bg-[#ebcfc7] transition-colors"
                  onClick={() => setPingStates((s) => ({ ...s, [notif.id]: "composing" }))}
                  type="button"
                >
                  Ping →
                </button>
              )}

              {pingState === "sent" && (
                <span className="text-xs font-medium text-[#166534]">Ping sent ✓</span>
              )}
            </div>

            {notif.exposure_level === "reason_summary" && notif.reason ? (
              <p className="mt-1 text-xs italic text-slate-500">"{notif.reason}"</p>
            ) : null}

            {(pingState === "composing" || pingState === "sending") && (
              <div className="mt-3 space-y-2">
                <textarea
                  className="w-full rounded-xl border border-[#e0cec9] bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#9a6d62] focus:ring-2 focus:ring-[#9a6d62]/20 resize-none"
                  onChange={(e) => setPingMessages((m) => ({ ...m, [notif.id]: e.target.value }))}
                  placeholder="Say something… (optional)"
                  rows={2}
                  value={pingMessages[notif.id] ?? ""}
                />
                {pingErrors[notif.id] ? (
                  <p className="text-xs text-red-600">{pingErrors[notif.id]}</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    className="rounded-full bg-[#2d201c] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#473632] transition-colors disabled:opacity-50"
                    disabled={pingState === "sending"}
                    onClick={() => void sendPing(notif)}
                    type="button"
                  >
                    {pingState === "sending" ? "Sending…" : "Send ping"}
                  </button>
                  <button
                    className="rounded-full border border-[#e0cec9] px-4 py-1.5 text-xs font-medium text-[#6b544e] hover:bg-[#f7eeea] transition-colors"
                    onClick={() => {
                      setPingStates((s) => ({ ...s, [notif.id]: "idle" }))
                      setPingMessages((m) => ({ ...m, [notif.id]: "" }))
                      setPingErrors((e) => ({ ...e, [notif.id]: "" }))
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {hasMore && (
        <button
          className="mt-1 text-xs font-medium text-[#7b4f45] hover:text-[#2d201c] transition-colors"
          onClick={() => setExpanded((e) => !e)}
          type="button"
        >
          {expanded ? "Show less" : `Show more (${notifications.length - LIMIT} more)`}
        </button>
      )}
    </div>
  )
}

function MethodBadge({ method }: { method: string }) {
  if (method === "wait") {
    return (
      <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#166534]">
        Waited
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400e]">
      Reason
    </span>
  )
}

function buildTopSites(events: OverrideEvent[]) {
  const counts = new Map<string, number>()
  for (const event of events) {
    counts.set(event.hostname, (counts.get(event.hostname) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
}

function Panel({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[1.5rem] bg-white/85 p-5 shadow-sm ring-1 ring-[#eadcd7]">
      <h4 className="text-lg font-semibold text-[#2d201c]">{title}</h4>
      <p className="mt-1 text-sm leading-6 text-[#7b6a63]">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function LedgerCard({
  label,
  value,
  note
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-[1.5rem] bg-[#f7eeea] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6d62]">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-[#2d201c]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6b544e]">{note}</p>
    </div>
  )
}

function Definition({
  label,
  value
}: {
  label: string
  value: string
}) {
  return (
    <div className="border-b border-[#efe4df] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-sm font-medium text-[#6b544e]">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[#473632]">{value}</dd>
    </div>
  )
}

function MutedBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e5d5cf] bg-[#fffaf7] p-4">
      <p className="text-sm leading-6 text-[#7b6a63]">{text}</p>
    </div>
  )
}
