"use client"

import { useClerk, useSession, useUser } from "@clerk/nextjs"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { createClerkSupabaseClient } from "@/lib/supabase"

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Stats and streak signals"
  },
  {
    href: "/setup",
    label: "Setup",
    description: "Windows, sites, and install"
  },
  {
    href: "/groups",
    label: "Groups",
    description: "Friends and accountability"
  }
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { session, isLoaded: sessionLoaded } = useSession()
  const { user, isLoaded: userLoaded } = useUser()
  const { signOut } = useClerk()
  const [accountUsername, setAccountUsername] = useState("")

  useEffect(() => {
    if (sessionLoaded && userLoaded && (!session || !user)) {
      router.replace("/sign-in")
    }
  }, [router, session, sessionLoaded, user, userLoaded])

  useEffect(() => {
    async function loadUsername() {
      if (!sessionLoaded || !userLoaded || !session || !user) {
        return
      }

      const supabase = createClerkSupabaseClient(session)
      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      setAccountUsername(data?.username ?? "")
    }

    void loadUsername()
  }, [session, sessionLoaded, user, userLoaded])

  if (!sessionLoaded || !userLoaded || !session || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-slate-600">Loading Pear...</p>
      </main>
    )
  }

  async function handleSignOut() {
    await signOut({ redirectUrl: "/sign-in" })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_32rem),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="flex min-h-screen w-full flex-col px-8 py-6">
        <header className="border-b border-white/70 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">Pear</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Attention control center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Keep the dashboard focused on signal, keep setup separate, and make accountability explicit.
            </p>
            </div>

            <div className="ml-auto flex flex-col items-end gap-3">
              <nav className="flex flex-wrap items-center justify-end gap-2">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href

                  return (
                    <Link
                      className={`rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition ${
                        active
                          ? "border-teal-700 bg-teal-50 text-teal-950"
                          : "border-white/80 bg-white/90 text-slate-700 hover:border-slate-200 hover:bg-white"
                      }`}
                      href={item.href}
                      key={item.href}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-right shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Account</p>
                  {accountUsername ? <p className="text-sm font-semibold text-slate-900">@{accountUsername}</p> : null}
                  <p className="text-xs text-slate-600">{user.primaryEmailAddress?.emailAddress}</p>
                </div>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                  onClick={handleSignOut}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 py-6">{children}</div>
      </div>
    </div>
  )
}
