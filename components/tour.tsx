'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

const TOUR_SEEN_KEY = 'ghost-routes:tour-seen'
const TOUR_EVENT = 'ghost-routes:how-it-works'

/** Replay the tour from anywhere on the map page. */
export function openTour() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOUR_EVENT))
}

type Spotlight = { top: number; left: number; width: number; height: number }

type TourStep = {
  id: string
  title: string
  body: string
  /** Element to ring, when there is one worth pointing at. */
  selector?: string
  placement: 'near' | 'center'
  swatches?: boolean
}

const STEPS: TourStep[] = [
  {
    id: 'routes',
    title: 'Routes that aren’t on other maps',
    body: 'Ghost Routes maps the shared autos, minibuses, buses and jeeps that never make it onto city maps. Riders add them one sighting at a time.',
    selector: '[data-tour="search"]',
    placement: 'near',
  },
  {
    id: 'solid',
    title: 'How solid is it?',
    body: 'Every line is a guess with a confidence level, so colour and pattern tell you how much to trust it.',
    placement: 'center',
    swatches: true,
  },
  {
    id: 'tap',
    title: 'Tap a route',
    body: 'Tap a line to open its sheet: the fare range, the landmarks at each end, and whether it is likely running right now.',
    selector: '.route-line',
    placement: 'near',
  },
  {
    id: 'help',
    title: 'Help it appear',
    body: 'Rode one? Tap “I rode this”. Reports are anonymous, so nothing is tied to you or your account.',
    placement: 'center',
  },
  {
    id: 'safe',
    title: 'Stay safe',
    body: 'Tag how pickup and safety feel at a stop or on a route, and check alerts for strikes, closures and delays. Both stay anonymous.',
    placement: 'center',
  },
]

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the tour simply shows again next time.
  }
}

function cardStyle(
  placement: TourStep['placement'],
  spotlight: Spotlight | null,
  viewportWidth: number,
  viewportHeight: number,
): CSSProperties {
  const width = Math.min(320, Math.max(240, viewportWidth - 32))

  // Before the first measurement, keep it out of the way in a safe corner.
  if (!viewportWidth || !viewportHeight) return { left: 16, bottom: 16, width }

  if (placement === 'center' || !spotlight) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(320, viewportWidth - 32),
    }
  }

  // Phones get the card docked at the bottom; the ring still points at the spot.
  if (viewportWidth < 640) return { left: 16, right: 16, bottom: 16 }

  const gap = 12
  const estimate = 250
  const below = spotlight.top + spotlight.height + gap
  const top = below + estimate <= viewportHeight ? below : Math.max(16, spotlight.top - gap - estimate)
  const left = Math.min(
    Math.max(16, spotlight.left + spotlight.width / 2 - width / 2),
    viewportWidth - width - 16,
  )

  return { top, left, width }
}

function LineSwatches() {
  const rows = [
    { key: 'whisper', label: 'Whisper · few reports', dash: '1 7', cap: 'round' as const, color: 'text-route-whisper' },
    { key: 'flicker', label: 'Flickering', dash: '9 6', cap: 'butt' as const, color: 'text-route-flicker' },
    { key: 'solid', label: 'Confirmed', dash: undefined, cap: 'round' as const, color: 'text-route-solid' },
  ]

  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2">
          <svg
            viewBox="0 0 56 8"
            className={`h-2 w-14 shrink-0 ${row.color}`}
            aria-hidden="true"
          >
            <line
              x1="2"
              y1="4"
              x2="54"
              y2="4"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap={row.cap}
              strokeDasharray={row.dash}
            />
          </svg>
          <span className="font-sans text-xs text-text">{row.label}</span>
        </li>
      ))}
    </ul>
  )
}

export function Tour() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  // First visit only: the flag is written when the tour is finished or skipped.
  useEffect(() => {
    if (readFlag(TOUR_SEEN_KEY)) return
    setIndex(0)
    setOpen(true)
  }, [])

  useEffect(() => {
    const replay = () => {
      setIndex(0)
      setOpen(true)
    }

    window.addEventListener(TOUR_EVENT, replay)
    return () => window.removeEventListener(TOUR_EVENT, replay)
  }, [])

  useLayoutEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight })

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setSpotlight(null)
      return
    }

    const measure = () => {
      const selector = step?.selector
      if (!selector) {
        setSpotlight(null)
        return
      }

      const element = document.querySelector(selector)
      if (!element) {
        setSpotlight(null)
        return
      }

      const box = element.getBoundingClientRect()
      // A target that covers most of the screen (the map itself) is not worth
      // ringing; a full-width search bar on a phone still is.
      const coverage = (box.width * box.height) / (window.innerWidth * window.innerHeight)
      if (coverage > 0.5) {
        setSpotlight(null)
        return
      }

      const pad = 6
      setSpotlight({
        top: box.top - pad,
        left: box.left - pad,
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      })
    }

    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step?.selector])

  const close = useCallback(() => {
    writeFlag(TOUR_SEEN_KEY, 'seen')
    setOpen(false)
  }, [])

  const next = useCallback(() => setIndex((current) => Math.min(current + 1, STEPS.length - 1)), [])
  const back = useCallback(() => setIndex((current) => Math.max(current - 1, 0)), [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        back()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close, next, back])

  useEffect(() => {
    if (open) cardRef.current?.focus()
  }, [open, index])

  if (!open || !step) return null

  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-bg/85" aria-hidden="true" />

      {spotlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-md border border-route-solid"
          style={spotlight}
        />
      ) : null}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className="absolute flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 outline-none"
        style={cardStyle(step.placement, spotlight, viewport.width, viewport.height)}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
            Tour · {index + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
          >
            Skip
          </button>
        </div>

        <div aria-live="polite">
          <h2
            id="tour-title"
            className="font-sans text-base font-medium leading-tight tracking-tight text-text"
          >
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1.5 font-sans text-sm leading-snug text-muted-text">
            {step.body}
          </p>
          {step.swatches ? <LineSwatches /> : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {STEPS.map((entry, entryIndex) => (
              <span
                key={entry.id}
                className={`size-1.5 rounded-full ${
                  entryIndex === index ? 'bg-route-solid' : 'bg-line'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-1.5">
            {index > 0 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 font-sans text-xs text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={isLast ? close : next}
              className="inline-flex h-8 items-center justify-center rounded-full border border-route-solid bg-route-solid/15 px-3 font-sans text-xs text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
