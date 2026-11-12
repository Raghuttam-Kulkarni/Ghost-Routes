'use client'

import { VehicleIcon } from '@/components/vehicle-icon'
import {
  EASE_LABELS,
  MIN_REVIEWS_FOR_SCORE,
  PERIOD_LABELS,
  PERIOD_SHORT_LABELS,
  VEHICLE_SHORT_LABELS,
  WAIT_LABELS,
  reviewCountLabel,
  type PickupEase,
  type PickupSummary,
  type PeriodSummary,
} from '@/lib/reviews'

// 3 = easy, 2 = sometimes, 1 = hard, so the meter tells the story on its own.
const EASE_SEGMENTS: Record<PickupEase, number> = { quick: 3, sometimes: 2, hard: 1 }

const EASE_BAR: Record<PickupEase, string> = {
  quick: 'bg-route-solid',
  sometimes: 'bg-route-flicker',
  hard: 'bg-muted-text',
}

const EASE_TEXT: Record<PickupEase, string> = {
  quick: 'text-route-solid',
  sometimes: 'text-route-flicker',
  hard: 'text-muted-text',
}

export function PickupMeter({ ease }: { ease: PickupEase | null }) {
  const filled = ease ? EASE_SEGMENTS[ease] : 0

  return (
    <div className="flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-1.5 flex-1 rounded-full ${
            ease && index < filled ? EASE_BAR[ease] : 'bg-line'
          }`}
        />
      ))}
    </div>
  )
}

function easeChartLabel(byPeriod: PeriodSummary[]) {
  return byPeriod
    .map((entry) =>
      entry.count === 0
        ? `${PERIOD_LABELS[entry.period]}: no reviews`
        : `${PERIOD_LABELS[entry.period]}: ${
            entry.ease ? EASE_LABELS[entry.ease].toLowerCase() : 'unclear'
          }, ${reviewCountLabel(entry.count)}`,
    )
    .join('. ')
}

export function PickupEaseChart({ byPeriod }: { byPeriod: PeriodSummary[] }) {
  const max = Math.max(1, ...byPeriod.map((entry) => entry.count))

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
        Ease by time of day
      </span>
      <div className="flex items-end gap-1.5" role="img" aria-label={`Ease by time of day. ${easeChartLabel(byPeriod)}.`}>
        {byPeriod.map((entry) => (
          <div key={entry.period} className="flex flex-1 flex-col gap-1">
            <div className="flex h-8 items-end rounded-sm border border-line bg-card p-0.5">
              <span
                className={`w-full rounded-[1px] ${entry.ease ? EASE_BAR[entry.ease] : 'bg-line'}`}
                style={{
                  height: `${entry.count === 0 ? 6 : Math.max((entry.count / max) * 100, 18)}%`,
                }}
              />
            </div>
            <span className="text-center font-mono text-[9px] uppercase tracking-[0.06em] text-muted-text">
              {PERIOD_SHORT_LABELS[entry.period]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Shared by the stop popup and the street-spot popup. Below three reviews the
// score is withheld, but the wait and vehicles seen still help.
export function PickupEaseSummary({
  summary,
  className = '',
}: {
  summary: PickupSummary
  className?: string
}) {
  const enough = summary.count >= MIN_REVIEWS_FOR_SCORE && summary.ease !== null

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
          Pickup ease
        </span>
        <span className="font-mono text-[10px] text-muted-text">
          {reviewCountLabel(summary.count)}
        </span>
      </div>

      {enough && summary.ease ? (
        <>
          <PickupMeter ease={summary.ease} />
          <span className={`font-sans text-xs ${EASE_TEXT[summary.ease]}`}>
            {EASE_LABELS[summary.ease]}
          </span>
        </>
      ) : (
        <p className="font-sans text-xs text-muted-text">Not enough reviews yet. Be the first.</p>
      )}

      {summary.wait ? (
        <span className="font-sans text-xs text-text">Usually {WAIT_LABELS[summary.wait]}</span>
      ) : null}

      {summary.vehicles.length > 0 ? (
        <span className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
          {summary.vehicles.map((type) => (
            <span key={type} className="inline-flex items-center gap-1 whitespace-nowrap">
              <VehicleIcon type={type} className="size-3" />
              {VEHICLE_SHORT_LABELS[type]}
            </span>
          ))}
        </span>
      ) : null}

      {enough ? <PickupEaseChart byPeriod={summary.byPeriod} /> : null}
    </div>
  )
}
