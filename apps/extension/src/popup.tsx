import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { getExtensionSupabase } from "./lib/supabase"
import "./style.css"

type SessionTokens = {
  access_token: string
  refresh_token: string
}

export default function Popup() {
  const supabase = getExtensionSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    let active = true

    async function loadUser() {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (active) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    }

    loadUser()

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      void chrome.runtime.sendMessage({ type: "PEAR_REFRESH_CONFIG" })
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage(error.message)
      return
    }

    setPassword("")
    await chrome.runtime.sendMessage({ type: "PEAR_REFRESH_CONFIG" })
  }

  async function signOut() {
    await supabase.auth.signOut()
    await chrome.runtime.sendMessage({ type: "PEAR_REFRESH_CONFIG" })
  }

  async function connectFromDashboard() {
    setConnecting(true)
    setMessage("")

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url) {
        setMessage("Open the Pear dashboard tab first.")
        return
      }

      const dashboardBaseUrl = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"
      const dashboardOrigin = new URL(dashboardBaseUrl).origin

      if (!tab.url.startsWith(dashboardOrigin)) {
        setMessage("Open Pear in the current tab, then connect again.")
        return
      }

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: readSessionTokensFromPage
      })

      if (!result?.access_token || !result?.refresh_token) {
        setMessage("No Pear session found in this tab. Sign in on the dashboard first.")
        return
      }

      const { error } = await supabase.auth.setSession(result)
      if (error) {
        setMessage(error.message)
        return
      }

      await chrome.runtime.sendMessage({ type: "PEAR_REFRESH_CONFIG" })
      setPassword("")
      setMessage("Connected to your dashboard session.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect to the dashboard tab.")
    } finally {
      setConnecting(false)
    }
  }

  function openDashboard() {
    const dashboardUrl = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"
    void chrome.tabs.create({ url: `${dashboardUrl}/dashboard` })
  }

  if (loading) {
    return (
      <main className="popup-shell">
        <p className="muted">Loading Pear...</p>
      </main>
    )
  }

  return (
    <main className="popup-shell">
      <p className="brand">Pear</p>
      {user ? (
        <section className="stack">
          <div className="card">
            <p className="popup-title">Signed in</p>
            <p className="small">{user.email}</p>
          </div>
          <button
            className="button-primary"
            onClick={openDashboard}
            type="button"
          >
            Open dashboard
          </button>
          <button
            className="button-secondary"
            onClick={signOut}
            type="button"
          >
            Sign out
          </button>
        </section>
      ) : (
        <section className="stack">
          <div className="card">
            <p className="popup-title">Connect Pear</p>
            <p className="small">Open the Pear dashboard in this window, sign in there, then connect once here.</p>
          </div>
          <button className="button-primary" disabled={connecting} onClick={connectFromDashboard} type="button">
            {connecting ? "Connecting..." : "Connect from dashboard tab"}
          </button>
          <button className="button-secondary" onClick={openDashboard} type="button">
            Open dashboard
          </button>
          <form className="stack subtle-section" onSubmit={signIn}>
            <label className="block">
              <span className="label">Email</span>
              <input
                className="input"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input
                className="input"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button className="button-secondary" type="submit">
              Sign in manually
            </button>
          </form>
          {message ? <p className="message">{message}</p> : null}
        </section>
      )}
    </main>
  )
}

function readSessionTokensFromPage(): SessionTokens | null {
  const authKey = Object.keys(window.localStorage).find(
    (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
  )

  if (!authKey) {
    return null
  }

  const raw = window.localStorage.getItem(authKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as
      | {
          access_token?: string
          refresh_token?: string
        }
      | null

    if (!parsed?.access_token || !parsed.refresh_token) {
      return null
    }

    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token
    }
  } catch {
    return null
  }
}
