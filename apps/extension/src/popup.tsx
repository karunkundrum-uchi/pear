import {
  ClerkProvider,
  Show,
  UserButton,
  useAuth,
  useUser
} from "@clerk/chrome-extension"
import { useEffect } from "react"
import "./style.css"

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST
const EXTENSION_URL = chrome.runtime.getURL("")

if (!publishableKey || !syncHost) {
  throw new Error("Missing Clerk extension environment variables")
}

const PUBLISHABLE_KEY: string = publishableKey
const SYNC_HOST: string = syncHost

export default function Popup() {
  return (
    <ClerkProvider
      afterSignOutUrl={`${EXTENSION_URL}popup.html`}
      publishableKey={PUBLISHABLE_KEY}
      signInFallbackRedirectUrl={`${EXTENSION_URL}popup.html`}
      signUpFallbackRedirectUrl={`${EXTENSION_URL}popup.html`}
      syncHost={SYNC_HOST}
    >
      <PopupContent />
    </ClerkProvider>
  )
}

function PopupContent() {
  const { user } = useUser()
  const { isLoaded, isSignedIn } = useAuth()
  const dashboardUrl = process.env.PLASMO_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    void chrome.runtime.sendMessage({ type: "PEAR_REFRESH_CONFIG" })
  }, [isLoaded, isSignedIn])

  function openUrl(path = "") {
    void chrome.tabs.create({ url: `${dashboardUrl}${path}` })
  }

  if (!isLoaded) {
    return (
      <main className="popup-shell">
        <p className="muted">Loading Pear...</p>
      </main>
    )
  }

  return (
    <main className="popup-shell">
      <p className="brand">Pear</p>
      <Show when="signed-in">
        <section className="stack">
          <div className="card">
            <div className="row-between">
              <div>
                <p className="popup-title">Signed in</p>
                <p className="small">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
              <UserButton />
            </div>
          </div>
          <button className="button-primary" onClick={() => openUrl("/dashboard")} type="button">
            Open dashboard
          </button>
          <button className="button-secondary" onClick={() => openUrl("/setup")} type="button">
            Open setup
          </button>
          <p className="small">
            If you just signed in on the web app, close and reopen this popup once so Pear refreshes the synced
            session.
          </p>
        </section>
      </Show>
      <Show when="signed-out">
        <section className="stack">
          <div className="card">
            <p className="popup-title">Sign in on Pear web</p>
            <p className="small">
              Pear syncs your Clerk session from the web app. Sign in there with Google or email, then reopen this
              popup.
            </p>
          </div>
          <button className="button-primary" onClick={() => openUrl("/sign-in")} type="button">
            Open sign-in
          </button>
          <button className="button-secondary" onClick={() => openUrl("/dashboard")} type="button">
            Open dashboard
          </button>
          <button className="button-secondary" onClick={() => openUrl("/setup")} type="button">
            Open setup
          </button>
        </section>
      </Show>
    </main>
  )
}
