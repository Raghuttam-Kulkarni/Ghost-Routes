import mockNotes from '@/data/mock-safety-notes.json'

export const SAFETY_TAGS = [
  'well-lit',
  'busy-crowded',
  'quiet-at-night',
  'avoid-after-9',
  'felt-safe',
  'felt-unsafe',
  'respectful-drivers',
  'overcharged',
] as const

export type SafetyTag = (typeof SAFETY_TAGS)[number]

export const SAFETY_TAG_LABELS: Record<SafetyTag, string> = {
  'well-lit': 'Well lit',
  'busy-crowded': 'Busy and crowded',
  'quiet-at-night': 'Quiet at night',
  'avoid-after-9': 'Avoid after 9 PM',
  'felt-safe': 'Feels safe',
  'felt-unsafe': 'Felt unsafe',
  'respectful-drivers': 'Drivers were respectful',
  overcharged: 'Overcharged me',
}

export const SAFETY_TIMES = ['morning', 'afternoon', 'evening', 'night'] as const

export type SafetyTime = (typeof SAFETY_TIMES)[number]

export const SAFETY_TIME_LABELS: Record<SafetyTime, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
}

export const SAFETY_TIME_SHORT: Record<SafetyTime, string> = {
  morning: 'Morn',
  afternoon: 'Aft',
  evening: 'Eve',
  night: 'Night',
}

export const MIN_NOTES_FOR_SUMMARY = 3

export type SafetyTargetKind = 'stop' | 'route'

/** A stop or a route: whichever the note is about. */
export type SafetyTarget = {
  targetId: string
  kind: SafetyTargetKind
  label: string
}

export type SafetyNote = {
  id: string
  targetId: string
  kind: SafetyTargetKind
  label: string
  tags: SafetyTag[]
  when: SafetyTime
  createdAt: string
}

export type SafetyDraft = {
  tags: SafetyTag[]
  when: SafetyTime
}

export type SafetyTagCount = { tag: SafetyTag; count: number }

export type SafetyTimeSummary = {
  time: SafetyTime
  count: number
  safe: number
  unsafe: number
}

export type SafetySummary = {
  count: number
  enough: boolean
  tags: SafetyTagCount[]
  /** Short line such as "Mostly felt safe in the daytime". */
  headline: string | null
  byTime: SafetyTimeSummary[]
}

// Tags that describe a place as comfortable versus one that raises a flag.
// A note can carry both, so the headline is a tally, not a verdict.
const SAFE_TAGS = new Set<SafetyTag>(['felt-safe', 'respectful-drivers', 'well-lit', 'busy-crowded'])
const UNSAFE_TAGS = new Set<SafetyTag>([
  'felt-unsafe',
  'avoid-after-9',
  'quiet-at-night',
  'overcharged',
])

export function stopSafetyTarget(stop: { id: string; name: string }): SafetyTarget {
  return { targetId: `stop:${stop.id}`, kind: 'stop', label: stop.name }
}

export function routeSafetyTarget(route: { id: string; name: string }): SafetyTarget {
  return { targetId: `route:${route.id}`, kind: 'route', label: route.name }
}

export function noteCountLabel(count: number) {
  return `${count} note${count === 1 ? '' : 's'}`
}

function sentiment(notes: SafetyNote[]) {
  let safe = 0
  let unsafe = 0

  for (const note of notes) {
    for (const tag of note.tags) {
      if (SAFE_TAGS.has(tag)) safe += 1
      if (UNSAFE_TAGS.has(tag)) unsafe += 1
    }
  }

  return { safe, unsafe }
}

// Morning and afternoon read as "daytime"; the other two stand alone.
export function timePhrase(time: SafetyTime) {
  if (time === 'evening') return 'in the evening'
  if (time === 'night') return 'at night'
  return 'in the daytime'
}

function busiestTime(byTime: SafetyTimeSummary[]) {
  const ranked = [...byTime].sort(
    (a, b) => b.count - a.count || SAFETY_TIMES.indexOf(a.time) - SAFETY_TIMES.indexOf(b.time),
  )
  return ranked[0] && ranked[0].count > 0 ? ranked[0].time : null
}

export function summarizeSafety(notes: SafetyNote[]): SafetySummary {
  const count = notes.length
  const enough = count >= MIN_NOTES_FOR_SUMMARY

  const counts = new Map<SafetyTag, number>()
  for (const note of notes) {
    for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  // Most-mentioned tags first; ties keep the declared tag order.
  const tags = SAFETY_TAGS.map((tag) => ({ tag, count: counts.get(tag) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort(
      (a, b) => b.count - a.count || SAFETY_TAGS.indexOf(a.tag) - SAFETY_TAGS.indexOf(b.tag),
    )

  const byTime = SAFETY_TIMES.map((time) => {
    const inTime = notes.filter((note) => note.when === time)
    const { safe, unsafe } = sentiment(inTime)
    return { time, count: inTime.length, safe, unsafe }
  })

  if (!enough) {
    return { count, enough: false, tags, headline: null, byTime }
  }

  const { safe, unsafe } = sentiment(notes)
  const busiest = busiestTime(byTime)
  const phrase = busiest ? timePhrase(busiest) : 'here'
  const headline =
    safe === unsafe
      ? `Mixed reports, mostly ${phrase}`
      : safe > unsafe
        ? `Mostly felt safe ${phrase}`
        : `Mostly felt unsafe ${phrase}`

  return { count, enough: true, tags, headline, byTime }
}

export const EMPTY_SAFETY_SUMMARY = summarizeSafety([])

export function summarizeByTarget(notes: SafetyNote[]): Map<string, SafetySummary> {
  const grouped = new Map<string, SafetyNote[]>()

  for (const note of notes) {
    const existing = grouped.get(note.targetId)
    if (existing) existing.push(note)
    else grouped.set(note.targetId, [note])
  }

  const summaries = new Map<string, SafetySummary>()
  for (const [targetId, list] of grouped) summaries.set(targetId, summarizeSafety(list))
  return summaries
}

export function safetySummaryFor(notes: SafetyNote[], targetId: string): SafetySummary {
  return summarizeSafety(notes.filter((note) => note.targetId === targetId))
}

// In-memory copy of the sample notes. Swapping this module's write path for a
// Supabase insert leaves every caller unchanged.
const notes: SafetyNote[] = [...(mockNotes as SafetyNote[])]

export function getSafetyNotes(): SafetyNote[] {
  return notes
}

export async function addSafetyNote(
  target: SafetyTarget,
  draft: SafetyDraft,
): Promise<SafetyNote> {
  const note: SafetyNote = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetId: target.targetId,
    kind: target.kind,
    label: target.label,
    tags: draft.tags,
    when: draft.when,
    createdAt: new Date().toISOString(),
  }

  notes.push(note)
  return note
}

// One note per stop or route per day, per browser. No ids, accounts or names.
const NOTED_KEY = 'ghost-routes:safety-notes'

function localDayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readNotedLog(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(NOTED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function notedToday(targetId: string) {
  return readNotedLog()[targetId] === localDayKey()
}

export function notedTargetsToday(): string[] {
  const log = readNotedLog()
  const today = localDayKey()
  return Object.keys(log).filter((targetId) => log[targetId] === today)
}

export function markNotedToday(targetId: string) {
  try {
    window.localStorage.setItem(
      NOTED_KEY,
      JSON.stringify({ ...readNotedLog(), [targetId]: localDayKey() }),
    )
  } catch {
    // Storage blocked or full: the sheet still shows "Noted today".
  }
}
