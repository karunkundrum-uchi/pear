"use client"

import { useClerk, useSession, useUser } from "@clerk/nextjs"
import { useEffect, useMemo, useState } from "react"
import {
  SITE_PRESETS,
  isBlockWindowActive,
  normalizeHostname,
  type TableInsert,
  type TableRow
} from "@pear/shared"
import { createClerkSupabaseClient } from "@/lib/supabase"

type BlockWindow = TableRow<"block_windows">
type BlockedSite = TableRow<"blocked_sites">
type OverrideEvent = TableRow<"override_events">

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
]

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function DashboardPage() {
  const { session, isLoaded: sessionLoaded } = useSession()
  const { user, isLoaded: userLoaded } = useUser()
  const { signOut: clerkSignOut } = useClerk()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [windows, setWindows] = useState<BlockWindow[]>([])
  const [sites, setSites] = useState<BlockedSite[]>([])
  const [events, setEvents] = useState<OverrideEvent[]>([])
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState("17:00")
  const [endTime, setEndTime] = useState("19:00")
  const [timezone, setTimezone] = useState("America/Chicago")
  const [selectedHosts, setSelectedHosts] = useState<string[]>(["tiktok.com", "instagram.com", "youtube.com"])
  const [customHost, setCustomHost] = useState("")

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
    return `${labels} • ${startTime} to ${endTime}`
  }, [endTime, startTime, windows])
  const sitesSummary = useMemo(() => {
    if (sites.length === 0) {
      return "No blocked sites yet."
    }

    return sites.slice(0, 4).map((site) => site.hostname).join(", ")
  }, [sites])
  const todayPulse = useMemo(() => {
    const today = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short"
    }).format(new Date())

    const activeDays = new Set(windows.map((window) => DAY_LABELS[window.day_of_week]))
    return activeDays.has(today) ? "Protected today" : "No block window today"
  }, [timezone, windows])

  useEffect(() => {
    const guessedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (guessedTimezone) {
      setTimezone(guessedTimezone)
    }
  }, [])

  useEffect(() => {
    async function load() {
      if (!sessionLoaded || !userLoaded) {
        return
      }

      if (!session || !user) {
        setLoading(false)
        return
      }

      const supabase = createClerkSupabaseClient(session)

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        display_name: user.firstName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? null
      })

      if (profileError) {
        setMessage(profileError.message)
      }

      await loadDashboard(user.id, supabase)
      setLoading(false)
    }

    void load()
  }, [session, sessionLoaded, user, userLoaded])

  async function loadDashboard(userId: string, supabase = createClerkSupabaseClient(session)) {
    const [windowsResult, sitesResult, eventsResult] = await Promise.all([
      supabase
        .from("block_windows")
        .select("*")
        .eq("user_id", userId)
        .order("day_of_week", { ascending: true }),
      supabase.from("blocked_sites").select("*").eq("user_id", userId).order("label", { ascending: true }),
      supabase
        .from("override_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)
    ])

    if (windowsResult.error || sitesResult.error || eventsResult.error) {
      setMessage(windowsResult.error?.message ?? sitesResult.error?.message ?? eventsResult.error?.message ?? "")
      return
    }

    const nextWindows = windowsResult.data ?? []
    const nextSites = sitesResult.data ?? []

    setWindows(nextWindows)
    setSites(nextSites)
    setEvents(eventsResult.data ?? [])

    if (nextWindows.length > 0) {
      setSelectedDays(nextWindows.map((window) => window.day_of_week))
      setStartTime(nextWindows[0].start_time.slice(0, 5))
      setEndTime(nextWindows[0].end_time.slice(0, 5))
      setTimezone(nextWindows[0].timezone)
    }

    if (nextSites.length > 0) {
      setSelectedHosts(nextSites.map((site) => site.hostname))
    }
  }

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user || !session) {
      return
    }

    const supabase = createClerkSupabaseClient(session)

    const custom = normalizeHostname(customHost)
    const hostnames = Array.from(new Set([...selectedHosts, custom].filter(Boolean))).map(normalizeHostname)

    if (selectedDays.length === 0 || hostnames.length === 0) {
      setMessage("Choose at least one day and one site.")
      return
    }

    setSaving(true)
    setMessage("")

    const windowRows: TableInsert<"block_windows">[] = selectedDays.map((day) => ({
      user_id: user.id,
      label: "High-risk window",
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      timezone,
      enabled: true
    }))

    const siteRows: TableInsert<"blocked_sites">[] = hostnames.map((hostname) => ({
      user_id: user.id,
      label: SITE_PRESETS.find((preset) => preset.hostname === hostname)?.label ?? hostname,
      hostname
    }))

    const deleteWindows = await supabase.from("block_windows").delete().eq("user_id", user.id)
    const deleteSites = await supabase.from("blocked_sites").delete().eq("user_id", user.id)

    if (deleteWindows.error || deleteSites.error) {
      setSaving(false)
      setMessage(deleteWindows.error?.message ?? deleteSites.error?.message ?? "")
      return
    }

    const insertWindows = await supabase.from("block_windows").insert(windowRows)
    const insertSites = await supabase.from("blocked_sites").insert(siteRows)

    setSaving(false)

    if (insertWindows.error || insertSites.error) {
      setMessage(insertWindows.error?.message ?? insertSites.error?.message ?? "")
      return
    }

    setCustomHost("")
    setMessage("Saved. Refresh the extension popup if it is already open.")
    await loadDashboard(user.id)
  }

  async function signOut() {
    await clerkSignOut({ redirectUrl: "/sign-in" })
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-slate-600">Loading dashboard...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-teal-700">Pear</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Your attention dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Track how often high-risk windows are getting tested, which sites pull you most often, and whether your
            current setup is doing enough.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Account</p>
            <p className="text-sm text-slate-800">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={signOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="grid gap-6 py-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
              <p className={`mt-3 text-2xl font-semibold ${activeNow ? "text-teal-700" : "text-slate-950"}`}>
                {activeNow ? "Blocking now" : "Standing by"}
              </p>
              <p className="mt-2 text-sm text-slate-600">{todayPulse}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last 7 days</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{weeklyOverrides}</p>
              <p className="mt-2 text-sm text-slate-600">Overrides recorded this week.</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Decision mix</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {reasonCount}/{waitCount}
              </p>
              <p className="mt-2 text-sm text-slate-600">Reason-based continues vs one-minute waits.</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Protected sites</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{sites.length}</p>
              <p className="mt-2 text-sm text-slate-600">{sites.length > 0 ? sitesSummary : "Add a few to start."}</p>
            </article>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Override activity</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    What has been demanding attention most often during high-risk windows.
                  </p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total logged</p>
                  <p className="text-lg font-semibold text-slate-950">{totalOverrides}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="space-y-3">
                  {events.length > 0 ? (
                    events.map((event) => (
                      <article className="rounded-md border border-slate-200 p-3" key={event.id}>
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
                    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">No overrides logged yet.</p>
                    </div>
                  )}
                </div>

                <aside className="space-y-4">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
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

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900">Latest reason</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{recentReason}</p>
                  </div>
                </aside>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
                  <dd className="mt-1 text-slate-600">{timezone}</dd>
                </div>
              </dl>
            </section>
          </div>
        </section>

        <aside className="space-y-6">
          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={saveConfig}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Adjust block setup</h2>
                <p className="mt-1 text-sm text-slate-600">Keep this tight. Change only what you need.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                Secondary
              </span>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-slate-700">Days</legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {DAYS.map((day) => {
                  const active = selectedDays.includes(day.value)
                  return (
                    <button
                      className={`rounded-md border px-3 py-2 text-sm font-medium ${
                        active
                          ? "border-teal-700 bg-teal-50 text-teal-900"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      key={day.value}
                      onClick={() =>
                        setSelectedDays((current) =>
                          active ? current.filter((value) => value !== day.value) : [...current, day.value].sort()
                        )
                      }
                      type="button"
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-5 grid gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Start</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => setStartTime(event.target.value)}
                  type="time"
                  value={startTime}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">End</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => setEndTime(event.target.value)}
                  type="time"
                  value={endTime}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Timezone</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => setTimezone(event.target.value)}
                  value={timezone}
                />
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-slate-700">Sites</legend>
              <div className="mt-2 grid gap-2">
                {SITE_PRESETS.map((site) => {
                  const active = selectedHosts.includes(site.hostname)
                  return (
                    <label
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        active ? "border-teal-700 bg-teal-50 text-teal-950" : "border-slate-300 text-slate-700"
                      }`}
                      key={site.hostname}
                    >
                      <input
                        checked={active}
                        onChange={(event) =>
                          setSelectedHosts((current) =>
                            event.target.checked
                              ? [...current, site.hostname]
                              : current.filter((hostname) => hostname !== site.hostname)
                          )
                        }
                        type="checkbox"
                      />
                      {site.label}
                    </label>
                  )
                })}
              </div>
              <label className="mt-3 block">
                <span className="text-sm font-medium text-slate-700">Custom site</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => setCustomHost(event.target.value)}
                  placeholder="example.com"
                  value={customHost}
                />
              </label>
            </fieldset>

            <button
              className="mt-6 w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving..." : "Update setup"}
            </button>
            {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
          </form>
        </aside>
      </div>
    </main>
  )
}
