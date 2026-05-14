import { useEffect, useMemo, useState } from "react"
import { WAIT_OVERRIDE_MS, normalizeHostname } from "@pear/shared"
import "../style.css"

const BLOCK_CONTEXT_KEY = "pear_block_context"

type BlockContext = {
  focusIntention: string | null
  friendUsernames: string[]
}

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
  const [reasonTouched, setReasonTouched] = useState(false)
  const [message, setMessage] = useState("")
  const [blockCtx, setBlockCtx] = useState<BlockContext | null>(null)

  useEffect(() => {
    chrome.storage.local.get(BLOCK_CONTEXT_KEY, (r) => {
      setBlockCtx((r[BLOCK_CONTEXT_KEY] as BlockContext) ?? null)
    })
  }, [])

  function startWait() {
    if (waiting) return
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

  const friendNames = blockCtx?.friendUsernames ?? []
  const accountabilityText =
    friendNames.length === 1
      ? `@${friendNames[0]} will see this override.`
      : friendNames.length > 1
        ? `@${friendNames.slice(0, -1).join(", @")} and @${friendNames.at(-1)} will see this override.`
        : null

  return (
    <main className="block-shell">
      <section className="block-card">
        <p className="brand">Pear</p>
        <h1 className="title">Do you actually want to open {hostname} right now?</h1>
        <p className="muted">
          You set this block for a reason. Take a moment — is opening this site worth it right now?
        </p>

        {blockCtx?.focusIntention ? (
          <div className="intention-card">
            <p className="intention-label">You said you're blocking because</p>
            <p className="intention-text">"{blockCtx.focusIntention}"</p>
          </div>
        ) : null}

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
              onBlur={() => setReasonTouched(true)}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are you opening it?"
              value={reason}
            />
            {reasonTouched && reason.trim().length > 0 && reason.trim().length < 3 ? (
              <p className="hint">Keep going — be specific about why.</p>
            ) : null}
            <button
              className="button-secondary"
              disabled={!targetUrl || reason.trim().length < 3}
              type="submit"
            >
              Continue with reason
            </button>
          </form>
        </div>

        {accountabilityText ? (
          <p className="accountability-note">{accountabilityText}</p>
        ) : null}

        {message ? <p className="message">{message}</p> : null}
      </section>
    </main>
  )
}
