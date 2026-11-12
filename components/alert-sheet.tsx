'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { ALERT_KINDS, ALERT_LABELS, ALERT_NOTE_MAX, type AlertDraft, type AlertKind } from '@/lib/alerts'
import type { GhostRoute } from '@/lib/routes'

export function AlertSheet({
  route,
  reportedKinds,
  onClose,
  onSubmit,
}: {
  route: GhostRoute
  /** Types this browser already reported for this route today. */
  reportedKinds: AlertKind[]
  onClose: () => void
  onSubmit: (draft: AlertDraft) => Promise<void>
}) {
  const [kind, setKind] = useState<AlertKind | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)

  useEffect(() => {
    setKind(null)
    setNote('')
    setBusy(false)
    setPosted(false)
  }, [route.id])

  async function submit() {
    if (!kind || busy) return

    setBusy(true)
    try {
      await onSubmit({ kind, note })
      setPosted(true)
      setKind(null)
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Report a problem"
      data-alert-sheet
      className="absolute inset-x-0 bottom-0 z-[1080] mx-auto flex max-h-[88vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-lg border border-line bg-surface p-5 pb-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
            Report a problem
          </span>
          <h2 className="mt-1 truncate font-sans text-lg font-medium leading-tight tracking-tight text-text">
            {route.name}
          </h2>
          <p className="mt-1 font-mono text-[10px] text-muted-text">Route</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close problem report"
          className="-mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-text transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {posted ? (
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-route-flicker px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-route-flicker">
            <Check className="size-3" aria-hidden="true" />
            Reported today
          </span>
          <p className="font-sans text-sm text-text">Thanks. Your report is live for 24 hours.</p>
          <p className="font-sans text-xs text-muted-text">
            Anonymous, with no account and nothing tied to you.
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
              What is happening?
            </span>
            <div role="group" aria-label="Problem type" className="flex flex-col gap-1.5">
              {ALERT_KINDS.map((option) => {
                const alreadyReported = reportedKinds.includes(option)
                const active = kind === option

                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    disabled={alreadyReported}
                    onClick={() => setKind(option)}
                    className={`flex h-10 items-center gap-2 rounded-md border px-3 text-left font-sans text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed ${
                      alreadyReported
                        ? 'border-line bg-surface text-muted-text'
                        : active
                          ? 'border-route-flicker bg-route-flicker/10 text-text'
                          : 'border-line bg-card text-text hover:bg-surface'
                    }`}
                  >
                    <span className="min-w-0 flex-1">{ALERT_LABELS[option]}</span>
                    {alreadyReported ? (
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-text">
                        Reported today
                      </span>
                    ) : active ? (
                      <Check className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
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
              onChange={(event) => setNote(event.target.value.slice(0, ALERT_NOTE_MAX))}
              maxLength={ALERT_NOTE_MAX}
              rows={2}
              placeholder="What should riders know?"
              className="resize-none rounded-md border border-line bg-card p-2 font-sans text-sm text-text outline-none placeholder:text-muted-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
            />
            <span className="self-end font-mono text-[10px] text-muted-text">
              {note.length}/{ALERT_NOTE_MAX}
            </span>
          </label>

          <p className="font-sans text-[11px] text-muted-text">
            Reports expire after 24 hours. Anonymous, no account, nothing tied to you.
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={!kind || busy}
            className="inline-flex h-10 items-center justify-center rounded-full border border-route-flicker bg-route-flicker/10 font-sans text-sm text-route-flicker transition-colors hover:bg-route-flicker/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Posting…' : 'Post report'}
          </button>
        </div>
      )}
    </section>
  )
}
