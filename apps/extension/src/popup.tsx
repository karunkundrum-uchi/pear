import {
  ClerkProvider,
  Show,
  UserButton,
  useAuth,
  useUser
} from "@clerk/chrome-extension"
import { useEffect, useState } from "react"
import "./style.css"

const publishableKey = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST
const EXTENSION_URL = chrome.runtime.getURL("")

if (!publishableKey || !syncHost) {
  throw new Error("Missing Clerk extension environment variables")
}

const PUBLISHABLE_KEY: string = publishableKey
const SYNC_HOST: string = syncHost

function getIconUrl(): string {
  const icons = chrome.runtime.getManifest().icons as Record<string, string> | undefined
  if (!icons) return ""
  const path = icons["128"] ?? icons["64"] ?? icons["48"] ?? Object.values(icons)[0]
  return path ? chrome.runtime.getURL(path) : ""
}

type NotifState = "idle" | "sent" | "confirmed" | "denied"

const isMac = navigator.userAgent.includes("Mac")

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
  const [notifState, setNotifState] = useState<NotifState>("idle")

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    void chrome.runtime.sendMessage({ type: "PEAR_REFRESH_CONFIG" })
  }, [isLoaded, isSignedIn])

  function openUrl(path = "") {
    void chrome.tabs.create({ url: `${dashboardUrl}${path}` })
  }

  function sendTestNotification() {
    chrome.notifications.create("pear-test-notif", {
      type: "basic",
      iconUrl: getIconUrl(),
      title: "Pear notifications are working",
      message: "You will receive alerts when a friend overrides a block."
    })
    setNotifState("sent")
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

          <NotificationCheck notifState={notifState} onSendTest={sendTestNotification} onConfirm={setNotifState} />

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

function NotificationCheck({
  notifState,
  onSendTest,
  onConfirm
}: {
  notifState: NotifState
  onSendTest: () => void
  onConfirm: (state: NotifState) => void
}) {
  return (
    <div className="card stack">
      <div className="row-between">
        <p className="popup-title">Notifications</p>
        {notifState === "confirmed" && <span className="badge badge-ok">Working</span>}
        {notifState === "denied" && <span className="badge badge-warn">Not showing</span>}
      </div>

      {notifState === "idle" && (
        <>
          <p className="small">Send a test to confirm alerts will appear on this device.</p>
          <button className="button-secondary" onClick={onSendTest} type="button">
            Send test notification
          </button>
        </>
      )}

      {notifState === "sent" && (
        <>
          <p className="small">A notification should have just appeared. Did you see it?</p>
          <div className="row-between">
            <button className="button-primary" onClick={() => onConfirm("confirmed")} type="button">
              Yes, it showed
            </button>
            <button className="button-secondary" onClick={() => onConfirm("denied")} type="button">
              No, nothing appeared
            </button>
          </div>
        </>
      )}

      {notifState === "confirmed" && (
        <p className="small">Accountability notifications are ready. You will hear when a friend overrides a block.</p>
      )}

      {notifState === "denied" && (
        <div className="stack">
          <p className="small">Chrome notifications are blocked at the OS level. Follow the steps below to enable them.</p>
          {isMac ? <MacInstructions /> : <WindowsInstructions />}
          <button className="button-secondary" onClick={onSendTest} type="button">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function MacInstructions() {
  return (
    <ol className="instructions-list">
      <li>Open <strong>System Settings</strong></li>
      <li>Go to <strong>Notifications</strong></li>
      <li>Scroll down and click <strong>Google Chrome</strong></li>
      <li>Turn <strong>Allow Notifications</strong> on</li>
      <li>Set the alert style to <strong>Banners</strong> or <strong>Alerts</strong> (not None)</li>
      <li>Come back and click <strong>Try again</strong></li>
    </ol>
  )
}

function WindowsInstructions() {
  return (
    <ol className="instructions-list">
      <li>Open <strong>Settings</strong></li>
      <li>Go to <strong>System → Notifications</strong></li>
      <li>Scroll down and find <strong>Google Chrome</strong></li>
      <li>Toggle it <strong>On</strong></li>
      <li>Come back and click <strong>Try again</strong></li>
    </ol>
  )
}
