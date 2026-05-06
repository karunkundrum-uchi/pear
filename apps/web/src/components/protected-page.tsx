"use client"

import { useEffect, useState } from "react"
import { useSession, useUser } from "@clerk/nextjs"
import { createClerkSupabaseClient } from "@/lib/supabase"

type ProtectedSession = {
  getToken: () => Promise<string | null>
}

type ProtectedUser = {
  id: string
  firstName: string | null
  username: string | null
  primaryEmailAddress?: {
    emailAddress: string
  } | null
}

type ProtectedPageProps = {
  children: (context: {
    session: ProtectedSession
    user: ProtectedUser
  }) => React.ReactNode
}

export function ProtectedPage({ children }: ProtectedPageProps) {
  const { session, isLoaded: sessionLoaded } = useSession()
  const { user, isLoaded: userLoaded } = useUser()
  const [message, setMessage] = useState("")

  useEffect(() => {
    async function ensureProfile() {
      if (!sessionLoaded || !userLoaded || !session || !user) {
        return
      }

      const supabase = createClerkSupabaseClient(session)
      const requestedUsername =
        user.username ??
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ??
        user.firstName ??
        "pearuser"

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        display_name: user.firstName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? null
      })

      if (error) {
        setMessage(error.message)
        return
      }

      const { error: usernameError } = await supabase.rpc("ensure_profile_username", {
        profile_id: user.id,
        requested_username: requestedUsername
      })

      if (usernameError) {
        setMessage(usernameError.message)
      }
    }

    void ensureProfile()
  }, [session, sessionLoaded, user, userLoaded])

  if (!sessionLoaded || !userLoaded || !session || !user) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm text-slate-600">Loading workspace...</p>
      </main>
    )
  }

  return (
    <>
      {message ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}
      {children({ session, user })}
    </>
  )
}
