'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import './leaflet-fixes.css'

/**
 * AI route mapper — hosts the AI + Maps module inside the product shell.
 *
 * The home page's map stays the full-bleed community map; this panel opens on
 * top of it as a sheet, so the AI normalization, OSRM road snapping and the
 * three layer toggles live in their own bounded container and never restyle or
 * reflow the rest of the UI.
 */
const GhostRouteMapper = dynamic(() => import('@/components/ai-maps/GhostRouteMapper'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] w-full items-center justify-center rounded-md border border-line bg-card">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
        Loading AI mapper…
      </span>
    </div>
  ),
})

export function AiRoutePanel() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text shadow-sm transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-route-solid" />
        AI route
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label="AI route mapper"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[1090] mx-auto flex max-h-[88vh] w-full max-w-5xl flex-col gap-3 overflow-y-auto rounded-t-lg border border-line bg-surface p-4 pb-6 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
            AI + Maps
          </p>
          <h2 className="text-lg font-semibold text-text">Map a route from a description</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-text transition-colors hover:bg-card"
          aria-label="Close AI route mapper"
        >
          ×
        </button>
      </div>

      <GhostRouteMapper />
    </div>
  )
}
