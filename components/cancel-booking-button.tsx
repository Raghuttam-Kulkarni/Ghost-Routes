'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CancelBookingButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel() {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Could not cancel that booking.')
        return
      }

      router.refresh()
    } catch {
      setError('Could not cancel that booking.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:opacity-60"
      >
        {busy ? 'Cancelling' : 'Cancel'}
      </button>
      {error ? <span className="font-sans text-[11px] text-destructive">{error}</span> : null}
    </span>
  )
}
