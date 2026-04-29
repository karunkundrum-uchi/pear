export function normalizeHostname(input: string): string {
  const trimmed = input.trim().toLowerCase()

  if (!trimmed) {
    return ""
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    return stripWww(url.hostname)
  } catch {
    return stripWww(trimmed.split("/")[0] ?? "")
  }
}

export function hostMatchesBlockedSite(hostname: string, blockedHostname: string) {
  const host = normalizeHostname(hostname)
  const blocked = normalizeHostname(blockedHostname)

  return host === blocked || host.endsWith(`.${blocked}`)
}

function stripWww(hostname: string) {
  return hostname.replace(/^www\./, "")
}
