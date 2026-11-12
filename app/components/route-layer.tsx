'use client'

import { Fragment, useMemo } from 'react'
import { CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet'
import type { LatLngTuple } from 'leaflet'
import { PickupEaseSummary } from '@/components/pickup-ease'
import { SafetySection } from '@/components/safety-notes'
import { getRouteTier, type GhostRoute } from '@/lib/routes'
import {
  EMPTY_PICKUP_SUMMARY,
  stopSpotId,
  stopTarget,
  summarizeReviews,
  type PickupSummary,
  type ReviewTarget,
  type SpotReview,
} from '@/lib/reviews'
import {
  EMPTY_SAFETY_SUMMARY,
  stopSafetyTarget,
  summarizeByTarget,
  type SafetyNote,
  type SafetyTarget,
} from '@/lib/safety'

const RIPPLE_MIN = 7
const RIPPLE_MAX = 18
const RIPPLE_GAP = 1.55

// Radius grows with the square root of sightings so area reads as the count,
// and the busiest stop still fits around its dot.
function rippleRadius(sightings: number, maxSightings: number) {
  const share = maxSightings > 0 ? Math.min(sightings / maxSightings, 1) : 0
  return RIPPLE_MIN + (RIPPLE_MAX - RIPPLE_MIN) * Math.sqrt(share)
}

export function RouteLayer({
  routes,
  selectedRouteId,
  onSelectRoute,
  reviews,
  onRateSpot,
  reviewedSpotIds,
  safetyNotes,
  onAddSafetyNote,
  notedSafetyIds,
  alertedRouteIds,
}: {
  routes: GhostRoute[]
  selectedRouteId: string | null
  onSelectRoute: (id: string) => void
  reviews: SpotReview[]
  onRateSpot: (target: ReviewTarget) => void
  reviewedSpotIds: string[]
  safetyNotes: SafetyNote[]
  onAddSafetyNote: (target: SafetyTarget) => void
  notedSafetyIds: string[]
  alertedRouteIds: string[]
}) {
  const maxSightings = routes.reduce(
    (max, route) => route.stops.reduce((inner, stop) => Math.max(inner, stop.sightings), max),
    0,
  )

  const pickupByStop = useMemo(() => {
    const grouped = new Map<string, SpotReview[]>()

    for (const review of reviews) {
      const existing = grouped.get(review.spotId)
      if (existing) existing.push(review)
      else grouped.set(review.spotId, [review])
    }

    const summaries = new Map<string, PickupSummary>()
    for (const [spotId, list] of grouped) summaries.set(spotId, summarizeReviews(list))
    return summaries
  }, [reviews])

  const safetyByTarget = useMemo(() => summarizeByTarget(safetyNotes), [safetyNotes])

  return (
    <>
      {routes.map((route) => {
        const tier = getRouteTier(route.confidence)
        const isSelected = selectedRouteId === route.id
        const positions = route.geometry.coordinates.map(
          ([lon, lat]) => [lat, lon] as LatLngTuple,
        )

        return (
          <Polyline
            // Leaflet only reads `className` when the SVG path is created, so
            // remounting is what applies both the highlight and tier changes.
            key={`${route.id}-${tier}-${isSelected ? 'selected' : 'idle'}`}
            positions={positions}
            pathOptions={{
              className: `route-line route-${tier}${isSelected ? ' route-selected' : ''}`,
              bubblingMouseEvents: false,
            }}
            eventHandlers={{ click: () => onSelectRoute(route.id) }}
          >
            <Tooltip sticky className="route-tooltip">
              <span className="block font-sans text-xs font-medium">{route.name}</span>
              <span className="block font-mono text-[10px] text-muted-text">
                {`${Math.round(route.confidence * 100)}% conf · ${route.sightingsThisWeek} sightings/wk`}
              </span>
            </Tooltip>
          </Polyline>
        )
      })}

      {/* Halo sits under the lines' dots but above nothing else: two concentric
          rings in the solid route colour that slowly pulse outward. */}
      {routes.flatMap((route) =>
        route.stops.map((stop) => {
          const radius = rippleRadius(stop.sightings, maxSightings)

          return (
            <Fragment key={`ripple-${route.id}-${stop.id}`}>
              <CircleMarker
                center={[stop.lat, stop.lon]}
                radius={radius}
                interactive={false}
                pathOptions={{ className: 'route-ripple route-ripple-inner' }}
              />
              <CircleMarker
                center={[stop.lat, stop.lon]}
                radius={radius * RIPPLE_GAP}
                interactive={false}
                pathOptions={{ className: 'route-ripple route-ripple-outer' }}
              />
            </Fragment>
          )
        }),
      )}

      {/* Amber warning dot on lines with enough active reports to flag. */}
      {routes.map((route) => {
        if (!alertedRouteIds.includes(route.id)) return null

        const coords = route.geometry.coordinates
        const mid = coords[Math.floor(coords.length / 2)]
        if (!mid) return null

        return (
          <CircleMarker
            key={`alert-${route.id}`}
            center={[mid[1], mid[0]]}
            radius={3.5}
            interactive={false}
            pathOptions={{ className: 'alert-dot' }}
          />
        )
      })}

      {routes.flatMap((route) => {
        const tier = getRouteTier(route.confidence)
        return route.stops.map((stop) => {
          const spotId = stopSpotId(stop.id)
          const summary = pickupByStop.get(spotId) ?? EMPTY_PICKUP_SUMMARY
          const reviewed = reviewedSpotIds.includes(spotId)

          return (
            <CircleMarker
              key={`${route.id}-${tier}-${stop.id}`}
              center={[stop.lat, stop.lon]}
              radius={4}
              pathOptions={{ className: `route-stop route-stop-${tier}` }}
            >
              <Popup
                className="stop-popup pickup-popup"
                offset={[0, -2]}
                minWidth={230}
                maxWidth={260}
              >
                <span className="block font-sans text-xs font-medium">{stop.name}</span>
                <span className="block font-mono text-[10px] text-muted-text">
                  {`${route.name} · ${stop.sightings} sightings`}
                </span>

                <PickupEaseSummary summary={summary} className="mt-2" />

                <button
                  type="button"
                  disabled={reviewed}
                  onClick={() => onRateSpot(stopTarget(stop))}
                  className={`mt-2 inline-flex h-8 w-full items-center justify-center rounded-full border px-2.5 font-sans text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed ${
                    reviewed
                      ? 'border-line bg-surface text-muted-text'
                      : 'border-route-solid bg-card text-route-solid hover:bg-route-solid/10'
                  }`}
                >
                  {reviewed ? 'Reviewed today' : 'Rate pickup here'}
                </button>

                <SafetySection
                  summary={safetyByTarget.get(spotId) ?? EMPTY_SAFETY_SUMMARY}
                  notedToday={notedSafetyIds.includes(spotId)}
                  onAddNote={() => onAddSafetyNote(stopSafetyTarget(stop))}
                  className="mt-3 border-t border-line pt-2.5"
                />
              </Popup>
            </CircleMarker>
          )
        })
      })}
    </>
  )
}
