'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, X } from 'lucide-react'
import { formatDeparture, formatSlotTime } from '@/lib/datetime'
import { nextDepartures, type GhostRoute } from '@/lib/routes'

type Confirmation = { id: string; code: string; status: 'requested' | 'confirmed' }

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: number | string
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
        {label}
      </span>
      <span className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-md border border-line bg-card py-2 pl-3 pr-8 font-sans text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-text"
          aria-hidden="true"
        />
      </span>
    </label>
  )
}

export function BookingSheet({ route, onClose }: { route: GhostRoute; onClose: () => void }) {
  const router = useRouter()
  const slots = useMemo(() => nextDepartures(route), [route])

  const [boardIndex, setBoardIndex] = useState(0)
  const [alightIndex, setAlightIndex] = useState(1)
  const [departure, setDeparture] = useState(slots[0]?.toISOString() ?? '')
  const [seats, setSeats] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  useEffect(() => {
    setBoardIndex(0)
    setAlightIndex(1)
    setSeats(1)
    setError(null)
    setConfirmation(null)
    setDeparture(slots[0]?.toISOString() ?? '')
  }, [route.id, slots])

  const lastBoardable = route.stops.length - 1

  function onBoardChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = Number(event.target.value)
    setBoardIndex(next)
    if (alightIndex <= next) setAlightIndex(Math.min(next + 1, route.stops.length - 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const board = route.stops[boardIndex]
    const alight = route.stops[alightIndex]

    if (!board || !alight || !departure) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          routeId: route.id,
          boardStopId: board.id,
          alightStopId: alight.id,
          departureTime: departure,
          seats,
        }),
      })

      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/?route=${route.id}&book=1`)}`)
        return
      }

      const data = (await response.json().catch(() => null)) as
        | { code?: string; booking?: { id?: string }; error?: string }
        | null

      if (!response.ok || !data?.code || !data.booking?.id) {
        setError(data?.error ?? 'Could not request that seat.')
        return
      }

      setConfirmation({ id: data.booking.id, code: data.code, status: 'requested' })
    } catch {
      setError('Could not request that seat.')
    } finally {
      setSubmitting(false)
    }
  }

  // Demo-only control: stands in for the driver accepting the request.
  async function simulateDriverConfirm() {
    if (!confirmation) return

    try {
      const response = await fetch(`/api/bookings/${confirmation.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      })

      if (!response.ok) {
        setError('Could not confirm the demo booking.')
        return
      }

      setConfirmation({ ...confirmation, status: 'confirmed' })
    } catch {
      setError('Could not confirm the demo booking.')
    }
  }

  return (
    <section
      aria-label="Request a seat"
      data-booking-sheet
      className="absolute inset-x-0 bottom-0 z-[1050] mx-auto flex max-h-[88vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-lg border border-line bg-surface p-5 pb-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
            Request a seat
          </span>
          <h2 className="mt-1 truncate font-sans text-lg font-medium leading-tight tracking-tight text-text">
            {route.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close booking form"
          className="-mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-text transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {confirmation ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-line bg-card p-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
              Booking code
            </span>
            <p className="mt-1 font-mono text-2xl tracking-[0.08em] text-text">{confirmation.code}</p>
            <p className="mt-2 font-sans text-sm text-text">
              {confirmation.status === 'confirmed'
                ? 'Seat confirmed by the driver.'
                : 'Waiting for the driver to confirm.'}
            </p>
            <p className="mt-1 font-sans text-[11px] text-muted-text">
              Pay the driver directly. No online payment.
            </p>
          </div>

          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
              confirmation.status === 'confirmed'
                ? 'border-route-solid text-route-solid'
                : 'border-route-flicker text-route-flicker'
            }`}
          >
            {confirmation.status}
          </span>

          {confirmation.status === 'requested' ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={simulateDriverConfirm}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-dashed border-line bg-surface px-3 font-sans text-sm text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
              >
                Simulate driver confirm
                <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]">
                  demo
                </span>
              </button>
              <span className="font-sans text-[11px] text-muted-text">
                Demo control — a real driver would confirm this booking.
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-full border border-route-solid bg-route-solid/15 px-3 font-sans text-sm text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <SelectField
            label="Boarding stop"
            value={boardIndex}
            onChange={onBoardChange}
          >
            {route.stops.slice(0, lastBoardable).map((stop, index) => (
              <option key={stop.id} value={index}>
                {stop.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Drop-off stop"
            value={alightIndex}
            onChange={(event) => setAlightIndex(Number(event.target.value))}
          >
            {route.stops.map((stop, index) =>
              index > boardIndex ? (
                <option key={stop.id} value={index}>
                  {stop.name}
                </option>
              ) : null,
            )}
          </SelectField>

          <SelectField
            label="Departure"
            value={departure}
            onChange={(event) => setDeparture(event.target.value)}
          >
            {slots.map((slot) => (
              <option key={slot.toISOString()} value={slot.toISOString()}>
                {formatSlotTime(slot.toISOString())} · {formatDeparture(slot.toISOString())}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Seats"
            value={seats}
            onChange={(event) => setSeats(Number(event.target.value))}
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count} seat{count === 1 ? '' : 's'}
              </option>
            ))}
          </SelectField>

          <div className="rounded-md border border-line bg-card p-3">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
              Estimated fare
            </span>
            <span className="mt-1 block font-sans text-sm text-text">
              ₹{seats * route.fareMin} to ₹{seats * route.fareMax}
            </span>
            <span className="mt-1 block font-sans text-[11px] text-muted-text">
              Pay the driver directly. No online payment.
            </span>
          </div>

          {error ? (
            <p role="alert" className="font-sans text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || slots.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-full border border-route-solid bg-route-solid/15 font-sans text-sm text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Requesting…' : 'Request seat'}
          </button>
        </form>
      )}
    </section>
  )
}
