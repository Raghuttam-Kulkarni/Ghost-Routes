import mockReviews from '@/data/mock-spot-reviews.json'
import { VEHICLE_TYPES, type VehicleType } from '@/lib/routes'

export type { VehicleType }

export const PICKUP_EASES = ['quick', 'sometimes', 'hard'] as const

export type PickupEase = (typeof PICKUP_EASES)[number]

export const EASE_LABELS: Record<PickupEase, string> = {
  quick: 'Vehicles come quickly',
  sometimes: 'Sometimes a wait',
  hard: 'Hard to find one',
}

export const EASE_SHORT_LABELS: Record<PickupEase, string> = {
  quick: 'Easy',
  sometimes: 'Sometimes',
  hard: 'Hard',
}

export const TYPICAL_WAITS = ['under5', 'from5to15', 'from15to30', 'over30'] as const

export type TypicalWait = (typeof TYPICAL_WAITS)[number]

export const WAIT_LABELS: Record<TypicalWait, string> = {
  under5: 'under 5 min',
  from5to15: '5 to 15 min',
  from15to30: '15 to 30 min',
  over30: '30+ min',
}

export const VEHICLE_CHOICES = VEHICLE_TYPES

export const VEHICLE_SHORT_LABELS: Record<VehicleType, string> = {
  auto: 'Auto',
  minibus: 'Minibus',
  bus: 'Bus',
  jeep: 'Jeep',
  van: 'Van',
}

export const DAY_PERIODS = ['morning', 'afternoon', 'evening', 'night'] as const

export type DayPeriod = (typeof DAY_PERIODS)[number]

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
}

export const PERIOD_SHORT_LABELS: Record<DayPeriod, string> = {
  morning: 'Morn',
  afternoon: 'Aft',
  evening: 'Eve',
  night: 'Night',
}

export const MIN_REVIEWS_FOR_SCORE = 3

export type SpotKind = 'stop' | 'street'

export type SpotReview = {
  id: string
  spotId: string
  kind: SpotKind
  label: string
  lat: number
  lon: number
  ease: PickupEase
  wait: TypicalWait
  vehicles: VehicleType[]
  note?: string
  /** Hour of day from the reviewer's device clock, 0-23. */
  hour: number
  createdAt: string
}

/** Where a review is being left: a named stop or a street spot. */
export type ReviewTarget = {
  spotId: string
  kind: SpotKind
  label: string
  lat: number
  lon: number
}

export type ReviewDraft = {
  ease: PickupEase
  wait: TypicalWait
  vehicles: VehicleType[]
  note?: string
}

export type PeriodSummary = {
  period: DayPeriod
  count: number
  ease: PickupEase | null
}

export type PickupSummary = {
  count: number
  /** Null until there are enough reviews to call it. */
  ease: PickupEase | null
  wait: TypicalWait | null
  vehicles: VehicleType[]
  byPeriod: PeriodSummary[]
}

export type PickupSpot = {
  spotId: string
  kind: SpotKind
  label: string
  lat: number
  lon: number
  reviews: SpotReview[]
  summary: PickupSummary
}

// Street spots are snapped to a ~50 m grid so an exact tap is never stored.
const SPOT_GRID = 0.00045

export function snapCoordinate(lat: number, lon: number) {
  return {
    lat: Math.round(lat / SPOT_GRID) * SPOT_GRID,
    lon: Math.round(lon / SPOT_GRID) * SPOT_GRID,
  }
}

export function stopSpotId(stopId: string) {
  return `stop:${stopId}`
}

export function stopTarget(stop: { id: string; name: string; lat: number; lon: number }): ReviewTarget {
  return {
    spotId: stopSpotId(stop.id),
    kind: 'stop',
    label: stop.name,
    lat: stop.lat,
    lon: stop.lon,
  }
}

export function streetTarget(lat: number, lon: number): ReviewTarget {
  const snapped = snapCoordinate(lat, lon)

  return {
    spotId: `street:${snapped.lat.toFixed(4)}:${snapped.lon.toFixed(4)}`,
    kind: 'street',
    label: 'Street spot',
    lat: snapped.lat,
    lon: snapped.lon,
  }
}

export function periodOfHour(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export function reviewCountLabel(count: number) {
  return `${count} review${count === 1 ? '' : 's'}`
}

const EASE_SCORE: Record<PickupEase, number> = { quick: 3, sometimes: 2, hard: 1 }

function scoreEase(reviews: SpotReview[]): PickupEase {
  const mean = reviews.reduce((sum, review) => sum + EASE_SCORE[review.ease], 0) / reviews.length
  if (mean >= 2.5) return 'quick'
  if (mean >= 1.75) return 'sometimes'
  return 'hard'
}

function commonWait(reviews: SpotReview[]): TypicalWait {
  const counts = new Map<TypicalWait, number>()
  for (const review of reviews) counts.set(review.wait, (counts.get(review.wait) ?? 0) + 1)

  let best: TypicalWait = TYPICAL_WAITS[0]
  let bestCount = -1

  // Iterating in wait order means ties fall back to the shorter wait.
  for (const wait of TYPICAL_WAITS) {
    const count = counts.get(wait) ?? 0
    if (count > bestCount) {
      best = wait
      bestCount = count
    }
  }

  return best
}

function vehiclesSeen(reviews: SpotReview[]): VehicleType[] {
  const seen = new Set<VehicleType>()
  for (const review of reviews) for (const vehicle of review.vehicles) seen.add(vehicle)
  return VEHICLE_TYPES.filter((type) => seen.has(type))
}

export function summarizeReviews(reviews: SpotReview[]): PickupSummary {
  const count = reviews.length
  const enough = count >= MIN_REVIEWS_FOR_SCORE

  return {
    count,
    ease: enough ? scoreEase(reviews) : null,
    wait: count > 0 ? commonWait(reviews) : null,
    vehicles: vehiclesSeen(reviews),
    byPeriod: DAY_PERIODS.map((period) => {
      const inPeriod = reviews.filter((review) => periodOfHour(review.hour) === period)
      return {
        period,
        count: inPeriod.length,
        ease: inPeriod.length > 0 ? scoreEase(inPeriod) : null,
      }
    }),
  }
}

export const EMPTY_PICKUP_SUMMARY: PickupSummary = summarizeReviews([])

export function groupSpots(reviews: SpotReview[]): PickupSpot[] {
  const groups = new Map<string, SpotReview[]>()

  for (const review of reviews) {
    const existing = groups.get(review.spotId)
    if (existing) existing.push(review)
    else groups.set(review.spotId, [review])
  }

  return [...groups.entries()].map(([spotId, list]) => {
    const [first] = list
    return {
      spotId,
      kind: first.kind,
      label: first.label,
      lat: first.lat,
      lon: first.lon,
      reviews: list,
      summary: summarizeReviews(list),
    }
  })
}

// In-memory copy of the spot data. Swapping this module's write path for a
// Supabase insert leaves every caller unchanged.
const reviews: SpotReview[] = [...(mockReviews as SpotReview[])]

export function getSpotReviews(): SpotReview[] {
  return reviews
}

export async function addSpotReview(target: ReviewTarget, draft: ReviewDraft): Promise<SpotReview> {
  const note = draft.note?.trim().slice(0, 120)

  const review: SpotReview = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    spotId: target.spotId,
    kind: target.kind,
    label: target.label,
    lat: target.lat,
    lon: target.lon,
    ease: draft.ease,
    wait: draft.wait,
    vehicles: draft.vehicles,
    note: note ? note : undefined,
    // Time of day comes from the device clock, not the reviewer.
    hour: new Date().getHours(),
    createdAt: new Date().toISOString(),
  }

  reviews.push(review)
  return review
}

// One review per spot per day, per browser. No ids, accounts or names.
const REVIEWED_KEY = 'ghost-routes:pickup-reviews'

function localDayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readReviewLog(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(REVIEWED_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function reviewedToday(spotId: string) {
  return readReviewLog()[spotId] === localDayKey()
}

export function reviewedSpotsToday(): string[] {
  const log = readReviewLog()
  const today = localDayKey()
  return Object.keys(log).filter((spotId) => log[spotId] === today)
}

export function markReviewedToday(spotId: string) {
  try {
    window.localStorage.setItem(
      REVIEWED_KEY,
      JSON.stringify({ ...readReviewLog(), [spotId]: localDayKey() }),
    )
  } catch {
    // Storage blocked or full: the sheet still shows "Reviewed today".
  }
}
