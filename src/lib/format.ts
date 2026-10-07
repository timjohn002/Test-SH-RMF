export function formatDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : 'Never'
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'Never'
  const seconds = Math.round((now - Date.parse(iso)) / 1000)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`
  if (seconds < 7 * 86_400) return `${Math.round(seconds / 86_400)} d ago`
  return new Date(iso).toLocaleDateString()
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'unknown'
  if (seconds < 120) return `${seconds} s`
  if (seconds < 7200) return `${Math.round(seconds / 60)} min`
  return `${Math.round(seconds / 360) / 10} h`
}
