"use client"

import { useEffect, useMemo, useState } from "react"
import { SITE_PRESETS, normalizeHostname, type TableInsert, type TableRow } from "@pear/shared"
import { ProtectedPage } from "@/components/protected-page"
import { createClerkSupabaseClient } from "@/lib/supabase"

type BlockWindow = TableRow<"block_windows">
type BlockedSite = TableRow<"blocked_sites">
type Profile = TableRow<"profiles">
type ProtectedSession = {
  getToken: () => Promise<string | null>
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
]

export default function SetupPage() {
  return (
    <ProtectedPage>
      {({ session, user }) => <SetupContent session={session} userId={user.id} />}
    </ProtectedPage>
  )
}

function SetupContent({
  session,
  userId
}: {
  session: ProtectedSession
  userId: string
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [profileMessage, setProfileMessage] = useState("")
  const [windows, setWindows] = useState<BlockWindow[]>([])
  const [sites, setSites] = useState<BlockedSite[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [usernameDraft, setUsernameDraft] = useState("")
  const [focusIntentionDraft, setFocusIntentionDraft] = useState("")
  const [intentionSaving, setIntentionSaving] = useState(false)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startTime, setStartTime] = useState("17:00")
  const [endTime, setEndTime] = useState("19:00")
  const [timezone, setTimezone] = useState("America/Chicago")
  const [selectedHosts, setSelectedHosts] = useState<string[]>(["tiktok.com", "instagram.com", "youtube.com"])
  const [customHost, setCustomHost] = useState("")

  useEffect(() => {
    const guessedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (guessedTimezone) {
      setTimezone(guessedTimezone)
    }
  }, [])

  useEffect(() => {
    async function loadSetup() {
      const supabase = createClerkSupabaseClient(session)
      const [windowsResult, sitesResult, profileResult] = await Promise.all([
        supabase
          .from("block_windows")
          .select("*")
          .eq("user_id", userId)
          .order("day_of_week", { ascending: true }),
        supabase.from("blocked_sites").select("*").eq("user_id", userId).order("label", { ascending: true }),
        supabase.from("profiles").select("*").eq("id", userId).single()
      ])

      if (windowsResult.error || sitesResult.error || profileResult.error) {
        setMessage(windowsResult.error?.message ?? sitesResult.error?.message ?? profileResult.error?.message ?? "")
        setLoading(false)
        return
      }

      const nextWindows = windowsResult.data ?? []
      const nextSites = sitesResult.data ?? []

      setWindows(nextWindows)
      setSites(nextSites)
      setProfile(profileResult.data ?? null)
      setUsernameDraft(profileResult.data?.username ?? "")
      setFocusIntentionDraft(profileResult.data?.focus_intention ?? "")

      if (nextWindows.length > 0) {
        setSelectedDays(nextWindows.map((window) => window.day_of_week))
        setStartTime(nextWindows[0].start_time.slice(0, 5))
        setEndTime(nextWindows[0].end_time.slice(0, 5))
        setTimezone(nextWindows[0].timezone)
      }

      if (nextSites.length > 0) {
        setSelectedHosts(nextSites.map((site) => site.hostname))
      }

      setLoading(false)
    }

    void loadSetup()
  }, [session, userId])

  const setupSummary = useMemo(() => {
    return {
      windows: windows.length,
      sites: sites.length
    }
  }, [sites.length, windows.length])

  const normalizedUsernamePreview = useMemo(() => {
    return usernameDraft
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_")
  }, [usernameDraft])

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

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
      user_id: userId,
      label: "High-risk window",
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      timezone,
      enabled: true
    }))

    const siteRows: TableInsert<"blocked_sites">[] = hostnames.map((hostname) => ({
      user_id: userId,
      label: SITE_PRESETS.find((preset) => preset.hostname === hostname)?.label ?? hostname,
      hostname
    }))

    const deleteWindows = await supabase.from("block_windows").delete().eq("user_id", userId)
    const deleteSites = await supabase.from("blocked_sites").delete().eq("user_id", userId)

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
    setWindows(
      windowRows.map((row, index) => ({
        id: `draft-window-${index}`,
        label: row.label ?? "High-risk window",
        timezone: row.timezone ?? timezone,
        enabled: row.enabled ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...row
      }))
    )
    setSites(
      siteRows.map((row, index) => ({
        id: `draft-site-${index}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...row
      }))
    )
  }

  async function saveUsername() {
    if (!normalizedUsernamePreview) {
      setProfileMessage("Username must include at least one letter or number.")
      return
    }

    setUsernameSaving(true)
    setProfileMessage("")

    const supabase = createClerkSupabaseClient(session)
    const { data, error } = await supabase.rpc("claim_profile_username", {
      profile_id: userId,
      requested_username: usernameDraft
    })

    setUsernameSaving(false)

    if (error || !data) {
      setProfileMessage(error?.message ?? "Unable to update username.")
      return
    }

    const nextUsername = data as string
    setUsernameDraft(nextUsername)
    setProfile((current) => (current ? { ...current, username: nextUsername } : current))
    setProfileMessage("Username updated.")
  }

  async function saveFocusIntention() {
    setIntentionSaving(true)
    setProfileMessage("")
    const supabase = createClerkSupabaseClient(session)
    const { error } = await supabase
      .from("profiles")
      .update({ focus_intention: focusIntentionDraft.trim() || null })
      .eq("id", userId)
    setIntentionSaving(false)
    if (error) { setProfileMessage(error.message); return }
    setProfileMessage("Focus intention saved.")
  }

  if (loading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm text-slate-600">Loading setup...</p>
      </main>
    )
  }

  return (
    <main className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]">
      <section className="rounded-[2rem] border border-[#eadcd7] bg-[linear-gradient(145deg,#fff7f4_0%,#fffdf8_48%,#f6efe7_100%)] p-6 shadow-[0_24px_70px_rgba(88,53,46,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6d62]">Setup</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#2d201c]">Shape the rhythm that protects your attention</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b544e]">
              Keep this page operational. It owns your windows, your watched sites, and the final reminder that the extension needs a refresh after changes.
            </p>
          </div>
          <div className="rounded-2xl border border-[#eadcd7] bg-[#fffaf7] px-4 py-3 text-sm text-[#6b544e]">
            <p>{setupSummary.windows} active windows</p>
            <p>{setupSummary.sites} protected sites</p>
          </div>
        </div>

        <form className="mt-8" onSubmit={saveConfig}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <div className="space-y-6">
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">Days</legend>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {DAYS.map((day) => {
                    const active = selectedDays.includes(day.value)

                    return (
                      <button
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
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

              <fieldset>
                <legend className="text-sm font-medium text-slate-700">Sites</legend>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {SITE_PRESETS.map((site) => {
                    const active = selectedHosts.includes(site.hostname)
                    return (
                      <label
                        className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
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
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-slate-700">Custom site</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setCustomHost(event.target.value)}
                    placeholder="example.com"
                    value={customHost}
                  />
                </label>
              </fieldset>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[1.5rem] border border-[#eadcd7] bg-[#fffaf7] p-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Start</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setStartTime(event.target.value)}
                    type="time"
                    value={startTime}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-slate-700">End</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setEndTime(event.target.value)}
                    type="time"
                    value={endTime}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-slate-700">Timezone</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setTimezone(event.target.value)}
                    value={timezone}
                  />
                </label>

                <div className="mt-4 rounded-2xl border border-dashed border-[#e5d5cf] bg-white px-4 py-4 text-sm text-[#6b544e]">
                  After saving, reopen the extension popup once so the background worker refreshes its cached config.
                </div>

                <button
                  className="mt-4 w-full rounded-xl bg-[#2d201c] px-4 py-3 text-sm font-medium text-white hover:bg-[#45312c] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Saving..." : "Update setup"}
                </button>
                {message ? <p className="mt-3 text-sm text-[#6b544e]">{message}</p> : null}
              </div>

              <section className="rounded-[1.5rem] border border-[#eadcd7] bg-[#fffaf7] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6d62]">Profile</p>
                <h3 className="mt-2 text-lg font-semibold text-[#2d201c]">Name people can find</h3>
                <p className="mt-2 text-sm leading-6 text-[#6b544e]">
                  Pick the handle other people use to find you when they send a friend request.
                </p>

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Username</span>
                    <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
                      <span className="text-sm text-slate-500">@</span>
                      <input
                        className="w-full border-0 bg-transparent px-1 text-sm outline-none"
                        onChange={(event) => setUsernameDraft(event.target.value)}
                        placeholder="yourname"
                        value={usernameDraft}
                      />
                    </div>
                  </label>

                  <div className="rounded-2xl border border-dashed border-[#e5d5cf] bg-white px-4 py-4 text-sm text-[#6b544e]">
                    <p>Current: {profile ? `@${profile.username}` : "Pending"}</p>
                    <p>Preview: {normalizedUsernamePreview ? `@${normalizedUsernamePreview}` : "Enter a username"}</p>
                  </div>

                  <button
                    className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#5d3d36] shadow-sm ring-1 ring-[#d8c2ba] hover:bg-[#fff8f5] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={usernameSaving}
                    onClick={() => void saveUsername()}
                    type="button"
                  >
                    {usernameSaving ? "Saving username..." : "Update username"}
                  </button>

                  {profileMessage ? <p className="text-sm text-[#6b544e]">{profileMessage}</p> : null}

                  <div className="mt-6 border-t border-[#eadcd7] pt-5">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Why are you blocking distracting sites?</span>
                      <p className="mt-0.5 text-xs text-[#9a6d62]">Shown to you on the block screen as a reminder.</p>
                      <textarea
                        className="mt-2 w-full rounded-xl border border-[#d8c2ba] bg-white px-3 py-2 text-sm text-[#2d201c] placeholder:text-[#b8a09a] outline-none focus:border-[#b88579] focus:ring-2 focus:ring-[#f4e4de] resize-none"
                        onChange={(e) => setFocusIntentionDraft(e.target.value)}
                        placeholder="e.g. I want to get better sleep, stop wasting time on social media during work hours"
                        rows={2}
                        value={focusIntentionDraft}
                      />
                    </label>
                    <button
                      className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#5d3d36] shadow-sm ring-1 ring-[#d8c2ba] hover:bg-[#fff8f5] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={intentionSaving}
                      onClick={() => void saveFocusIntention()}
                      type="button"
                    >
                      {intentionSaving ? "Saving..." : "Save intention"}
                    </button>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </form>
      </section>
    </main>
  )
}
