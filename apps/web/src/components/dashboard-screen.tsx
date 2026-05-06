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
type ProtectedSession = {
  getToken: () => Promise<string | null>
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

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClerkSupabaseClient(session)

      const [windowsResult, sitesResult, eventsResult, membershipsResult, groupsResult] = await Promise.all([
        supabase
          .from("block_windows")
          .select("*")
          .eq("user_id", userId)
          .order("day_of_week", { ascending: true }),
        supabase.from("blocked_sites").select("*").eq("user_id", userId).order("label", { ascending: true }),
        supabase.from("override_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("group_memberships").select("*").eq("user_id", userId).eq("status", "active"),
        supabase.from("groups").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false })
      ])

      const groupSchemaMissing = isMissingGroupSchemaError(membershipsResult.error?.message) || isMissingGroupSchemaError(groupsResult.error?.message)

      if (windowsResult.error || sitesResult.error || eventsResult.error || (!groupSchemaMissing && (membershipsResult.error || groupsResult.error))) {
        setMessage(
          windowsResult.error?.message ??
            sitesResult.error?.message ??
            eventsResult.error?.message ??
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
      setMessage(groupSchemaMissing ? "Groups are not available until the new Supabase migration is applied." : "")
      setLoading(false)
    }

    void loadDashboard()
  }, [session, userId])

  const recentReason = useMemo(
    () => events.find((event) => event.reason)?.reason ?? "No reasons logged yet.",
    [events]
  )
  const activeNow = useMemo(() => windows.some((window) => isBlockWindowActive(window)), [windows])
  const totalOverrides = events.length
  const waitCount = useMemo(() => events.filter((event) => event.method === "wait").length, [events])
  const reasonCount = totalOverrides - waitCount
  const weeklyOverrides = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return events.filter((event) => new Date(event.created_at).getTime() >= weekAgo).length
  }, [events])
  const topSites = useMemo(() => {
    const counts = new Map<string, number>()

    for (const event of events) {
      counts.set(event.hostname, (counts.get(event.hostname) ?? 0) + 1)
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [events])
  const scheduleSummary = useMemo(() => {
    if (windows.length === 0) {
      return "No active block window yet."
    }

    const uniqueDays = Array.from(new Set(windows.map((window) => window.day_of_week))).sort((a, b) => a - b)
    const labels = uniqueDays.map((day) => DAY_LABELS[day]).join(", ")
    return `${labels} • ${windows[0]?.start_time.slice(0, 5)} to ${windows[0]?.end_time.slice(0, 5)}`
  }, [windows])
  const sitesSummary = useMemo(() => {
    if (sites.length === 0) {
      return "No blocked sites yet."
    }

    return sites.slice(0, 4).map((site) => site.hostname).join(", ")
  }, [sites])
  const todayPulse = useMemo(() => {
    const timezone = windows[0]?.timezone ?? "America/Chicago"
    const today = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short"
    }).format(new Date())

    const activeDays = new Set(windows.map((window) => DAY_LABELS[window.day_of_week]))
    return activeDays.has(today) ? "Protected today" : "No block window today"
  }, [windows])
  const accountabilitySummary = useMemo(() => {
    const groupCount = groups.length
    const membershipOnlyCount = memberships.filter((membership) => membership.role === "member").length

    return {
      groupCount,
      membershipOnlyCount,
      hasSocialLayer: groupCount + membershipOnlyCount > 0
    }
  }, [groups, memberships])

  if (loading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm text-slate-600">Loading dashboard...</p>
      </main>
    )
  }

  return (
    <main>
      {message ? <p className="mb-4 text-sm text-slate-600">{message}</p> : null}

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            description={todayPulse}
            label="Status"
            tone={activeNow ? "teal" : "slate"}
            value={activeNow ? "Blocking now" : "Standing by"}
          />
          <StatCard description="Overrides recorded this week." label="Last 7 days" value={String(weeklyOverrides)} />
          <StatCard description="Reason-based continues vs one-minute waits." label="Decision mix" value={`${reasonCount}/${waitCount}`} />
          <StatCard
            description={sites.length > 0 ? sitesSummary : "Add a few to start."}
            label="Protected sites"
            value={String(sites.length)}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(420px,1fr)]">
          <section className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Override activity</h2>
                <p className="mt-1 text-sm text-slate-600">
                  What has been demanding attention most often during high-risk windows.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total logged</p>
                <p className="text-lg font-semibold text-slate-950">{totalOverrides}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,340px)]">
              <div className="space-y-3">
                {events.length > 0 ? (
                  events.map((event) => (
                    <article className="rounded-2xl border border-slate-200 p-3" key={event.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{event.hostname}</p>
                        <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {event.method === "reason" ? event.reason || "No reason entered." : "Waited 1 minute."}
                      </p>
                    </article>
                  ))
                ) : (
                  <EmptyPanel text="No overrides logged yet." />
                )}
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Most common trigger sites</p>
                  <div className="mt-3 space-y-3">
                    {topSites.length > 0 ? (
                      topSites.map(([hostname, count]) => (
                        <div className="flex items-center justify-between gap-3" key={hostname}>
                          <span className="text-sm text-slate-700">{hostname}</span>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700">
                            {count}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No trigger data yet.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Latest reason</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{recentReason}</p>
                </div>
              </aside>
            </div>
          </section>

          <section className="space-y-6">
            <section className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Current protection</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-700">Schedule</dt>
                  <dd className="mt-1 text-slate-600">{scheduleSummary}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Sites watched</dt>
                  <dd className="mt-1 text-slate-600">{sitesSummary}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Timezone</dt>
                  <dd className="mt-1 text-slate-600">{windows[0]?.timezone ?? "America/Chicago"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Reserved for v2</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Group accountability</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Placeholder
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  {accountabilitySummary.hasSocialLayer
                    ? `You already have ${accountabilitySummary.groupCount} owned groups and ${accountabilitySummary.membershipOnlyCount} outside accountability memberships.`
                    : "No accountability relationships yet. Build them on the Groups page before group stats go live."}
                </p>
                <p>Future cards here should summarize group override rates, check-ins, and how much support is actually reaching you.</p>
              </div>
            </section>
          </section>
        </div>
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  description,
  tone = "slate"
}: {
  label: string
  value: string
  description: string
  tone?: "slate" | "teal"
}) {
  return (
    <article className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${tone === "teal" ? "text-teal-700" : "text-slate-950"}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </article>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  )
}
