"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedPage } from "@/components/protected-page"
import { createClerkSupabaseClient } from "@/lib/supabase"
import type { TableInsert, TableRow } from "@pear/shared"

type FriendConnection = TableRow<"friend_connections">
type AccountabilityPreference = TableRow<"accountability_preferences">
type PublicProfile = Pick<TableRow<"profiles">, "id" | "username" | "display_name">
type ProtectedSession = {
  getToken: () => Promise<string | null>
}

type FriendView = FriendConnection & {
  counterpartyUsername: string
}

const EXPOSURE_OPTIONS: Array<{
  value: TableInsert<"accountability_preferences">["exposure_level"]
  label: string
  description: string
}> = [
  {
    value: "reason_summary",
    label: "Reason summary",
    description: "They see the reason you typed when you continue past a block."
  },
  {
    value: "event_only",
    label: "Event only",
    description: "They know an override happened, but not the reason."
  },
  {
    value: "counts_only",
    label: "Counts only",
    description: "Only affects accountability stats — no live detail."
  }
]

const CADENCE_OPTIONS: Array<{
  value: TableInsert<"accountability_preferences">["notification_cadence"]
  label: string
  description: string
}> = [
  {
    value: "realtime",
    label: "Realtime (Recommended)",
    description: "Notify me immediately when they override."
  },
  {
    value: "daily_digest",
    label: "Daily digest",
    description: "Send me a daily summary of their overrides."
  },
  {
    value: "off",
    label: "Off",
    description: "Don't notify me about their overrides."
  }
]

const INBOUND_MODE_OPTIONS: Array<{
  value: "on" | "daily_digest_only" | "off"
  label: string
  description: string
}> = [
  { value: "on", label: "On", description: "Use per-friend settings." },
  { value: "daily_digest_only", label: "Digest only", description: "Batch all to once per day." },
  { value: "off", label: "Off", description: "No notifications from anyone." }
]

export default function FriendsPage() {
  return (
    <ProtectedPage>
      {({ session, user }) => <FriendsContent session={session} userId={user.id} />}
    </ProtectedPage>
  )
}

function FriendsContent({
  session,
  userId
}: {
  session: ProtectedSession
  userId: string
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [preferences, setPreferences] = useState<AccountabilityPreference[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, PublicProfile>>({})
  const [friendUsername, setFriendUsername] = useState("")
  const [addExposure, setAddExposure] = useState<TableInsert<"accountability_preferences">["exposure_level"]>("reason_summary")
  const [addCadence, setAddCadence] = useState<TableInsert<"accountability_preferences">["notification_cadence"]>("realtime")
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null)
  const [editExposure, setEditExposure] = useState<TableInsert<"accountability_preferences">["exposure_level"]>("reason_summary")
  const [editCadence, setEditCadence] = useState<TableInsert<"accountability_preferences">["notification_cadence"]>("realtime")
  const [inboundMode, setInboundMode] = useState<"on" | "daily_digest_only" | "off">("on")
  const [editingInboundMode, setEditingInboundMode] = useState(false)
  const [draftInboundMode, setDraftInboundMode] = useState<"on" | "daily_digest_only" | "off">("on")

  async function loadFriendsState() {
    const supabase = createClerkSupabaseClient(session)
    const [friendsResult, preferencesResult, profileResult] = await Promise.all([
      supabase.from("friend_connections").select("*").or(`user_id.eq.${userId},friend_user_id.eq.${userId}`).order("created_at", { ascending: false }),
      supabase.from("accountability_preferences").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("inbound_notification_mode").eq("id", userId).maybeSingle()
    ])

    if (friendsResult.error || preferencesResult.error) {
      setMessage(friendsResult.error?.message ?? preferencesResult.error?.message ?? "")
      setLoading(false)
      return
    }

    const nextFriends = friendsResult.data ?? []
    setFriends(nextFriends)
    setPreferences(preferencesResult.data ?? [])
    if (profileResult.data?.inbound_notification_mode) {
      setInboundMode(profileResult.data.inbound_notification_mode)
      setDraftInboundMode(profileResult.data.inbound_notification_mode)
    }

    const relatedProfileIds: string[] = Array.from(
      new Set(
        nextFriends
          .flatMap((f) => [f.user_id, f.friend_user_id])
          .filter((v): v is string => Boolean(v))
      )
    )

    if (relatedProfileIds.length > 0) {
      const { data: relatedProfiles } = await supabase.rpc("get_public_profiles", {
        profile_ids: relatedProfileIds
      })
      setProfilesById(
        Object.fromEntries(((relatedProfiles as PublicProfile[] | null) ?? []).map((p) => [p.id, p]))
      )
    } else {
      setProfilesById({})
    }

    setLoading(false)
  }

  async function saveInboundMode(mode: "on" | "daily_digest_only" | "off") {
    setInboundMode(mode)
    const supabase = createClerkSupabaseClient(session)
    await supabase.from("profiles").update({ inbound_notification_mode: mode }).eq("id", userId)
  }

  useEffect(() => {
    void loadFriendsState()
  }, [session, userId])

  const friendPreferenceMap = useMemo(() => {
    return new Map(
      preferences
        .filter((p) => p.scope_type === "friend_default" && p.friend_connection_id)
        .map((p) => [p.friend_connection_id as string, p])
    )
  }, [preferences])

  const activeFriends = useMemo(() => {
    return friends
      .filter((f) => f.user_id === userId && f.status === "active")
      .map((f) => ({
        ...f,
        counterpartyUsername: profilesById[f.friend_user_id ?? ""]?.username ?? f.friend_label
      }))
  }, [friends, profilesById, userId])

  const outgoingRequests = useMemo(() => {
    return friends
      .filter((f) => f.user_id === userId && f.status === "pending")
      .map((f) => ({
        ...f,
        counterpartyUsername: profilesById[f.friend_user_id ?? ""]?.username ?? f.friend_label
      }))
  }, [friends, profilesById, userId])

  const incomingRequests = useMemo(() => {
    return friends
      .filter((f) => f.friend_user_id === userId && f.status === "pending")
      .map((f) => ({
        ...f,
        counterpartyUsername: profilesById[f.user_id]?.username ?? f.friend_label
      }))
  }, [friends, profilesById, userId])

  async function addFriend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!friendUsername.trim()) {
      setMessage("Enter your friend's username.")
      return
    }

    setSaving(true)
    setMessage("")

    const supabase = createClerkSupabaseClient(session)
    const normalizedUsername = friendUsername.trim().replace(/^@+/, "").toLowerCase()

    const { data: targetProfile, error: targetProfileError } = await supabase.rpc("find_profile_by_username", {
      requested_username: normalizedUsername
    })

    if (targetProfileError) {
      setSaving(false)
      setMessage(targetProfileError.message)
      return
    }

    const matchingProfile = ((targetProfile as PublicProfile[] | null) ?? [])[0] ?? null

    if (!matchingProfile) {
      setSaving(false)
      setMessage("No user found with that username.")
      return
    }

    if (matchingProfile.id === userId) {
      setSaving(false)
      setMessage("You cannot add yourself.")
      return
    }

    const duplicate = friends.find(
      (f) =>
        ((f.user_id === userId && f.friend_user_id === matchingProfile.id) ||
          (f.user_id === matchingProfile.id && f.friend_user_id === userId)) &&
        f.status !== "blocked"
    )

    if (duplicate) {
      setSaving(false)
      setMessage(
        duplicate.status === "active"
          ? "You are already connected with this user."
          : duplicate.user_id === userId
            ? "Friend request already sent."
            : "This user has already sent you a request. Approve it below."
      )
      return
    }

    const { data: connection, error: connectionError } = await supabase
      .from("friend_connections")
      .insert({
        user_id: userId,
        friend_label: matchingProfile.username,
        friend_user_id: matchingProfile.id,
        status: "pending"
      })
      .select("*")
      .single()

    if (connectionError || !connection) {
      setSaving(false)
      setMessage(connectionError?.message ?? "Unable to send friend request.")
      return
    }

    const { data: preference, error: preferenceError } = await supabase
      .from("accountability_preferences")
      .insert({
        owner_user_id: userId,
        friend_connection_id: connection.id,
        scope_type: "friend_default",
        exposure_level: addExposure,
        notification_cadence: addCadence
      })
      .select("*")
      .single()

    setSaving(false)

    if (preferenceError || !preference) {
      setMessage(preferenceError?.message ?? "Request sent, but could not save preference defaults.")
      return
    }

    setFriends((current) => [connection, ...current])
    setPreferences((current) => [preference, ...current])
    setFriendUsername("")
    setMessage("Friend request sent.")
  }

  async function approveFriendRequest(friend: FriendView) {
    setSaving(true)
    setMessage("")

    const supabase = createClerkSupabaseClient(session)
    const { data: updatedRequest, error: updateError } = await supabase
      .from("friend_connections")
      .update({ status: "active" })
      .eq("id", friend.id)
      .select("*")
      .single()

    if (updateError || !updatedRequest) {
      setSaving(false)
      setMessage(updateError?.message ?? "Unable to approve friend request.")
      return
    }

    const { data: reciprocalExisting } = await supabase
      .from("friend_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("friend_user_id", friend.user_id)
      .maybeSingle()

    let reciprocalConnection = reciprocalExisting

    if (reciprocalExisting) {
      const { data: reciprocalUpdated, error: reciprocalUpdateError } = await supabase
        .from("friend_connections")
        .update({ friend_label: friend.counterpartyUsername, status: "active" })
        .eq("id", reciprocalExisting.id)
        .select("*")
        .single()

      if (reciprocalUpdateError || !reciprocalUpdated) {
        setSaving(false)
        setMessage(reciprocalUpdateError?.message ?? "Approved, but could not finish the reciprocal link.")
        return
      }
      reciprocalConnection = reciprocalUpdated
    } else {
      const { data: reciprocalInserted, error: reciprocalInsertError } = await supabase
        .from("friend_connections")
        .insert({ user_id: userId, friend_user_id: friend.user_id, friend_label: friend.counterpartyUsername, status: "active" })
        .select("*")
        .single()

      if (reciprocalInsertError || !reciprocalInserted) {
        setSaving(false)
        setMessage(reciprocalInsertError?.message ?? "Approved, but could not create your side of the connection.")
        return
      }
      reciprocalConnection = reciprocalInserted
    }

    const { data: existingPreference } = await supabase
      .from("accountability_preferences")
      .select("*")
      .eq("owner_user_id", userId)
      .eq("friend_connection_id", reciprocalConnection.id)
      .eq("scope_type", "friend_default")
      .maybeSingle()

    let nextPreference = existingPreference

    if (!existingPreference) {
      const { data: insertedPreference, error: preferenceError } = await supabase
        .from("accountability_preferences")
        .insert({
          owner_user_id: userId,
          friend_connection_id: reciprocalConnection.id,
          scope_type: "friend_default",
          exposure_level: "reason_summary",
          notification_cadence: "realtime"
        })
        .select("*")
        .single()

      if (preferenceError || !insertedPreference) {
        setSaving(false)
        setMessage(preferenceError?.message ?? "Approved, but could not save your accountability preference.")
        return
      }
      nextPreference = insertedPreference
    }

    setSaving(false)
    setFriends((current) => {
      const filtered = current.filter((e) => e.id !== updatedRequest.id && e.id !== reciprocalConnection.id)
      return [reciprocalConnection, updatedRequest, ...filtered]
    })
    if (nextPreference) {
      setPreferences((current) => [nextPreference, ...current.filter((e) => e.id !== nextPreference.id)])
    }
    setMessage(`Connected with @${friend.counterpartyUsername}.`)
  }

  async function declineFriendRequest(friend: FriendView) {
    setSaving(true)
    setMessage("")
    const supabase = createClerkSupabaseClient(session)
    const { error } = await supabase.from("friend_connections").delete().eq("id", friend.id)
    setSaving(false)
    if (error) { setMessage(error.message); return }
    setFriends((current) => current.filter((e) => e.id !== friend.id))
    setMessage(`Declined request from @${friend.counterpartyUsername}.`)
  }

  function openEdit(friend: FriendView) {
    const pref = friendPreferenceMap.get(friend.id)
    setEditExposure(pref?.exposure_level ?? "reason_summary")
    setEditCadence(pref?.notification_cadence ?? "realtime")
    setEditingFriendId(friend.id)
  }

  async function saveFriendPreference(friend: FriendView) {
    setSaving(true)
    setMessage("")
    const supabase = createClerkSupabaseClient(session)
    const existing = friendPreferenceMap.get(friend.id)

    const payload: TableInsert<"accountability_preferences"> = {
      owner_user_id: userId,
      friend_connection_id: friend.id,
      scope_type: "friend_default",
      exposure_level: editExposure,
      notification_cadence: editCadence
    }

    const query = existing
      ? supabase.from("accountability_preferences").update(payload).eq("id", existing.id).select("*").single()
      : supabase.from("accountability_preferences").insert(payload).select("*").single()

    const { data, error } = await query
    setSaving(false)
    if (error || !data) { setMessage(error?.message ?? "Unable to save preference."); return }
    setPreferences((current) => [data, ...current.filter((p) => p.id !== data.id)])
    setEditingFriendId(null)
    setMessage(`Updated @${friend.counterpartyUsername}.`)
  }

  if (loading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[#9a6d62]">Loading friends...</p>
      </main>
    )
  }

  const pendingCount = incomingRequests.length + outgoingRequests.length

  return (
    <main className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">

      {/* Left column — add friend form (takes the wide side) */}
      <div className="rounded-[2rem] border border-[#eadcd7] bg-[linear-gradient(145deg,#fff7f4_0%,#fffdf8_48%,#f6efe7_100%)] p-8 shadow-[0_24px_70px_rgba(88,53,46,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6d62]">Add a contact</p>
        <h2 className="mt-1 text-2xl font-semibold text-[#2d201c]">Invite a friend</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#6b544e]">Set how much they can see about your overrides before sending the request.</p>

        {message ? (
          <p className="mt-4 rounded-xl bg-[#f4e4de] px-3 py-2 text-sm text-[#6f4338]">{message}</p>
        ) : null}

        <form className="mt-6" onSubmit={addFriend}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#2d201c]" htmlFor="friend-username">
              Username
            </label>
            <input
              className="mt-1.5 w-full rounded-xl border border-[#d8c2ba] bg-white px-3 py-2.5 text-sm text-[#2d201c] placeholder:text-[#b8a09a] outline-none focus:border-[#b88579] focus:ring-2 focus:ring-[#f4e4de]"
              id="friend-username"
              onChange={(e) => setFriendUsername(e.target.value)}
              placeholder="@username"
              value={friendUsername}
            />
          </div>

          {/* Preference picker in 2-col grid to fill the wide column */}
          <div className="grid gap-4 sm:grid-cols-2">
            <PreferenceGroup
              label="What they can see"
              name="exposure-level"
              onChange={(v) => setAddExposure(v as typeof addExposure)}
              options={EXPOSURE_OPTIONS}
              value={addExposure}
            />
            <PreferenceGroup
              label="Notifications"
              name="add-notification-cadence"
              onChange={(v) => setAddCadence(v as typeof addCadence)}
              options={CADENCE_OPTIONS}
              value={addCadence}
            />
          </div>

          <button
            className="mt-5 rounded-xl bg-[#2d201c] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4a342e] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            type="submit"
          >
            {saving ? "Sending…" : "Send request"}
          </button>
        </form>
      </div>

      {/* Right column — notification mode + friends list + pending requests */}
      <div className="space-y-4">
        {/* Global inbound notification mode */}
        <div className="rounded-[1.5rem] border border-[#eadcd7] bg-white/85 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6d62]">Notifications</p>
            {!editingInboundMode ? (
              <button
                className="text-[11px] font-medium text-[#9a6d62] underline underline-offset-2 hover:text-[#6f4338]"
                onClick={() => { setDraftInboundMode(inboundMode); setEditingInboundMode(true) }}
                type="button"
              >
                Edit
              </button>
            ) : (
              <button
                className="text-[11px] font-medium text-[#9a6d62] underline underline-offset-2 hover:text-[#6f4338]"
                onClick={() => setEditingInboundMode(false)}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
          {!editingInboundMode ? (
            <span className="inline-block rounded-full bg-[#f4e4de] px-2.5 py-0.5 text-[11px] font-semibold text-[#6f4338]">
              {INBOUND_MODE_OPTIONS.find((o) => o.value === inboundMode)?.label ?? "On"}
            </span>
          ) : (
            <div className="mt-2 space-y-3">
              <PreferenceGroup
                label=""
                name="inbound-notification-mode"
                onChange={(v) => setDraftInboundMode(v as typeof inboundMode)}
                options={INBOUND_MODE_OPTIONS}
                value={draftInboundMode}
              />
              <button
                className="w-full rounded-lg bg-[#2d201c] py-2 text-xs font-semibold text-white hover:bg-[#4a342e] disabled:opacity-50"
                disabled={saving}
                onClick={() => { void saveInboundMode(draftInboundMode); setEditingInboundMode(false) }}
                type="button"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Active friends */}
        <div className="rounded-[1.5rem] border border-[#eadcd7] bg-white/85 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6d62]">Friends</p>
            {activeFriends.length > 0 ? (
              <span className="rounded-full bg-[#f4e4de] px-2 py-0.5 text-[11px] font-semibold text-[#6f4338]">{activeFriends.length}</span>
            ) : null}
          </div>

          {activeFriends.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d8c2ba] bg-[#fffaf7] px-3 py-4 text-center text-xs text-[#9a6d62]">
              No friends yet — send a request.
            </p>
          ) : (
            <div className="space-y-2">
              {activeFriends.map((friend) => {
                const pref = friendPreferenceMap.get(friend.id)
                const isEditing = editingFriendId === friend.id

                return (
                  <article
                    className="rounded-xl border border-[#eadcd7] bg-[#fffaf7] p-3"
                    key={friend.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#2d201c] truncate">@{friend.counterpartyUsername}</p>
                      <button
                        className="shrink-0 text-[11px] font-medium text-[#9a6d62] underline underline-offset-2 hover:text-[#6f4338]"
                        onClick={() => isEditing ? setEditingFriendId(null) : openEdit(friend)}
                        type="button"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                    </div>

                    {!isEditing ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <ExposureBadge value={pref?.exposure_level ?? "reason_summary"} />
                        <CadenceBadge value={pref?.notification_cadence ?? "realtime"} />
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <PreferenceGroup
                          label="What they can see"
                          name={`exposure-${friend.id}`}
                          onChange={(v) => setEditExposure(v as typeof editExposure)}
                          options={EXPOSURE_OPTIONS}
                          value={editExposure}
                        />
                        <PreferenceGroup
                          label="Notifications"
                          name={`cadence-${friend.id}`}
                          onChange={(v) => setEditCadence(v as typeof editCadence)}
                          options={CADENCE_OPTIONS}
                          value={editCadence}
                        />
                        <button
                          className="w-full rounded-lg bg-[#2d201c] py-2 text-xs font-semibold text-white hover:bg-[#4a342e] disabled:opacity-50"
                          disabled={saving}
                          onClick={() => saveFriendPreference(friend)}
                          type="button"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {/* Pending requests — always visible */}
        <div className="rounded-[1.5rem] border border-[#eadcd7] bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6d62] mb-3">Requests</p>

          {pendingCount === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d8c2ba] bg-[#fffaf7] px-3 py-4 text-center text-xs text-[#9a6d62]">
              No pending requests.
            </p>
          ) : null}

          {incomingRequests.length > 0 ? (
            <div className="space-y-2 mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Incoming</p>
              {incomingRequests.map((friend) => (
                <div className="rounded-xl border border-[#eadcd7] bg-[#fffaf7] p-3" key={friend.id}>
                  <p className="text-sm font-semibold text-[#2d201c]">@{friend.counterpartyUsername}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-lg bg-[#2d201c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4a342e] disabled:opacity-50"
                      disabled={saving}
                      onClick={() => approveFriendRequest(friend)}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-lg border border-[#d8c2ba] bg-white px-3 py-1.5 text-xs font-medium text-[#6b544e] hover:bg-[#fff8f5] disabled:opacity-50"
                      disabled={saving}
                      onClick={() => declineFriendRequest(friend)}
                      type="button"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {outgoingRequests.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Sent</p>
              {outgoingRequests.map((friend) => (
                <div className="rounded-xl border border-dashed border-[#d8c2ba] bg-[#fffaf7] p-3" key={friend.id}>
                  <p className="text-sm font-semibold text-[#2d201c]">@{friend.counterpartyUsername}</p>
                  <p className="mt-0.5 text-xs text-[#9a6d62]">Waiting for approval</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function PreferenceGroup({
  label,
  name,
  options,
  value,
  onChange
}: {
  label: string
  name: string
  options: Array<{ value: string; label: string; description: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="rounded-2xl border border-[#eadcd7] bg-[#fffaf7] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#9a6d62]">{label}</p>
      <div className="space-y-1.5">
        {options.map((option) => (
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
              value === option.value
                ? "border-[#b88579] bg-white shadow-sm"
                : "border-transparent hover:border-[#eadcd7] hover:bg-white"
            }`}
            key={option.value}
          >
            <input
              checked={value === option.value}
              className="mt-0.5 shrink-0 accent-[#b88579]"
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
            />
            <div>
              <span className="text-sm font-medium text-[#2d201c]">{option.label}</span>
              <p className="text-xs leading-5 text-[#9a6d62]">{option.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function ExposureBadge({ value }: { value: TableRow<"accountability_preferences">["exposure_level"] }) {
  const labels: Record<typeof value, string> = {
    reason_summary: "Reason summary",
    event_only: "Event only",
    counts_only: "Counts only"
  }
  return (
    <span className="rounded-full border border-[#eadcd7] bg-[#fff8f5] px-2.5 py-0.5 text-xs font-medium text-[#9a6d62]">
      {labels[value]}
    </span>
  )
}

function CadenceBadge({ value }: { value: TableRow<"accountability_preferences">["notification_cadence"] }) {
  const labels: Record<string, string> = {
    realtime: "Realtime",
    daily_digest: "Daily digest",
    weekly_digest: "Weekly digest",
    off: "Off"
  }
  return (
    <span className="rounded-full border border-[#eadcd7] bg-[#fff8f5] px-2.5 py-0.5 text-xs font-medium text-[#9a6d62]">
      {labels[value] ?? value}
    </span>
  )
}
