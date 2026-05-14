import { useMemo, useState } from "react"
import "../style.css"

export default function PingPage() {
  const params = useMemo(() => new URLSearchParams(location.search), [])
  const notificationId = params.get("notificationId") ?? ""
  const recipientUserId = params.get("recipientUserId") ?? ""
  const senderUsername = params.get("senderUsername") ?? "your friend"

  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [errorText, setErrorText] = useState("")

  async function sendPing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("sending")
    setErrorText("")

    const response = await chrome.runtime.sendMessage({
      type: "PEAR_SEND_PING",
      recipientUserId,
      notificationId,
      message: message.trim() || undefined
    })

    if (!response?.ok) {
      setStatus("error")
      setErrorText(response?.error ?? "Could not send ping.")
      return
    }

    setStatus("sent")
    setTimeout(() => window.close(), 1500)
  }

  if (status === "sent") {
    return (
      <main className="block-shell">
        <section className="block-card">
          <p className="brand">Pear</p>
          <h1 className="title">Ping sent</h1>
          <p className="muted">@{senderUsername} will see your message.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="block-shell">
      <section className="block-card">
        <p className="brand">Pear</p>
        <h1 className="title">Check in on @{senderUsername}</h1>
        <p className="muted">A quick ping goes a long way. Add a note if you want — or just send it.</p>

        <form className="stack" onSubmit={sendPing}>
          <textarea
            autoFocus
            className="textarea"
            disabled={status === "sending"}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Say something... (optional)"
            value={message}
          />
          <button
            className="button-primary"
            disabled={status === "sending"}
            type="submit"
          >
            {status === "sending" ? "Sending..." : "Send ping"}
          </button>
        </form>

        {errorText ? <p className="message">{errorText}</p> : null}
      </section>
    </main>
  )
}
