import mockAlerts from '@/data/mock-alerts.json'

export const ALERT_KINDS = [
  'not-running',
  'delayed',
  'route-changed',
  'strike',
  'festival',
] as const

export type AlertKind = (typeof ALERT_KINDS)[number]

export const ALERT_LABELS: Record<AlertKind, string> = {
  'not-running': 'Not running today',
  delayed: 'Delayed',
  'route-changed': 'Route changed',
  strike: 'Strike or road closure',
  festival: 'Festival or event',
}

/** Reports stop counting 24 hours after they are posted. */
export const ALERT_TTL_MS = 24 * 60 * 60 * 1000

/** A route needs at least this many active reports to show a banner. */
export const MIN_ALERTS_FOR_BANNER = 2

export const ALERT_NOTE_MAX = 80

export type RouteAlert = {
  id: string
  routeId: string
  kind: AlertKind
  note?: string
  createdAt: string
}

export type AlertDraft = {
  kind: AlertKind
  note?: string
}

export type AlertKindCount = { kind: AlertKind; count: number }

export type RouteAlertSummary = {
  routeId: string
  count: number
  newest: RouteAlert | null
  kinds: AlertKindCount[]
  banner: boolean
}

// The sample file stores "minutesAgo" so the demo reports are always inside the
// 24-hour window; real rows carry a createdAt timestamp instead.
type MockAlert = {
  id: string
  routeId: string
  kind: AlertKind
  note?: string
  minutesAgo: number
}

const seed: RouteAlert[] = (mockAlerts as MockAlert[]).map(({ minutesAgo, ...rest }) => ({
  ...rest,
  createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
}))

const alerts: RouteAlert[] = [...seed]

export function getAlerts(): RouteAlert[] {
  return alerts
}

function isActive(alert: RouteAlert, now: number) {
  const created = new Date(alert.createdAt).getTime()
  if (Number.isNaN(created)) return false
  return now - created < ALERT_TTL_MS
}

export function activeAlerts(all: RouteAlert[], now = Date.now()): RouteAlert[] {
  return all.filter((alert) => isActive(alert, now))
}

export function reportCountLabel(count: number) {
  return `${count} report${count === 1 ? '' : 's'}`
}

export function relativeTime(iso: string, now = Date.now()) {
  const created = new Date(iso).getTime()
  if (Number.isNaN(created)) return ''

  const minutes = Math.floor(Math.max(0, now - created) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`
}

export function summarizeAlerts(all: RouteAlert[], now = Date.now()): Map<string, RouteAlertSummary> {
  const active = activeAlerts(all, now).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const grouped = new Map<string, RouteAlert[]>()
  for (const alert of active) {
    const existing = grouped.get(alert.routeId)
    if (existing) existing.push(alert)
    else grouped.set(alert.routeId, [alert])
  }

  const summaries = new Map<string, RouteAlertSummary>()

  for (const [routeId, list] of grouped) {
    const counts = new Map<AlertKind, number>()
    for (const alert of list) counts.set(alert.kind, (counts.get(alert.kind) ?? 0) + 1)

    // Most-reported kind first; ties keep the declared order.
    const kinds = ALERT_KINDS.map((kind) => ({ kind, count: counts.get(kind) ?? 0 }))
      .filter((entry) => entry.count > 0)
      .sort(
        (a, b) => b.count - a.count || ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind),
      )

    summaries.set(routeId, {
      routeId,
      count: list.length,
      newest: list[0] ?? null,
      kinds,
      banner: list.length >= MIN_ALERTS_FOR_BANNER,
    })
  }

  return summaries
}

// In-memory copy of the sample reports. Swapping this module's write path for a
// Supabase insert leaves every caller unchanged.
export async function addAlert(routeId: string, draft: AlertDraft): Promise<RouteAlert> {
  const note = draft.note?.trim().slice(0, ALERT_NOTE_MAX)

  const alert: RouteAlert = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    routeId,
    kind: draft.kind,
    note: note ? note : undefined,
    createdAt: new Date().toISOString(),
  }

  alerts.push(alert)
  return alert
}

// One report of each type, per route, per day, per browser. No ids or names.
const REPORTED_KEY = 'ghost-routes:route-alerts'

function localDayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readReportLog(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(REPORTED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function reportKey(routeId: string, kind: AlertKind) {
  return `${routeId}:${kind}`
}

export function alertReportedToday(routeId: string, kind: AlertKind) {
  return readReportLog()[reportKey(routeId, kind)] === localDayKey()
}

export function reportedAlertKeysToday(): string[] {
  const log = readReportLog()
  const today = localDayKey()
  return Object.keys(log).filter((key) => log[key] === today)
}

export function markAlertReported(routeId: string, kind: AlertKind) {
  try {
    window.localStorage.setItem(
      REPORTED_KEY,
      JSON.stringify({ ...readReportLog(), [reportKey(routeId, kind)]: localDayKey() }),
    )
  } catch {
    // Storage blocked or full: the sheet still shows "Reported today".
  }
}
