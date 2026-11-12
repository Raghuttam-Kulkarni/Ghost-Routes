'use client'

import { useEffect, useRef, useState } from 'react'
import { Armchair, Check, Share2, X } from 'lucide-react'
import { SafetySection } from '@/components/safety-notes'
import { VehicleIcon } from '@/components/vehicle-icon'
import { ALERT_LABELS, relativeTime, reportCountLabel, type RouteAlertSummary } from '@/lib/alerts'
import type { SafetySummary } from '@/lib/safety'
import {
  VEHICLE_LABELS,
  type GhostRoute,
  type RouteFrequency,
  type RouteReportKind,
  type RouteReportResult,
} from '@/lib/routes'

const SEGMENTS = 5

function statusWording(confidence: number) {
  if (confidence > 0.9) return 'Solid'
  if (confidence > 0.7) return 'Almost solid'
  if (confidence >= 0.4) return 'Flickering'
  return 'Just a whisper'
}

function sortFrequency(frequency: RouteFrequency[]) {
  return [...frequency].sort((a, b) => a.hour - b.hour)
}

// Use the current hour's headway when the route runs now; otherwise fall
// forward to its next operating hour (and wrap to the first one at night).
function nextLikely(frequency: RouteFrequency[]) {
  const hour = new Date().getHours()
  const sorted = sortFrequency(frequency)
  const current = sorted.find((entry) => entry.hour === hour)
  if (current) return current.headway_min
  const upcoming = sorted.find((entry) => entry.hour > hour)
  return (upcoming ?? sorted[0]).headway_min
}

function formatHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24
  return {
    label: normalized % 12 === 0 ? 12 : normalized % 12,
    meridiem: normalized < 12 ? 'am' : 'pm',
  }
}

function formatClock(hour: number) {
  const { label, meridiem } = formatHour(hour)
  return `${label} ${meridiem.toUpperCase()}`
}

// Running now means inside the route's operating window *and* a headway was
// actually reported for this hour.
function isLikelyRunning(route: GhostRoute) {
  const hour = new Date().getHours()
  return (
    hour >= route.firstVehicleHour &&
    hour <= route.lastVehicleHour &&
    route.frequency.some((entry) => entry.hour === hour)
  )
}

// The busiest window is the longest consecutive run of hours sharing the
// route's lowest headway (earliest run wins a tie).
function busiestWindow(frequency: RouteFrequency[]) {
  const sorted = sortFrequency(frequency)
  const min = Math.min(...sorted.map((entry) => entry.headway_min))
  const runs: number[][] = []

  for (const entry of sorted) {
    if (entry.headway_min !== min) continue
    const last = runs[runs.length - 1]
    if (last && last[last.length - 1] + 1 === entry.hour) last.push(entry.hour)
    else runs.push([entry.hour])
  }

  const [best] = runs.sort((a, b) => b.length - a.length || a[0] - b[0])
  if (!best) return '—'

  const start = formatHour(best[0])
  const end = formatHour(best[best.length - 1] + 1)

  return start.meridiem === end.meridiem
    ? `${start.label}–${end.label} ${start.meridiem}`
    : `${start.label}${start.meridiem}–${end.label}${end.meridiem}`
}

// Device-only and deliberately free of any user id: reports stay anonymous.
const REPORTS_KEY = 'ghost-routes:reports'

function localDayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readReportLog(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(REPORTS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function reportedToday(routeId: string) {
  return readReportLog()[routeId] === localDayKey()
}

function markReported(routeId: string) {
  try {
    window.localStorage.setItem(
      REPORTS_KEY,
      JSON.stringify({ ...readReportLog(), [routeId]: localDayKey() }),
    )
  } catch {
    // Storage blocked or full: the session still hides the buttons.
  }
}

export function RouteSheet({
  route,
  onClose,
  onReport,
  onRequestSeat,
  safety,
  safetyNotedToday,
  onAddSafetyNote,
  alerts,
  onReportProblem,
}: {
  route: GhostRoute
  onClose: () => void
  onReport: (routeId: string, kind: RouteReportKind) => Promise<RouteReportResult | null>
  onRequestSeat: () => void
  safety: SafetySummary
  safetyNotedToday: boolean
  onAddSafetyNote: () => void
  alerts: RouteAlertSummary | null
  onReportProblem: () => void
}) {
  const filled = Math.round(route.confidence * SEGMENTS)
  const label = route.confidence > 0.9 ? 'solid' : 'materializing'
  const running = isLikelyRunning(route)
  const [shared, setShared] = useState(false)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [reported, setReported] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setReported(reportedToday(route.id))
    setConfirmation(null)
  }, [route.id])

  async function submitReport(kind: RouteReportKind) {
    if (reported || busy) return
    setBusy(true)

    try {
      const result = await onReport(route.id, kind)
      if (!result) return
      markReported(route.id)
      setReported(true)
      setConfirmation(
        kind === 'rode'
          ? 'Thanks, this route just got a little more solid.'
          : 'Thanks, noted.',
      )
    } finally {
      setBusy(false)
    }
  }

  useEffect(
    () => () => {
      if (shareTimer.current) clearTimeout(shareTimer.current)
    },
    [],
  )

  // Native share sheet where it exists; otherwise copy the deep link and say so.
  async function handleShare() {
    const url = `${window.location.origin}/?route=${encodeURIComponent(route.id)}`

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: route.name, text: route.name, url })
        return
      } catch (error) {
        if ((error as DOMException | null)?.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setShared(true)
      if (shareTimer.current) clearTimeout(shareTimer.current)
      shareTimer.current = setTimeout(() => setShared(false), 2200)
    } catch {
      // Clipboard blocked: stay quiet rather than claim the link was copied.
    }
  }

  return (
    <aside
      aria-label={`${route.name} details`}
      data-route-sheet
      className="absolute inset-x-0 bottom-0 z-[1000] rounded-t-lg border border-line bg-surface md:inset-y-0 md:left-0 md:right-auto md:w-[360px] md:rounded-none md:border-r"
    >
      {/* Sits above the scrolling body so the warning stays put. */}
      {alerts && alerts.banner && alerts.newest ? (
        <div className="flex items-start gap-2 border-b border-line bg-route-flicker/10 px-5 py-2 md:px-6">
          <span
            aria-hidden="true"
            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-route-flicker"
          />
          <p className="font-sans text-xs leading-snug text-text">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-route-flicker">
              Reported:
            </span>{' '}
            {ALERT_LABELS[alerts.newest.kind]} · {reportCountLabel(alerts.count)} ·{' '}
            {relativeTime(alerts.newest.createdAt)}
          </p>
        </div>
      ) : null}

      <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto p-5 pb-6 md:h-full md:max-h-none md:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
            {label}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
            >
              {shared ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Share2 className="size-3.5" aria-hidden="true" />
              )}
              <span aria-live="polite">{shared ? 'Link copied' : 'Share'}</span>
            </button>
            <button
            type="button"
            onClick={onClose}
            aria-label="Close route details"
            className="-mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-text transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
          >
            <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-sans text-lg font-medium leading-tight tracking-tight text-text">
            {route.name}
          </h2>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
            <VehicleIcon type={route.vehicleType} className="size-3" />
            {VEHICLE_LABELS[route.vehicleType]}
          </span>
        </div>

        <p className="font-sans text-sm text-muted-text">
          {route.startLandmark} to {route.endLandmark}
        </p>

        <div className="flex flex-col gap-1.5">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
              running ? 'border-route-solid text-route-solid' : 'border-line text-muted-text'
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${running ? 'bg-route-solid' : 'bg-muted-text'}`}
            />
            {running ? 'Likely running now' : 'Probably not running'}
          </span>
          <span className="font-sans text-xs text-muted-text">
            Last vehicle usually around {formatClock(route.lastVehicleHour)}
          </span>
        </div>

        <p className="font-sans text-sm text-text">
          ₹{route.fareMin} to ₹{route.fareMax}{' '}
          <span className="text-muted-text">· {route.fareReports} fare reports</span>
        </p>

        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index < filled ? 'bg-route-solid' : 'bg-line'}`}
            />
          ))}
        </div>

        <p className="font-sans text-sm text-text">
          {statusWording(route.confidence)}{' '}
          <span className="text-muted-text">· {route.sightingsThisWeek} sightings this week</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-line bg-card p-3">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
              Next likely
            </span>
            <span className="mt-1 block font-sans text-sm text-text">
              about {nextLikely(route.frequency)} min
            </span>
          </div>
          <div className="rounded-md border border-line bg-card p-3">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
              Busiest
            </span>
            <span className="mt-1 block font-sans text-sm text-text">
              {busiestWindow(route.frequency)}
            </span>
          </div>
        </div>

        <SafetySection
          summary={safety}
          notedToday={safetyNotedToday}
          onAddNote={onAddSafetyNote}
          className="border-t border-line pt-4"
        />

        <button
          type="button"
          onClick={onRequestSeat}
          className="mt-auto inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-route-solid bg-route-solid/15 font-sans text-sm text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
        >
          <Armchair className="size-4" aria-hidden="true" />
          Request a seat
        </button>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => submitReport('rode')}
              disabled={reported || busy}
              className={`inline-flex h-9 flex-1 items-center justify-center rounded-full border px-3 font-sans text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed ${
                reported
                  ? 'border-line bg-surface text-muted-text'
                  : 'border-route-solid bg-card text-route-solid hover:bg-route-solid/10'
              }`}
            >
              I rode this
            </button>
            <button
              type="button"
              onClick={() => submitReport('not-running')}
              disabled={reported || busy}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-line bg-surface px-3 font-sans text-sm text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed disabled:opacity-60"
            >
              Not running
            </button>
          </div>
          <button
            type="button"
            onClick={onReportProblem}
            className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface px-3 font-sans text-sm text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
          >
            Report a problem
          </button>
          <p aria-live="polite" className="font-sans text-[11px] text-muted-text">
            {reported ? 'Reported today' : 'Anonymous. Nothing is tied to you.'}
          </p>
          {confirmation ? <p className="font-sans text-xs text-text">{confirmation}</p> : null}
        </div>
      </div>
    </aside>
  )
}
