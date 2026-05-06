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
  recentReason: string
  accountabilityText: string
  currentWindowLabel: string
  mostRecentEventTime: string
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function isMissingGroupSchemaError(message?: string) {
  return Boolean(message && message.includes("Could not find the table 'public.group"))
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

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClerkSupabaseClient(session)

      const [windowsResult, sitesResult, eventsResult, membershipsResult, groupsResult, profileResult] = await Promise.all([
        supabase.from("block_windows").select("*").eq("user_id", userId).order("day_of_week", { ascending: true }),
        supabase.from("blocked_sites").select("*").eq("user_id", userId).order("label", { ascending: true }),
        supabase.from("override_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("group_memberships").select("*").eq("user_id", userId).eq("status", "active"),
        supabase.from("groups").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", userId).single()
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
      setLoading(false)
    }

    void loadDashboard()
  }, [session, userId])

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
        : `${uniqueDays.map((day) => DAY_LABELS[day]).join(", ")} • ${windows[0]?.start_time.slice(0, 5)}-${windows[0]?.end_time.slice(0, 5)}`
    const sitesSummary =
      sites.length === 0 ? "No sites under protection yet." : sites.slice(0, 4).map((site) => site.hostname).join(", ")
    const timezone = windows[0]?.timezone ?? "America/Chicago"
    const today = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date())
    const protectedToday = new Set(windows.map((window) => DAY_LABELS[window.day_of_week])).has(today)
    const recentReason = events.find((event) => event.reason)?.reason ?? "No written reason logged yet."
    const membershipOnlyCount = memberships.filter((membership) => membership.role === "member").length
    const accountabilityText =
      groups.length + membershipOnlyCount > 0
        ? `${groups.length} circles and ${membershipOnlyCount} outside check-in relationships are ready for future shared progress.`
        : "No shared accountability layer yet. This space is being held for that next step."

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
      recentReason,
      accountabilityText,
      currentWindowLabel: activeNow ? "Protection is live right now." : protectedToday ? "Protected later today." : "No active protection today.",
      mostRecentEventTime: events[0] ? new Date(events[0].created_at).toLocaleString() : "No activity logged yet."
    }
  }, [events, groups.length, memberships, profile?.username, sites, windows])

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
      <FocusDashboard model={model} />
    </main>
  )
}

function FocusDashboard({ model }: { model: DashboardModel }) {
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
                  A steadier read on how well your attention held today.
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
              <LedgerCard label="Pressure this week" value={`${model.weeklyOverrides}`} note="How often the blocker had to step in." />
              <LedgerCard label="Deliberate choices" value={`${model.reasonCount}`} note="Times you made an active decision instead of waiting it out." />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Behavior note" subtitle="A dashboard should explain, not just count.">
              <p className="text-sm leading-7 text-slate-600">{model.recentReason}</p>
            </Panel>
            <Panel title="Pattern watch" subtitle="Where attention keeps drifting when things get shaky.">
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
                <MutedBox text="No visible drift pattern yet." />
              )}
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="Daily posture" subtitle="A quieter summary of your current setup and rhythm.">
            <Definition label="Current state" value={model.activeNow ? "Protected now" : "Standing by"} />
            <Definition label="Schedule" value={model.scheduleSummary} />
            <Definition label="Protected sites" value={`${model.sitesCount} · ${model.sitesSummary}`} />
            <Definition label="Latest activity" value={model.mostRecentEventTime} />
          </Panel>

          <Panel title="Shared progress" subtitle="Space reserved for future group momentum and accountability.">
            <p className="text-sm leading-7 text-slate-600">{model.accountabilityText}</p>
          </Panel>
        </div>
      </div>
    </section>
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
