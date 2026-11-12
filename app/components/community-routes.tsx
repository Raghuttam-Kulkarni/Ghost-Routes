'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet'
import { MapPinned, X } from 'lucide-react'
import {
  communityRouteDistanceKm,
  communityRoutePath,
  communityRoutePoints,
  formatCommunityRouteDate,
  type CommunityRoute,
} from '@/lib/community-routes'
import { formatKm } from '@/lib/geo'

const COMMUNITY_COLOR = '#d8a8ff'

type FormState = { origin: string; destination: string; description: string }
const EMPTY_FORM: FormState = { origin: '', destination: '', description: '' }

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try { return (await response.json()) as Record<string, unknown> } catch { return {} }
}

// Popup card for a shared route. It shows the places the rider typed and, when
// the ai-maps normalizer could place the route, the AI route name, vehicle,
// fare, running frequency, ordered stops and road-following distance.
function CommunityRouteCard({ route }: { route: CommunityRoute }) {
  const distance = communityRouteDistanceKm(route)
  const stops = route.stops ?? []

  return (
    <div className="font-sans text-xs text-text">
      <strong className="block text-sm font-medium">
        {route.route_name ?? `${route.origin} → ${route.destination}`}
      </strong>
      <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-text">
        Community route · {formatCommunityRouteDate(route.created_at)}
      </span>

      {route.route_name ? (
        <p className="mt-1 text-muted-text">{route.origin} → {route.destination}</p>
      ) : null}

      {route.vehicle_type || route.estimated_fare || route.frequency ? (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {[route.vehicle_type, route.estimated_fare, route.frequency]
            .filter((value): value is string => Boolean(value))
            .map((value) => (
              <span key={value} className="rounded border border-line bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-text">
                {value}
              </span>
            ))}
        </p>
      ) : null}

      {route.description ? <p className="mt-1.5 leading-relaxed text-muted-text">{route.description}</p> : null}

      {stops.length > 0 ? (
        <ol className="mt-1.5 max-h-28 list-decimal space-y-0.5 overflow-auto pl-4 text-[11px] leading-relaxed text-muted-text">
          {stops.map((stop) => <li key={`${stop.name}-${stop.lat}-${stop.lng}`}>{stop.name}</li>)}
        </ol>
      ) : null}

      {distance != null ? (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-text">
          {formatKm(distance)} · {route.ai_normalized ? 'AI aligned to roads' : 'straight line'}
        </p>
      ) : null}
    </div>
  )
}

export function CommunityRoutes() {
  const [routes, setRoutes] = useState<CommunityRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/routes', { cache: 'no-store' }).then(readJson).then((json) => {
      if (!cancelled) {
        setRoutes(Array.isArray(json.routes) ? json.routes as CommunityRoute[] : [])
        if (typeof json.error === 'string') setMessage(json.error)
      }
    }).catch(() => { if (!cancelled) setMessage('Could not reach the community routes API.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await readJson(response)
      if (!response.ok) { setMessage(typeof json.error === 'string' ? json.error : 'Could not save the route.'); return }
      if (json.route) setRoutes((current) => [json.route as CommunityRoute, ...current])
      setForm(EMPTY_FORM)
      setMessage(json.normalized ? 'Route shared with the community. AI aligned it to roads and stops.' : 'Route shared with the community. AI alignment is unavailable (no API key or model busy), so it is drawn as a straight line.')
    } catch { setMessage('Could not reach the community routes API.') }
    finally { setBusy(false) }
  }

  return <>
    {routes.map((route) => {
      const path = communityRoutePath(route)
      if (!path) return null
      const points = communityRoutePoints(route)
      return <span key={route.id}>
        <Polyline
          positions={path}
          pathOptions={{
            color: COMMUNITY_COLOR,
            dashArray: route.ai_normalized ? undefined : '5 8',
            weight: 3,
            opacity: 0.9,
            bubblingMouseEvents: false,
          }}
        >
          <Popup minWidth={230} maxWidth={270} className="stop-popup pickup-popup">
            <CommunityRouteCard route={route} />
          </Popup>
        </Polyline>
        {(route.stops ?? []).map((stop) => (
          <CircleMarker
            key={`${route.id}-${stop.name}-${stop.lat}-${stop.lng}`}
            center={[stop.lat, stop.lng]}
            radius={2.5}
            pathOptions={{ color: COMMUNITY_COLOR, fillColor: COMMUNITY_COLOR, fillOpacity: 1, weight: 1, bubblingMouseEvents: false }}
          >
            <Tooltip direction="top" className="route-tooltip">{stop.name}</Tooltip>
          </CircleMarker>
        ))}
        {points ? <>
          <CircleMarker center={points[0]} radius={4} pathOptions={{ color: COMMUNITY_COLOR, fillColor: COMMUNITY_COLOR, fillOpacity: 1, bubblingMouseEvents: false }} />
          <CircleMarker center={points[1]} radius={4} pathOptions={{ color: COMMUNITY_COLOR, fillColor: COMMUNITY_COLOR, fillOpacity: 1, bubblingMouseEvents: false }} />
        </> : null}
      </span>
    })}
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[1250] flex justify-end md:bottom-6 md:right-6">
      {open ? <section className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-4 text-text">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Community routes</h2><p className="text-[11px] text-muted-text">{loading ? 'Loading shared routes…' : `${routes.length} shared route${routes.length === 1 ? '' : 's'}`}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close community routes" className="rounded-full p-2 text-muted-text hover:bg-card"><X className="size-4" /></button></div>
        <form onSubmit={submit} className="grid gap-2.5">
          <input required maxLength={120} aria-label="Origin" placeholder="Origin, e.g. Majestic Bus Station" value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} className="rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-route-solid" />
          <input required maxLength={120} aria-label="Destination" placeholder="Destination" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} className="rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-route-solid" />
          <textarea maxLength={600} aria-label="Route details" rows={2} placeholder="Vehicle, fare, or useful details (optional)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-route-solid" />
          <p className="text-[11px] leading-relaxed text-muted-text">Your notes are normalized into ordered stops and a road-following line before the route is saved.</p>
          <button disabled={busy} className="rounded-lg bg-route-solid px-3 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">{busy ? 'Normalizing and sharing…' : 'Share route'}</button>
        </form>
        {message ? <p role="status" className="mt-3 text-xs leading-relaxed text-muted-text">{message}</p> : null}
        {routes.length > 0 ? <ul className="mt-3 max-h-32 space-y-1 overflow-auto border-t border-line pt-2 text-xs text-muted-text">{routes.slice(0, 4).map((route) => <li key={route.id}>{route.origin} → {route.destination}</li>)}</ul> : null}
      </section> : <button type="button" onClick={() => setOpen(true)} className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-3 text-sm font-medium text-text hover:bg-card"><MapPinned className="size-4 text-route-solid" /> Share a route <span className="font-mono text-[10px] text-muted-text">{routes.length}</span></button>}
    </div>
  </>
}
