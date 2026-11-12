'use client'

import {
  SAFETY_TAG_LABELS,
  SAFETY_TIME_SHORT,
  noteCountLabel,
  type SafetySummary,
  type SafetyTagCount,
  type SafetyTimeSummary,
} from '@/lib/safety'

function chipsLabel(tags: SafetyTagCount[]) {
  return tags.map((entry) => `${SAFETY_TAG_LABELS[entry.tag]}: ${noteCountLabel(entry.count)}`).join('. ')
}

function breakdownLabel(byTime: SafetyTimeSummary[]) {
  return byTime
    .map((entry) => `${SAFETY_TIME_SHORT[entry.time]}: ${noteCountLabel(entry.count)}`)
    .join('. ')
}

export function SafetyTimeBreakdown({ byTime }: { byTime: SafetyTimeSummary[] }) {
  const max = Math.max(1, ...byTime.map((entry) => entry.count))

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
        Reported at
      </span>
      <div className="flex items-end gap-1.5" role="img" aria-label={breakdownLabel(byTime)}>
        {byTime.map((entry) => (
          <div key={entry.time} className="flex flex-1 flex-col gap-1">
            <div className="flex h-7 items-end rounded-sm border border-line bg-card p-0.5">
              <span
                className="w-full rounded-[1px] bg-route-whisper"
                style={{
                  height: `${entry.count === 0 ? 6 : Math.max((entry.count / max) * 100, 18)}%`,
                }}
              />
            </div>
            <span className="text-center font-mono text-[9px] uppercase tracking-[0.04em] text-muted-text">
              {SAFETY_TIME_SHORT[entry.time]} {entry.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Shared by the stop popup and the route sheet.
export function SafetySection({
  summary,
  notedToday,
  onAddNote,
  className = '',
}: {
  summary: SafetySummary
  notedToday: boolean
  onAddNote: () => void
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
          Safety
        </span>
        <span className="font-mono text-[10px] text-muted-text">
          {noteCountLabel(summary.count)}
        </span>
      </div>

      {summary.tags.length > 0 ? (
        <span className="flex flex-wrap gap-1" aria-label={chipsLabel(summary.tags)}>
          {summary.tags.map((entry) => (
            <span
              key={entry.tag}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.04em] text-muted-text"
            >
              {SAFETY_TAG_LABELS[entry.tag]} · {entry.count}
            </span>
          ))}
        </span>
      ) : null}

      {summary.enough && summary.headline ? (
        <>
          <span className="font-sans text-xs text-text">{summary.headline}</span>
          <SafetyTimeBreakdown byTime={summary.byTime} />
        </>
      ) : (
        <p className="font-sans text-xs text-muted-text">Not enough notes yet.</p>
      )}

      <button
        type="button"
        disabled={notedToday}
        onClick={onAddNote}
        className={`mt-1 inline-flex h-8 w-full items-center justify-center rounded-full border px-2.5 font-sans text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid disabled:cursor-not-allowed ${
          notedToday
            ? 'border-line bg-surface text-muted-text'
            : 'border-route-solid bg-card text-route-solid hover:bg-route-solid/10'
        }`}
      >
        {notedToday ? 'Noted today' : 'Add a safety note'}
      </button>
    </div>
  )
}
