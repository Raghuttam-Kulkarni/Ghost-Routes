'use client'

import { useEffect, useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'
import {
  SAFETY_TAGS,
  SAFETY_TAG_LABELS,
  SAFETY_TIMES,
  SAFETY_TIME_LABELS,
  type SafetyDraft,
  type SafetyTag,
  type SafetyTarget,
  type SafetyTime,
} from '@/lib/safety'

export function SafetySheet({
  target,
  alreadyNoted,
  onClose,
  onSubmit,
}: {
  target: SafetyTarget
  alreadyNoted: boolean
  onClose: () => void
  onSubmit: (draft: SafetyDraft) => Promise<void>
}) {
  const [tags, setTags] = useState<SafetyTag[]>([])
  const [when, setWhen] = useState<SafetyTime | null>(null)
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)

  useEffect(() => {
    setTags([])
    setWhen(null)
    setBusy(false)
    setPosted(false)
  }, [target.targetId])

  const done = alreadyNoted || posted

  function toggleTag(tag: SafetyTag) {
    setTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    )
  }

  async function submit() {
    if (tags.length === 0 || !when || busy) return

    setBusy(true)
    try {
      await onSubmit({ tags, when })
      setPosted(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Add a safety note"
      data-safety-sheet
      className="absolute inset-x-0 bottom-0 z-[1070] mx-auto flex max-h-[88vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-lg border border-line bg-surface p-5 pb-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Safety note
          </span>
          <h2 className="mt-1 truncate font-sans text-lg font-medium leading-tight tracking-tight text-text">
            {target.label}
          </h2>
          <p className="mt-1 font-mono text-[10px] text-muted-text">
            {target.kind === 'stop' ? 'Stop' : 'Route'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close safety note"
          className="-mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-text transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {done ? (
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-route-solid px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-route-solid">
            <Check className="size-3" aria-hidden="true" />
            Noted today
          </span>
          <p className="font-sans text-sm text-text">Thanks. Your note is in.</p>
          <p className="font-sans text-xs text-muted-text">
            Tags only, so nothing personal is collected. Anonymous, one note per day.
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
              What did you notice?
            </span>
            <div role="group" aria-label="Safety tags" className="flex flex-wrap gap-1.5">
              {SAFETY_TAGS.map((tag) => {
                const active = tags.includes(tag)

                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
                      active
                        ? 'border-route-solid bg-card text-text'
                        : 'border-line bg-surface text-muted-text hover:bg-card hover:text-text'
                    }`}
                  >
                    {active ? <Check className="size-3" aria-hidden="true" /> : null}
                    {SAFETY_TAG_LABELS[tag]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
              When?
            </span>
            <div role="group" aria-label="Time of day" className="grid grid-cols-2 gap-1.5">
              {SAFETY_TIMES.map((time) => {
                const active = when === time

                return (
                  <button
                    key={time}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setWhen(time)}
                    className={`inline-flex h-9 items-center justify-center rounded-full border px-2 font-sans text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
                      active
                        ? 'border-route-solid bg-card text-text'
                        : 'border-line bg-surface text-muted-text hover:bg-card hover:text-text'
                    }`}
                  >
                    {SAFETY_TIME_LABELS[time]}
                  </button>
                )
              })}
            </div>
          </div>

          <p className="font-sans text-[11px] text-muted-text">
            Tags only, no free text. Anonymous, no account, nothing tied to you.
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={tags.length === 0 || !when || busy}
            className="inline-flex h-10 items-center justify-center rounded-full border border-route-solid bg-route-solid/15 font-sans text-sm text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Posting…' : 'Post safety note'}
          </button>
        </div>
      )}
    </section>
  )
}
