'use client'

import { CircleMarker, Popup } from 'react-leaflet'
import { PickupEaseSummary } from '@/components/pickup-ease'
import type { PickupSpot, ReviewTarget } from '@/lib/reviews'

// Reviewed spots drawn as small circles, mint for easy, amber for sometimes,
// muted for hard.
export function PickupLayer({
  spots,
  onRateSpot,
  reviewedSpotIds,
}: {
  spots: PickupSpot[]
  onRateSpot: (target: ReviewTarget) => void
  reviewedSpotIds: string[]
}) {
  return (
    <>
      {spots.map((spot) => {
        const reviewed = reviewedSpotIds.includes(spot.spotId)

        return (
          <CircleMarker
            key={spot.spotId}
            center={[spot.lat, spot.lon]}
            radius={6}
            pathOptions={{
              className: `pickup-spot pickup-spot-${spot.summary.ease ?? 'unknown'}`,
            }}
          >
            <Popup
              className="stop-popup pickup-popup"
              minWidth={230}
              maxWidth={260}
              offset={[0, -2]}
            >
              <span className="block font-sans text-xs font-medium">{spot.label}</span>
              <span className="block font-mono text-[10px] text-muted-text">
                {spot.kind === 'stop'
                  ? 'Stop'
                  : `Street spot · ${spot.lat.toFixed(3)}, ${spot.lon.toFixed(3)}`}
              </span>

              <PickupEaseSummary summary={spot.summary} className="mt-2" />

              <button
                type="button"
                disabled={reviewed}
                onClick={() =>
                  onRateSpot({
                    spotId: spot.spotId,
                    kind: spot.kind,
                    label: spot.label,
                    lat: spot.lat,
                    lon: spot.lon,
                  })
                }
                className={`mt-2 inline-flex h-8 w-full items-center justify-center rounded-full border px-2.5 font-sans text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed ${
                  reviewed
                    ? 'border-line bg-surface text-muted-text'
                    : 'border-route-solid bg-card text-route-solid hover:bg-route-solid/10'
                }`}
              >
                {reviewed ? 'Reviewed today' : 'Review this spot'}
              </button>
            </Popup>
          </CircleMarker>
        )
      })}
    </>
  )
}
