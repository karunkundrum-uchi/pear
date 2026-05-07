import { useMemo, useState } from "react"
import { WAIT_OVERRIDE_MS, normalizeHostname } from "@pear/shared"
import "../style.css"

export default function BlockPage() {
  const targetUrl = useMemo(() => new URLSearchParams(location.search).get("target") ?? "", [])
  const hostname = useMemo(() => {
    try {
      return normalizeHostname(new URL(targetUrl).hostname)
    } catch {
      return ""
    }
  }, [targetUrl])
  const [remainingMs, setRemainingMs] = useState(WAIT_OVERRIDE_MS)
  const [waiting, setWaiting] = useState(false)
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")

  function startWait() {
    if (waiting) {
      return
    }

    setWaiting(true)
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const next = Math.max(0, WAIT_OVERRIDE_MS - (Date.now() - startedAt))
      setRemainingMs(next)

      if (next === 0) {
        window.clearInterval(timer)
        void grantOverride("wait")
      }
    }, 250)
  }

  async function grantOverride(method: "wait" | "reason") {
    setMessage("")
    const currentTab = await chrome.tabs.getCurrent()

    if (!currentTab?.id) {
      setMessage("Pear could not determine the current tab.")
      return
    }

    const response = await chrome.runtime.sendMessage({
      type: "PEAR_GRANT_GRACE",
      tabId: currentTab.id,
      hostname,
      targetUrl,
      method,
      reason
    })

    if (!response?.ok) {
      setMessage(response?.error ?? "Pear could not grant access.")
      return
    }

    location.href = targetUrl
  }

  return (
    <main className="block-shell">
      <section className="block-card">
        <p className="brand">Pear</p>
        <h1 className="title">Pause before opening {hostname}</h1>
        <p className="muted">
          This site is inside one of your high-risk windows. You can still continue, but Pear asks you to
          make the choice explicit.
        </p>

        <div className="block-actions">
          <button
            className="button-primary"
            disabled={!targetUrl || waiting}
            onClick={startWait}
            type="button"
          >
            {waiting ? `${Math.ceil(remainingMs / 1000)}s` : "Wait 1 minute"}
          </button>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              void grantOverride("reason")
            }}
          >
            <textarea
              className="textarea"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are you opening it?"
              value={reason}
            />
            <button
              className="button-secondary"
              disabled={!targetUrl}
              type="submit"
            >
              Continue with reason
            </button>
          </form>
        </div>
        {message ? <p className="message">{message}</p> : null}
      </section>
    </main>
  )
}
