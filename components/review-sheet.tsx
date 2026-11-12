'use client'

import { useEffect, useState } from 'react'
import { Check, Clock, Search, X, Zap } from 'lucide-react'
import { VehicleIcon } from '@/components/vehicle-icon'
import {
  EASE_LABELS,
  PICKUP_EASES,
  PERIOD_LABELS,
  TYPICAL_WAITS,
  VEHICLE_CHOICES,
  VEHICLE_SHORT_LABELS,
  WAIT_LABELS,
  periodOfHour,
  snapCoordinate,
  type PickupEase,
  type ReviewDraft,
  type ReviewTarget,
  type TypicalWait,
  type VehicleType,
} from '@/lib/reviews'

const EASE_ICONS = { quick: Zap, sometimes: Clock, hard: Search } as const

const EASE_ACTIVE: Record<PickupEase, string> = {
  quick: 'border-route-solid bg-route-solid/10 text-route-solid',
  sometimes: 'border-route-flicker bg-route-flicker/10 text-route-flicker',
  hard: 'border-route-whisper bg-route-whisper/10 text-text',
}

export function ReviewSheet({
  target,
  alreadyReviewed,
  onClose,
  onSubmit,
}: {
  target: ReviewTarget
  alreadyReviewed: boolean
  onClose: () => void
  onSubmit: (draft: ReviewDraft) => Promise<void>
}) {
  const [ease, setEase] = useState<PickupEase | null>(null)
  const [wait, setWait] = useState<TypicalWait | null>(null)
  const [vehicles, setVehicles] = useState<VehicleType[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)

  useEffect(() => {
    setEase(null)
    setWait(null)
    setVehicles([])
    setNote('')
    setBusy(false)
    setPosted(false)
  }, [target.spotId])

  const period = PERIOD_LABELS[periodOfHour(new Date().getHours())]
  const done = alreadyReviewed || posted
  const coords = snapCoordinate(target.lat, target.lon)

  function toggleVehicle(type: VehicleType) {
    setVehicles((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type],
    )
  }

  async function submit() {
    if (!ease || !wait || busy) return

    setBusy(true)
    try {
      await onSubmit({ ease, wait, vehicles, note })
      setPosted(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Rate pickup here"
      data-review-sheet
      className="absolute inset-x-0 bottom-0 z-[1060] mx-auto flex max-h-[88vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-lg border border-line bg-surface p-5 pb-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
            Rate pickup here
          </span>
          <h2 className="mt-1 truncate font-sans text-lg font-medium leading-tight tracking-tight text-text">
            {target.label}
          </h2>
          <p className="mt-1 font-mono text-[10px] text-muted-text">
            {target.kind === 'street'
              ? `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}`
              : 'Stop'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pickup review"
          className="-mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-text transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {done ? (
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-route-solid px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-route-solid">
            <Check className="size-3" aria-hidden="true" />
            Reviewed today
          </span>
          <p className="font-sans text-sm text-text">Thanks. Your pickup review is in.</p>
          <p className="font-sans text-xs text-muted-text">
            Anonymous. One review per spot per day, no account needed.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-full border border-route-solid bg-route-solid/15 font-sans text-sm text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
              How easy is pickup here?
            </span>
            <div role="group" aria-label="Pickup ease" className="flex flex-col gap-1.5">
              {PICKUP_EASES.map((option) => {
                const Icon = EASE_ICONS[option]
                const active = ease === option

                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setEase(option)}
                    className={`flex h-11 items-center gap-2.5 rounded-md border px-3 text-left font-sans text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
                      active
                        ? EASE_ACTIVE[option]
                        : 'border-line bg-card text-text hover:bg-surface'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{EASE_LABELS[option]}</span>
                    {active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
              Typical wait
            </span>
            <div role="group" aria-label="Typical wait" className="grid grid-cols-2 gap-1.5">
              {TYPICAL_WAITS.map((option) => {
                const active = wait === option

                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setWait(option)}
                    className={`inline-flex h-9 items-center justify-center rounded-full border px-2 font-sans text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
                      active
                        ? 'border-route-solid bg-card text-text'
                        : 'border-line bg-surface text-muted-text hover:bg-card hover:text-text'
                    }`}
                  >
                    {WAIT_LABELS[option]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
              Which vehicles did you see here?
            </span>
            <div role="group" aria-label="Vehicle types seen here" className="flex flex-wrap gap-1.5">
              {VEHICLE_CHOICES.map((type) => {
                const active = vehicles.includes(type)

                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleVehicle(type)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
                      active
                        ? 'border-route-solid bg-card text-text'
                        : 'border-line bg-surface text-muted-text hover:bg-card hover:text-text'
                    }`}
                  >
                    <VehicleIcon type={type} className="size-3" />
                    {VEHICLE_SHORT_LABELS[type]}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
              Add a note (optional)
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 120))}
              maxLength={120}
              rows={2}
              placeholder="Anything a rider should know?"
              className="resize-none rounded-md border border-line bg-card p-2 font-sans text-sm text-text outline-none placeholder:text-muted-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
            />
            <span className="self-end font-mono text-[10px] text-muted-text">{note.length}/120</span>
          </label>

          <p className="font-sans text-[11px] text-muted-text">
            Time of day added automatically: {period}. No account, no name.
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={!ease || !wait || busy}
            className="inline-flex h-10 items-center justify-center rounded-full border border-route-solid bg-route-solid/15 font-sans text-sm text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Posting…' : 'Post review'}
          </button>
        </div>
      )}
    </section>
  )
}
