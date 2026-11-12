'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Ghost, X } from 'lucide-react'
import {
  VEHICLE_LABELS,
  VEHICLE_TYPES,
  type GhostRoute,
  type RouteStop,
  type VehicleFilter,
  type VehicleType,
} from '@/lib/routes'
import { VehicleIcon } from '@/components/vehicle-icon'
import { ALERT_LABELS, relativeTime, reportCountLabel, type RouteAlertSummary } from '@/lib/alerts'

export type SearchResult =
  | {
      kind: 'stop'
      key: string
      name: string
      route: GhostRoute
      stop: RouteStop
      vehicles: VehicleType[]
    }
  | { kind: 'route'; key: string; name: string; route: GhostRoute }

const MAX_STOPS = 6
const MAX_ROUTES = 4

const FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'auto', label: 'Auto' },
  { value: 'minibus', label: 'Minibus' },
  { value: 'bus', label: 'Bus' },
  { value: 'jeep', label: 'Jeep' },
]

// Prefix matches read as more relevant than matches buried mid-name.
function byRelevance(query: string) {
  return (a: { name: string }, b: { name: string }) => {
    const aPrefix = a.name.toLowerCase().startsWith(query) ? 0 : 1
    const bPrefix = b.name.toLowerCase().startsWith(query) ? 0 : 1
    return aPrefix - bPrefix || a.name.localeCompare(b.name)
  }
}

export function SearchBar({
  routes,
  vehicleFilter,
  onVehicleFilterChange,
  pickupEase,
  onPickupEaseChange,
  alertRoutes,
  onSelectAlertRoute,
  onSelect,
}: {
  routes: GhostRoute[]
  vehicleFilter: VehicleFilter
  onVehicleFilterChange: (filter: VehicleFilter) => void
  pickupEase: boolean
  onPickupEaseChange: (enabled: boolean) => void
  alertRoutes: { route: GhostRoute; summary: RouteAlertSummary }[]
  onSelectAlertRoute: (routeId: string) => void
  onSelect: (result: SearchResult) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const alertsListId = useId()

  const normalized = query.trim().toLowerCase()

  // Stops repeat across routes, so gather which vehicle types call at each
  // stop name among the routes currently shown on the map.
  const vehiclesByStop = useMemo(() => {
    const byStop = new Map<string, VehicleType[]>()

    for (const route of routes) {
      for (const stop of route.stops) {
        const key = stop.name.trim().toLowerCase()
        const types = byStop.get(key) ?? []
        if (!types.includes(route.vehicleType)) types.push(route.vehicleType)
        byStop.set(key, types)
      }
    }

    for (const types of byStop.values()) {
      types.sort((a, b) => VEHICLE_TYPES.indexOf(a) - VEHICLE_TYPES.indexOf(b))
    }

    return byStop
  }, [routes])

  const results = useMemo<SearchResult[]>(() => {
    if (!normalized) return []

    const stops: SearchResult[] = []
    const matches: SearchResult[] = []

    for (const route of routes) {
      if (route.name.toLowerCase().includes(normalized)) {
        matches.push({
          kind: 'route',
          key: `route-${route.id}`,
          name: route.name,
          route,
        })
      }

      for (const stop of route.stops) {
        if (!stop.name.toLowerCase().includes(normalized)) continue
        stops.push({
          kind: 'stop',
          key: `stop-${route.id}-${stop.id}`,
          name: stop.name,
          route,
          stop,
          vehicles:
            vehiclesByStop.get(stop.name.trim().toLowerCase()) ?? [route.vehicleType],
        })
      }
    }

    stops.sort(byRelevance(normalized))
    matches.sort(byRelevance(normalized))

    return [...stops.slice(0, MAX_STOPS), ...matches.slice(0, MAX_ROUTES)]
  }, [routes, normalized, vehiclesByStop])

  const showPanel = open && normalized.length > 0

  useEffect(() => {
    setActiveIndex(-1)
  }, [normalized])

  useEffect(() => {
    if (!showPanel) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showPanel])

  useEffect(() => {
    if (!alertsOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setAlertsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [alertsOpen])

  function choose(result: SearchResult) {
    onSelect(result)
    setQuery('')
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.blur()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => {
        const step = event.key === 'ArrowDown' ? 1 : -1
        if (current < 0) return step === 1 ? 0 : results.length - 1
        return (current + step + results.length) % results.length
      })
      return
    }

    if (event.key === 'Enter') {
      const result = results[activeIndex] ?? (results.length === 1 ? results[0] : undefined)
      if (!result) return
      event.preventDefault()
      choose(result)
      return
    }

    if (event.key === 'Escape') {
      if (showPanel) {
        event.preventDefault()
        setOpen(false)
      } else if (query) {
        event.preventDefault()
        setQuery('')
      }
    }
  }

  return (
    <div
      ref={containerRef}
      data-tour="search"
      className="fixed left-4 right-16 top-4 z-[1200] md:left-1/2 md:right-auto md:top-6 md:w-[26rem] md:-translate-x-1/2"
    >
      <div className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface pl-4 pr-1.5 focus-within:border-route-solid">
        <Ghost className="size-4 shrink-0 text-muted-text" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search stops and routes"
          placeholder="Where to?"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 appearance-none bg-transparent font-sans text-sm text-text outline-none placeholder:text-muted-text [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setOpen(false)
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto">
        <div role="group" aria-label="Filter routes by vehicle type" className="flex shrink-0 gap-1.5">
        {FILTERS.map((filter) => {
          const isActive = vehicleFilter === filter.value

          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onVehicleFilterChange(filter.value)}
              className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
                isActive
                  ? 'border-route-solid bg-card text-text'
                  : 'border-line bg-surface text-muted-text hover:bg-card hover:text-text'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
        </div>

        <button
          type="button"
          aria-pressed={pickupEase}
          onClick={() => onPickupEaseChange(!pickupEase)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
            pickupEase
              ? 'border-route-solid bg-card text-text'
              : 'border-line bg-surface text-muted-text hover:bg-card hover:text-text'
          }`}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-route-solid" />
          Pickup ease
        </button>

        <button
          type="button"
          aria-expanded={alertsOpen}
          aria-controls={alertsListId}
          onClick={() => setAlertsOpen((current) => !current)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid ${
            alertsOpen
              ? 'border-route-flicker bg-card text-text'
              : 'border-line bg-surface text-muted-text hover:bg-card hover:text-text'
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${
              alertRoutes.length > 0 ? 'bg-route-flicker' : 'bg-muted-text'
            }`}
          />
          {alertRoutes.length > 0 ? `Alerts · ${alertRoutes.length}` : 'Alerts'}
        </button>
      </div>

      {alertsOpen ? (
        <div
          id={alertsListId}
          aria-label="Routes with active alerts"
          className="mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-surface"
        >
          {alertRoutes.length > 0 ? (
            alertRoutes.map(({ route, summary }) => (
              <button
                key={route.id}
                type="button"
                onClick={() => {
                  onSelectAlertRoute(route.id)
                  setAlertsOpen(false)
                }}
                className="flex w-full items-start justify-between gap-3 border-b border-line px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-card"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-sm text-text">{route.name}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
                    {summary.kinds.map((entry) => (
                      <span key={entry.kind} className="whitespace-nowrap">
                        {ALERT_LABELS[entry.kind]}
                        {entry.count > 1 ? ` · ${entry.count}` : ''}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-route-flicker">
                    {reportCountLabel(summary.count)}
                  </span>
                  {summary.newest ? (
                    <span className="block font-mono text-[10px] text-muted-text">
                      {relativeTime(summary.newest.createdAt)}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-3 font-sans text-sm text-muted-text">
              No active alerts right now.
            </p>
          )}
        </div>
      ) : null}

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-surface"
        >
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.key}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onClick={() => choose(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === activeIndex ? 'bg-card' : 'hover:bg-card'
                }`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {result.kind === 'route' ? (
                    <VehicleIcon
                      type={result.route.vehicleType}
                      className="size-4 shrink-0 text-muted-text"
                    />
                  ) : null}
                  <span className="min-w-0 truncate font-sans text-sm text-text">
                    {result.name}
                  </span>
                </span>

                {result.kind === 'route' ? (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
                    {VEHICLE_LABELS[result.route.vehicleType]}
                  </span>
                ) : (
                  <span className="flex max-w-[58%] flex-wrap justify-end gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
                    {result.vehicles.map((type) => (
                      <span key={type} className="inline-flex items-center gap-1 whitespace-nowrap">
                        <VehicleIcon type={type} className="size-3" />
                        {VEHICLE_LABELS[type]}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-4 py-3 font-sans text-sm text-muted-text">
              No stops or routes match “{query.trim()}”.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
