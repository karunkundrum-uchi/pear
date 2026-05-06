"use client"

import { useEffect, useMemo, useState } from "react"
import { ProtectedPage } from "@/components/protected-page"
import { createClerkSupabaseClient } from "@/lib/supabase"
import type { TableInsert, TableRow } from "@pear/shared"

type Group = TableRow<"groups">
type GroupInvite = TableRow<"group_invites">
type GroupMembership = TableRow<"group_memberships">
type FriendConnection = TableRow<"friend_connections">
type AccountabilityPreference = TableRow<"accountability_preferences">
type Profile = TableRow<"profiles">
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
    value: "event_only",
    label: "Event only",
    description: "Friends know an override happened and where the pressure came from."
  },
  {
    value: "reason_summary",
    label: "Reason summary",
    description: "Closer contacts can also see the reason you typed when you continue."
  },
  {
    value: "counts_only",
    label: "Counts only",
    description: "The relationship affects accountability stats, but not live event detail."
  }
]

const CADENCE_OPTIONS: Array<{
  value: TableInsert<"accountability_preferences">["notification_cadence"]
  label: string
}> = [
  { value: "realtime", label: "Realtime" },
  { value: "daily_digest", label: "Daily digest" },
  { value: "weekly_digest", label: "Weekly digest" },
  { value: "off", label: "Off" }
]

function isMissingGroupSchemaError(message?: string) {
  return Boolean(message && message.includes("Could not find the table 'public.group"))
}

export default function GroupsPage() {
  return (
    <ProtectedPage>
      {({ session, user }) => <GroupsContent session={session} userId={user.id} />}
    </ProtectedPage>
  )
}

function GroupsContent({
  session,
  userId
}: {
  session: ProtectedSession
  userId: string
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [groups, setGroups] = useState<Group[]>([])
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const [invites, setInvites] = useState<GroupInvite[]>([])
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [preferences, setPreferences] = useState<AccountabilityPreference[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({})
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [friendUsername, setFriendUsername] = useState("")
  const [inviteExposure, setInviteExposure] = useState<TableInsert<"accountability_preferences">["exposure_level"]>("event_only")
  const [inviteCadence, setInviteCadence] = useState<TableInsert<"accountability_preferences">["notification_cadence"]>("daily_digest")
  const [schemaReady, setSchemaReady] = useState(true)

  async function loadGroupsState() {
    const supabase = createClerkSupabaseClient(session)
    const [groupsResult, membershipsResult, invitesResult, friendsResult, preferencesResult] = await Promise.all([
      supabase.from("groups").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false }),
      supabase.from("group_memberships").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("group_invites").select("*").eq("inviter_user_id", userId).order("created_at", { ascending: false }),
      supabase.from("friend_connections").select("*").or(`user_id.eq.${userId},friend_user_id.eq.${userId}`).order("created_at", { ascending: false }),
      supabase.from("accountability_preferences").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false })
    ])

    const nextFriends = friendsResult.data ?? []

    const groupSchemaMissing =
      isMissingGroupSchemaError(groupsResult.error?.message) ||
      isMissingGroupSchemaError(membershipsResult.error?.message) ||
      isMissingGroupSchemaError(invitesResult.error?.message) ||
      isMissingGroupSchemaError(friendsResult.error?.message) ||
      isMissingGroupSchemaError(preferencesResult.error?.message)

    if (!groupSchemaMissing && (groupsResult.error || membershipsResult.error || invitesResult.error || friendsResult.error || preferencesResult.error)) {
      setMessage(
        groupsResult.error?.message ??
          membershipsResult.error?.message ??
          invitesResult.error?.message ??
          friendsResult.error?.message ??
          preferencesResult.error?.message ??
          ""
      )
      setLoading(false)
      return
    }

    if (groupSchemaMissing) {
      setSchemaReady(false)
      setMessage("Groups will appear after the new Supabase migration is applied.")
      setLoading(false)
      return
    }

    setGroups(groupsResult.data ?? [])
    setMemberships(membershipsResult.data ?? [])
    setInvites(invitesResult.data ?? [])
    setFriends(nextFriends)
    setPreferences(preferencesResult.data ?? [])
    const relatedProfileIds: string[] = Array.from(
      new Set(
        nextFriends
          .flatMap((friend) => [friend.user_id, friend.friend_user_id])
          .filter((value): value is string => Boolean(value))
      )
    )

    if (relatedProfileIds.length > 0) {
      const { data: relatedProfiles } = await supabase.from("profiles").select("*").in("id", relatedProfileIds)
      setProfilesById(
        Object.fromEntries((relatedProfiles ?? []).map((profile) => [profile.id, profile]))
      )
    } else {
      setProfilesById({})
    }
    setSchemaReady(true)
    setLoading(false)
  }

  useEffect(() => {
    async function loadGroups() {
      await loadGroupsState()
    }

    void loadGroups()
  }, [session, userId])

  const groupPreferenceMap = useMemo(() => {
    return new Map(
      preferences
        .filter((preference) => preference.scope_type === "group_default" && preference.group_id)
        .map((preference) => [preference.group_id as string, preference])
    )
  }, [preferences])

  const friendPreferenceMap = useMemo(() => {
    return new Map(
      preferences
        .filter((preference) => preference.scope_type === "friend_default" && preference.friend_connection_id)
        .map((preference) => [preference.friend_connection_id as string, preference])
    )
  }, [preferences])

  const activeFriends = useMemo(() => {
    return friends
      .filter((friend) => friend.user_id === userId && friend.status === "active")
      .map((friend) => ({
        ...friend,
        counterpartyUsername: profilesById[friend.friend_user_id ?? ""]?.username ?? friend.friend_label
      }))
  }, [friends, profilesById, userId])

  const outgoingRequests = useMemo(() => {
    return friends
      .filter((friend) => friend.user_id === userId && friend.status === "pending")
      .map((friend) => ({
        ...friend,
        counterpartyUsername: profilesById[friend.friend_user_id ?? ""]?.username ?? friend.friend_label
      }))
  }, [friends, profilesById, userId])

  const incomingRequests = useMemo(() => {
    return friends
      .filter((friend) => friend.friend_user_id === userId && friend.status === "pending")
      .map((friend) => ({
        ...friend,
        counterpartyUsername: profilesById[friend.user_id]?.username ?? friend.friend_label
      }))
  }, [friends, profilesById, userId])

  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!groupName.trim()) {
      setMessage("Give the group a name.")
      return
    }

    setSaving(true)
    setMessage("")

    const supabase = createClerkSupabaseClient(session)
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({
        owner_user_id: userId,
        name: groupName.trim(),
        description: groupDescription.trim() || null
      })
      .select("*")
      .single()

    if (groupError || !group) {
      setSaving(false)
      setMessage(groupError?.message ?? "Unable to create group.")
      return
    }

    const { data: membership, error: membershipError } = await supabase
      .from("group_memberships")
      .insert({
        group_id: group.id,
        user_id: userId,
        role: "owner",
        status: "active"
      })
      .select("*")
      .single()

    const { data: preference, error: preferenceError } = await supabase
      .from("accountability_preferences")
      .insert({
        owner_user_id: userId,
        group_id: group.id,
        scope_type: "group_default",
        exposure_level: inviteExposure,
        notification_cadence: inviteCadence
      })
      .select("*")
      .single()

    setSaving(false)

    if (membershipError || preferenceError || !membership || !preference) {
      setMessage(membershipError?.message ?? preferenceError?.message ?? "Unable to finish group setup.")
      return
    }

    setGroups((current) => [group, ...current])
    setMemberships((current) => [membership, ...current])
    setPreferences((current) => [preference, ...current])
    setGroupName("")
    setGroupDescription("")
    setMessage("Group created.")
  }

  async function createFriendConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!friendUsername.trim()) {
      setMessage("Enter your friend's username.")
      return
    }

    setSaving(true)
    setMessage("")

    const supabase = createClerkSupabaseClient(session)
    const normalizedUsername = friendUsername.trim().replace(/^@+/, "").toLowerCase()

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", normalizedUsername)
      .maybeSingle()

    if (targetProfileError) {
      setSaving(false)
      setMessage(targetProfileError.message)
      return
    }

    if (!targetProfile) {
      setSaving(false)
      setMessage("No user found with that username.")
      return
    }

    if (targetProfile.id === userId) {
      setSaving(false)
      setMessage("You cannot add yourself.")
      return
    }

    const duplicate = friends.find(
      (friend) =>
        ((friend.user_id === userId && friend.friend_user_id === targetProfile.id) ||
          (friend.user_id === targetProfile.id && friend.friend_user_id === userId)) &&
        friend.status !== "blocked"
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
        friend_label: targetProfile.username,
        friend_user_id: targetProfile.id,
        status: "pending"
      })
      .select("*")
      .single()

    if (connectionError || !connection) {
      setSaving(false)
      setMessage(connectionError?.message ?? "Unable to add friend connection.")
      return
    }

    const { data: preference, error: preferenceError } = await supabase
      .from("accountability_preferences")
      .insert({
        owner_user_id: userId,
        friend_connection_id: connection.id,
        scope_type: "friend_default",
        exposure_level: inviteExposure,
        notification_cadence: inviteCadence
      })
      .select("*")
      .single()

    setSaving(false)

    if (preferenceError || !preference) {
      setMessage(preferenceError?.message ?? "Friend added without preference defaults.")
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
        .update({
          friend_label: friend.counterpartyUsername,
          status: "active"
        })
        .eq("id", reciprocalExisting.id)
        .select("*")
        .single()

      if (reciprocalUpdateError || !reciprocalUpdated) {
        setSaving(false)
        setMessage(reciprocalUpdateError?.message ?? "Approved request, but could not finish the reciprocal link.")
        return
      }

      reciprocalConnection = reciprocalUpdated
    } else {
      const { data: reciprocalInserted, error: reciprocalInsertError } = await supabase
        .from("friend_connections")
        .insert({
          user_id: userId,
          friend_user_id: friend.user_id,
          friend_label: friend.counterpartyUsername,
          status: "active"
        })
        .select("*")
        .single()

      if (reciprocalInsertError || !reciprocalInserted) {
        setSaving(false)
        setMessage(reciprocalInsertError?.message ?? "Approved request, but could not create your side of the connection.")
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
          exposure_level: "event_only",
          notification_cadence: "daily_digest"
        })
        .select("*")
        .single()

      if (preferenceError || !insertedPreference) {
        setSaving(false)
        setMessage(preferenceError?.message ?? "Approved request, but could not save your default accountability preference.")
        return
      }

      nextPreference = insertedPreference
    }

    setSaving(false)
    setFriends((current) => {
      const filtered = current.filter((entry) => entry.id !== updatedRequest.id && entry.id !== reciprocalConnection.id)
      return [reciprocalConnection, updatedRequest, ...filtered]
    })
    if (nextPreference) {
      setPreferences((current) => [nextPreference, ...current.filter((entry) => entry.id !== nextPreference.id)])
    }
    setMessage(`Friend request from @${friend.counterpartyUsername} approved.`)
  }

  async function declineFriendRequest(friend: FriendView) {
    setSaving(true)
    setMessage("")
    const supabase = createClerkSupabaseClient(session)
    const { error } = await supabase.from("friend_connections").delete().eq("id", friend.id)
    setSaving(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setFriends((current) => current.filter((entry) => entry.id !== friend.id))
    setMessage(`Friend request from @${friend.counterpartyUsername} declined.`)
  }

  async function createInvite(groupId: string) {
    setSaving(true)
    setMessage("")

    const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const supabase = createClerkSupabaseClient(session)
    const { data, error } = await supabase
      .from("group_invites")
      .insert({
        group_id: groupId,
        inviter_user_id: userId,
        invite_code: inviteCode,
        expires_at: expiresAt,
        status: "pending"
      })
      .select("*")
      .single()

    setSaving(false)

    if (error || !data) {
      setMessage(error?.message ?? "Unable to create invite.")
      return
    }

    setInvites((current) => [data, ...current])
    setMessage(`Invite code ${inviteCode} created.`)
  }

  async function saveMembershipOverride(membershipId: string) {
    setSaving(true)
    setMessage("")
    const supabase = createClerkSupabaseClient(session)
    const existing = preferences.find(
      (preference) => preference.scope_type === "membership_override" && preference.group_membership_id === membershipId
    )

    const payload: TableInsert<"accountability_preferences"> = {
      owner_user_id: userId,
      group_membership_id: membershipId,
      scope_type: "membership_override",
      exposure_level: inviteExposure,
      notification_cadence: inviteCadence
    }

    const query = existing
      ? supabase.from("accountability_preferences").update(payload).eq("id", existing.id).select("*").single()
      : supabase.from("accountability_preferences").insert(payload).select("*").single()

    const { data, error } = await query
    setSaving(false)

    if (error || !data) {
      setMessage(error?.message ?? "Unable to save override.")
      return
    }

    setPreferences((current) => [data, ...current.filter((preference) => preference.id !== data.id)])
    setMessage("Per-member override saved.")
  }

  if (loading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm text-slate-600">Loading groups...</p>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      {!schemaReady ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Groups pending</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Apply the Supabase migration to enable this page</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            The web app code is ready, but the database in this environment does not have the new groups tables yet. Once the migration is applied, this page will load group creation, invite codes, direct friends, and accountability preferences.
          </p>
        </section>
      ) : null}

      <section className={`grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] ${!schemaReady ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Groups</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Build accountability without putting setup here</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Use named groups for shared accountability spaces. Use direct friend links for one-to-one support. Default to moderate exposure, then override only when a specific relationship needs more or less visibility.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <form className="rounded-3xl border border-slate-200 bg-slate-50 p-4" onSubmit={createGroup}>
              <h3 className="text-lg font-semibold text-slate-950">Create a group</h3>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Name</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Roommates"
                    value={groupName}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Description</span>
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setGroupDescription(event.target.value)}
                    placeholder="Who this group is for and how visible overrides should feel."
                    value={groupDescription}
                  />
                </label>
              </div>
              <PreferencePicker
                cadence={inviteCadence}
                exposure={inviteExposure}
                onCadenceChange={setInviteCadence}
                onExposureChange={setInviteExposure}
              />
              <button
                className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                Create group
              </button>
            </form>

            <form className="rounded-3xl border border-slate-200 bg-slate-50 p-4" onSubmit={createFriendConnection}>
              <h3 className="text-lg font-semibold text-slate-950">Add a direct friend</h3>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Friend identifier</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setFriendUsername(event.target.value)}
                    placeholder="@friendusername"
                    value={friendUsername}
                  />
                </label>
              </div>
              <PreferencePicker
                cadence={inviteCadence}
                exposure={inviteExposure}
                onCadenceChange={setInviteCadence}
                onExposureChange={setInviteExposure}
              />
              <button
                className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                Create friend link
              </button>
            </form>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Default accountability stance</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>Start with `event only` and a `daily digest`. It keeps accountability real without turning every override into full surveillance.</p>
            <p>Use per-member overrides only for the relationships that genuinely need more detail or less noise.</p>
            <p>Invites generate a share code today. Accepting and syncing the other side is the next layer once the schema lands and the dashboard placeholders are ready to consume group activity.</p>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-slate-950">Your groups</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{groups.length} total</span>
          </div>
          <div className="mt-4 space-y-4">
            {groups.length > 0 ? (
              groups.map((group) => {
                const preference = groupPreferenceMap.get(group.id)
                const groupInviteCount = invites.filter((invite) => invite.group_id === group.id).length
                const membership = memberships.find((entry) => entry.group_id === group.id && entry.user_id === userId)

                return (
                  <article className="rounded-2xl border border-slate-200 p-4" key={group.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{group.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{group.description || "No description yet."}</p>
                      </div>
                      <button
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                        disabled={saving}
                        onClick={() => createInvite(group.id)}
                        type="button"
                      >
                        Create invite
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-slate-600">
                      <p>Default exposure: {preference?.exposure_level ?? "event_only"}</p>
                      <p>Cadence: {preference?.notification_cadence ?? "daily_digest"}</p>
                      <p>Open invites: {groupInviteCount}</p>
                    </div>
                    {membership ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">Save a personal override for this group membership</p>
                          <button
                            className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                            disabled={saving}
                            onClick={() => saveMembershipOverride(membership.id)}
                            type="button"
                          >
                            Save override
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          This uses the current selector state above as the per-member override. It is intentionally explicit so the default stays conservative.
                        </p>
                      </div>
                    ) : null}
                  </article>
                )
              })
            ) : (
              <EmptyPanel text="No groups yet." />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-950">Direct friends</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{activeFriends.length} active</span>
            </div>
            <div className="mt-4 space-y-4">
              {activeFriends.length > 0 ? (
                activeFriends.map((friend) => {
                  const preference = friendPreferenceMap.get(friend.id)
                  return (
                    <article className="rounded-2xl border border-slate-200 p-4" key={friend.id}>
                      <p className="text-sm font-semibold text-slate-950">@{friend.counterpartyUsername}</p>
                      <div className="mt-2 grid gap-2 text-sm text-slate-600">
                        <p>Username: @{friend.counterpartyUsername}</p>
                        <p>Status: {friend.status}</p>
                        <p>Exposure: {preference?.exposure_level ?? "event_only"}</p>
                        <p>Cadence: {preference?.notification_cadence ?? "daily_digest"}</p>
                      </div>
                    </article>
                  )
                })
              ) : (
                <EmptyPanel text="No direct accountability links yet." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-950">Incoming requests</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{incomingRequests.length} pending</span>
            </div>
            <div className="mt-4 space-y-4">
              {incomingRequests.length > 0 ? (
                incomingRequests.map((friend) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={friend.id}>
                    <p className="text-sm font-semibold text-slate-950">@{friend.counterpartyUsername}</p>
                    <p className="mt-2 text-sm text-slate-600">This person wants to become an accountability contact.</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        disabled={saving}
                        onClick={() => approveFriendRequest(friend)}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                        disabled={saving}
                        onClick={() => declineFriendRequest(friend)}
                        type="button"
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyPanel text="No incoming friend requests." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-950">Outgoing requests</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{outgoingRequests.length} pending</span>
            </div>
            <div className="mt-4 space-y-4">
              {outgoingRequests.length > 0 ? (
                outgoingRequests.map((friend) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={friend.id}>
                    <p className="text-sm font-semibold text-slate-950">@{friend.counterpartyUsername}</p>
                    <p className="mt-2 text-sm text-slate-600">Request sent. This link becomes active after they approve it.</p>
                  </article>
                ))
              ) : (
                <EmptyPanel text="No outgoing friend requests." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-slate-950">Invite codes</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{invites.length} active</span>
            </div>
            <div className="mt-4 space-y-4">
              {invites.length > 0 ? (
                invites.map((invite) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={invite.id}>
                    <p className="text-sm font-semibold text-slate-950">{invite.invite_code}</p>
                    <div className="mt-2 grid gap-2 text-sm text-slate-600">
                      <p>Group: {groups.find((group) => group.id === invite.group_id)?.name ?? invite.group_id}</p>
                      <p>Status: {invite.status}</p>
                      <p>Expires: {new Date(invite.expires_at).toLocaleString()}</p>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyPanel text="No invite codes created yet." />
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function PreferencePicker({
  exposure,
  cadence,
  onExposureChange,
  onCadenceChange
}: {
  exposure: TableInsert<"accountability_preferences">["exposure_level"]
  cadence: TableInsert<"accountability_preferences">["notification_cadence"]
  onExposureChange: (value: TableInsert<"accountability_preferences">["exposure_level"]) => void
  onCadenceChange: (value: TableInsert<"accountability_preferences">["notification_cadence"]) => void
}) {
  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Exposure default</p>
        <div className="mt-2 grid gap-2">
          {EXPOSURE_OPTIONS.map((option) => (
            <label className="rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-700" key={option.value}>
              <div className="flex items-center gap-2">
                <input
                  checked={exposure === option.value}
                  name="exposure-level"
                  onChange={() => onExposureChange(option.value)}
                  type="radio"
                />
                <span className="font-medium text-slate-900">{option.label}</span>
              </div>
              <p className="mt-1 leading-6 text-slate-600">{option.description}</p>
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Notification cadence</span>
        <select
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          onChange={(event) =>
            onCadenceChange(event.target.value as TableInsert<"accountability_preferences">["notification_cadence"])
          }
          value={cadence}
        >
          {CADENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  )
}
