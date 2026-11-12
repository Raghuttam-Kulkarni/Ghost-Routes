'use client'

import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { latLngBounds, type Map as LeafletMap } from 'leaflet'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { AlertSheet } from '@/components/alert-sheet'
import { CommunityRoutes } from '@/components/community-routes'
import { BookingSheet } from '@/components/booking-sheet'
import { PickupLayer } from '@/components/pickup-layer'
import { ReviewSheet } from '@/components/review-sheet'
import { RouteLayer } from '@/components/route-layer'
import { RouteSheet } from '@/components/route-sheet'
import { SafetySheet } from '@/components/safety-sheet'
import { SearchBar, type SearchResult } from '@/components/search-bar'
import { Tour } from '@/components/tour'
import { applyRouteReport, type GhostRoute, type RouteReportKind, type RouteReportResult, type VehicleFilter } from '@/lib/routes'
import {
  addSpotReview,
  getSpotReviews,
  groupSpots,
  markReviewedToday,
  reviewedSpotsToday,
  streetTarget,
  type ReviewDraft,
  type ReviewTarget,
  type SpotReview,
} from '@/lib/reviews'
import {
  addAlert,
  alertReportedToday,
  getAlerts,
  markAlertReported,
  reportedAlertKeysToday,
  summarizeAlerts,
  type AlertDraft,
  type AlertKind,
  type RouteAlert,
  type RouteAlertSummary,
} from '@/lib/alerts'
import {
  addSafetyNote,
  EMPTY_SAFETY_SUMMARY,
  getSafetyNotes,
  markNotedToday,
  notedTargetsToday,
  notedToday,
  routeSafetyTarget,
  safetySummaryFor,
  type SafetyDraft,
  type SafetyNote,
  type SafetyTarget,
} from '@/lib/safety'

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946]
const FIT_PADDING: [number, number] = [40, 40]

function routeBounds(route: GhostRoute) {
  return latLngBounds([
    ...route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
    ...route.stops.map((stop) => [stop.lat, stop.lon] as [number, number]),
  ])
}

// Keyless, theme-matched basemaps from Esri's Canvas service. CARTO's raster
// tiles now require an API key and answer keyless requests with an
// "API KEY REQUIRED" placeholder tile, so these need no key at all.
const TILE_URLS = {
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  light:
    'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
} as const

const ATTRIBUTION = '© OpenStreetMap contributors © Esri, HERE, Garmin, USGS'

// Drop Leaflet's default "Leaflet |" prefix so the visible credit is exactly
// the map data attribution.
function AttributionPrefix() {
  const map = useMap()

  useEffect(() => {
    map.attributionControl?.setPrefix(false)
  }, [map])

  return null
}

// Fit the view to every route on load, padded around the outermost points.
// Leaflet clamps the resulting zoom to the map's minZoom.
function FitRoutes({ routes }: { routes: GhostRoute[] }) {
  const map = useMap()

  useEffect(() => {
    const points = routes.flatMap((route) => [
      ...route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      ...route.stops.map((stop) => [stop.lat, stop.lon] as [number, number]),
    ])

    if (points.length === 0) return

    const bounds = latLngBounds(points)
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: FIT_PADDING, animate: false })
    }
  }, [map, routes])

  return null
}

// Hand the Leaflet instance up so the search bar can move the view.
function MapInstance({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap()

  useEffect(() => {
    onReady(map)
  }, [map, onReady])

  return null
}

// Clicking the map (but not a route line, which stops bubbling) closes the
// detail sheet.
function MapClickClose({ onClose }: { onClose: () => void }) {
  const map = useMap()

  useEffect(() => {
    map.on('click', onClose)
    return () => {
      map.off('click', onClose)
    }
  }, [map, onClose])

  return null
}

// A long press (or right click) anywhere on the map starts a pickup review for
// that street spot. The point is snapped to a ~50 m grid before it is stored.
function MapLongPress({ onSpot }: { onSpot: (lat: number, lon: number) => void }) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    let timer: ReturnType<typeof setTimeout> | null = null
    let origin: { x: number; y: number } | null = null
    let suppressUntil = 0

    const cancel = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      origin = null
    }

    const open = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect()
      const point = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top])
      // A long press also fires contextmenu on touch; ignore that echo.
      suppressUntil = Date.now() + 900
      onSpot(point.lat, point.lng)
    }

    // Markers, lines and popups keep their own click behaviour.
    const isMapSurface = (target: EventTarget | null) =>
      !(target as Element | null)?.closest?.(
        '.leaflet-interactive, .leaflet-popup, .leaflet-control, .leaflet-tooltip',
      )

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (!isMapSurface(event.target)) return

      cancel()
      origin = { x: event.clientX, y: event.clientY }
      const start = origin

      timer = setTimeout(() => {
        timer = null
        if (!origin) return
        open(start.x, start.y)
      }, 550)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!origin) return
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) cancel()
    }

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      if (Date.now() < suppressUntil) return
      if (!isMapSurface(event.target)) return
      open(event.clientX, event.clientY)
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', cancel)
    container.addEventListener('pointercancel', cancel)
    container.addEventListener('pointerleave', cancel)
    container.addEventListener('contextmenu', onContextMenu)

    return () => {
      cancel()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', cancel)
      container.removeEventListener('pointercancel', cancel)
      container.removeEventListener('pointerleave', cancel)
      container.removeEventListener('contextmenu', onContextMenu)
    }
  }, [map, onSpot])

  return null
}

export default function GhostMap({ routes, signedIn }: { routes: GhostRoute[]; signedIn: boolean }) {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [bookingRouteId, setBookingRouteId] = useState<string | null>(null)
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('all')
  // Local copy of the data so community reports update the map without a reload.
  const [routeData, setRouteData] = useState<GhostRoute[]>(routes)
  // Pickup-ease reviews are anonymous and device-local: no ids are stored.
  const [reviews, setReviews] = useState<SpotReview[]>(() => getSpotReviews())
  const [reviewedSpotIds, setReviewedSpotIds] = useState<string[]>(() => reviewedSpotsToday())
  const [pickupEaseOn, setPickupEaseOn] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  // Safety notes are tags only, anonymous, and device-local.
  const [safetyNotes, setSafetyNotes] = useState<SafetyNote[]>(() => getSafetyNotes())
  const [notedSafetyIds, setNotedSafetyIds] = useState<string[]>(() => notedTargetsToday())
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null)
  // Disruption reports expire after 24 hours and carry no user id.
  const [alerts, setAlerts] = useState<RouteAlert[]>(() => getAlerts())
  const [reportedAlertKeys, setReportedAlertKeys] = useState<string[]>(() =>
    reportedAlertKeysToday(),
  )
  const [alertRouteId, setAlertRouteId] = useState<string | null>(null)
  const pickupSpots = useMemo(() => groupSpots(reviews), [reviews])
  const alertSummaries = useMemo(() => summarizeAlerts(alerts), [alerts])
  const tileTheme = resolvedTheme === 'light' ? 'light' : 'dark'
  const selectedRoute = routeData.find((route) => route.id === selectedRouteId) ?? null
  const selectedSafety = useMemo(
    () =>
      selectedRoute
        ? safetySummaryFor(safetyNotes, routeSafetyTarget(selectedRoute).targetId)
        : EMPTY_SAFETY_SUMMARY,
    [safetyNotes, selectedRoute],
  )

  // Routes with active alerts, newest report first, for the Alerts list.
  const alertRoutes = useMemo(
    () =>
      routeData
        .map((route) => ({ route, summary: alertSummaries.get(route.id) }))
        .filter(
          (entry): entry is { route: GhostRoute; summary: RouteAlertSummary } =>
            Boolean(entry.summary),
        )
        .sort(
          (a, b) =>
            new Date(b.summary.newest?.createdAt ?? 0).getTime() -
            new Date(a.summary.newest?.createdAt ?? 0).getTime(),
        ),
    [routeData, alertSummaries],
  )

  const alertedRouteIds = alertRoutes
    .filter((entry) => entry.summary.banner)
    .map((entry) => entry.route.id)
  const alertRoute = routeData.find((route) => route.id === alertRouteId) ?? null

  const visibleRoutes = useMemo(
    () =>
      vehicleFilter === 'all'
        ? routeData
        : routeData.filter((route) => route.vehicleType === vehicleFilter),
    [routeData, vehicleFilter],
  )

  // Hiding a route should not leave its sheet open over a map where it is gone.
  useEffect(() => {
    if (!selectedRouteId) return
    if (!visibleRoutes.some((route) => route.id === selectedRouteId)) setSelectedRouteId(null)
  }, [selectedRouteId, visibleRoutes])

  // A shared link (?route=ID) opens that route and frames it once the map exists.
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (!map || deepLinkHandled.current) return
    deepLinkHandled.current = true

    const routeId = new URLSearchParams(window.location.search).get('route')
    if (!routeId) return

    const route = routeData.find((entry) => entry.id === routeId)
    if (!route) return

    setSelectedRouteId(route.id)
    const bounds = routeBounds(route)
    if (bounds.isValid()) map.fitBounds(bounds, { padding: FIT_PADDING, animate: false })

    // Returning from sign-in lands here with the booking form already open.
    const wantsBooking = new URLSearchParams(window.location.search).get('book') === '1'
    if (wantsBooking && signedIn) setBookingRouteId(route.id)
  }, [map, routeData, signedIn])

  const totalSightings = routeData.reduce((sum, route) => sum + route.sightingsThisWeek, 0)
  const bookingRoute = routeData.find((route) => route.id === bookingRouteId) ?? null

  const closeSheet = useCallback(() => {
    setSelectedRouteId(null)
    setBookingRouteId(null)
  }, [])

  // A stop zooms in on the stop itself; a route fits its whole line and stops.
  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      setSelectedRouteId(result.route.id)
      if (!map) return

      if (result.kind === 'stop') {
        map.flyTo([result.stop.lat, result.stop.lon], Math.max(map.getZoom(), 15), {
          duration: 0.6,
        })
        return
      }

      const bounds = routeBounds(result.route)
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: FIT_PADDING, duration: 0.6 })
      }
    },
    [map],
  )

  // Seat requests need an account; everything else stays public.
  const handleRequestSeat = useCallback(() => {
    if (!selectedRoute) return

    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/?route=${selectedRoute.id}&book=1`)}`)
      return
    }

    setBookingRouteId(selectedRoute.id)
  }, [router, selectedRoute, signedIn])

  const handleReport = useCallback(
    async (routeId: string, kind: RouteReportKind): Promise<RouteReportResult | null> => {
      const current = routeData.find((route) => route.id === routeId)
      if (!current) return null

      const result = await applyRouteReport(current, kind)
      setRouteData((prev) =>
        prev.map((route) =>
          route.id === result.id
            ? {
                ...route,
                confidence: result.confidence,
                sightingsThisWeek: result.sightingsThisWeek,
              }
            : route,
        ),
      )

      return result
    },
    [routeData],
  )

  const handleRateSpot = useCallback((target: ReviewTarget) => {
    setSelectedRouteId(null)
    setBookingRouteId(null)
    setReviewTarget(target)
  }, [])

  const handleStreetLongPress = useCallback(
    (lat: number, lon: number) => handleRateSpot(streetTarget(lat, lon)),
    [handleRateSpot],
  )

  const handleSubmitReview = useCallback(
    async (draft: ReviewDraft) => {
      if (!reviewTarget) return

      const review = await addSpotReview(reviewTarget, draft)
      markReviewedToday(reviewTarget.spotId)
      setReviews((prev) => [...prev, review])
      setReviewedSpotIds(reviewedSpotsToday())
    },
    [reviewTarget],
  )

  const handleAddSafetyNote = useCallback((target: SafetyTarget) => {
    setReviewTarget(null)
    setBookingRouteId(null)
    setSafetyTarget(target)
  }, [])

  const handleSubmitSafetyNote = useCallback(
    async (draft: SafetyDraft) => {
      if (!safetyTarget) return
      // The day limit lives in storage too, so a double tap cannot add twice.
      if (notedToday(safetyTarget.targetId)) return

      const note = await addSafetyNote(safetyTarget, draft)
      markNotedToday(safetyTarget.targetId)
      setSafetyNotes((prev) => [...prev, note])
      setNotedSafetyIds(notedTargetsToday())
    },
    [safetyTarget],
  )

  const handleSelectAlertRoute = useCallback(
    (routeId: string) => {
      const route = routeData.find((entry) => entry.id === routeId)
      if (!route) return

      setSelectedRouteId(routeId)
      if (!map) return

      const bounds = routeBounds(route)
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: FIT_PADDING, duration: 0.6 })
    },
    [map, routeData],
  )

  // Only one bottom sheet at a time.
  const handleReportProblem = useCallback(() => {
    if (!selectedRoute) return

    setReviewTarget(null)
    setSafetyTarget(null)
    setBookingRouteId(null)
    setAlertRouteId(selectedRoute.id)
  }, [selectedRoute])

  const handleSubmitAlert = useCallback(
    async (draft: AlertDraft) => {
      if (!alertRoute) return

      const routeId = alertRoute.id
      // One report of each type per route per day. Claim the day slot before
      // writing, so a double tap or retried click cannot add two reports.
      if (alertReportedToday(routeId, draft.kind)) return
      markAlertReported(routeId, draft.kind)

      try {
        const alert = await addAlert(routeId, draft)
        setAlerts((prev) => [...prev, alert])
      } finally {
        setReportedAlertKeys(reportedAlertKeysToday())
      }
    },
    [alertRoute],
  )

  const alertReportedKinds = alertRoute
    ? (reportedAlertKeys
        .filter((key) => key.startsWith(`${alertRoute.id}:`))
        .map((key) => key.slice(alertRoute.id.length + 1)) as AlertKind[])
    : []

  return (
    <div className="relative size-full">
      <MapContainer
        center={BENGALURU_CENTER}
        zoom={12}
        minZoom={5}
        zoomControl={false}
        className="ghost-map size-full bg-bg"
      >
        <AttributionPrefix />
        <MapInstance onReady={setMap} />
        <FitRoutes routes={routes} />
        <TileLayer
          key={tileTheme}
          url={TILE_URLS[tileTheme]}
          attribution={ATTRIBUTION}
          maxZoom={16}
        />
        <CommunityRoutes />
        <RouteLayer
          routes={visibleRoutes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          reviews={reviews}
          onRateSpot={handleRateSpot}
          reviewedSpotIds={reviewedSpotIds}
          safetyNotes={safetyNotes}
          onAddSafetyNote={handleAddSafetyNote}
          notedSafetyIds={notedSafetyIds}
          alertedRouteIds={alertedRouteIds}
        />
        {pickupEaseOn ? (
          <PickupLayer
            spots={pickupSpots}
            onRateSpot={handleRateSpot}
            reviewedSpotIds={reviewedSpotIds}
          />
        ) : null}
        <MapLongPress onSpot={handleStreetLongPress} />
        <MapClickClose onClose={closeSheet} />
      </MapContainer>

      <SearchBar
        routes={visibleRoutes}
        vehicleFilter={vehicleFilter}
        onVehicleFilterChange={setVehicleFilter}
        pickupEase={pickupEaseOn}
        onPickupEaseChange={setPickupEaseOn}
        alertRoutes={alertRoutes}
        onSelectAlertRoute={handleSelectAlertRoute}
        onSelect={handleSearchSelect}
      />

      <p className="pointer-events-none absolute bottom-3 left-3 z-[900] rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] text-muted-text">
        {routes.length} ghost routes · {totalSightings} sightings this week
      </p>

      {selectedRoute && (
        <RouteSheet
          route={selectedRoute}
          onClose={closeSheet}
          onReport={handleReport}
          onRequestSeat={handleRequestSeat}
          safety={selectedSafety}
          safetyNotedToday={notedSafetyIds.includes(routeSafetyTarget(selectedRoute).targetId)}
          onAddSafetyNote={() => handleAddSafetyNote(routeSafetyTarget(selectedRoute))}
          alerts={alertSummaries.get(selectedRoute.id) ?? null}
          onReportProblem={handleReportProblem}
        />
      )}

      {bookingRoute && <BookingSheet route={bookingRoute} onClose={() => setBookingRouteId(null)} />}

      {reviewTarget ? (
        <ReviewSheet
          target={reviewTarget}
          alreadyReviewed={reviewedSpotIds.includes(reviewTarget.spotId)}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleSubmitReview}
        />
      ) : null}

      {safetyTarget ? (
        <SafetySheet
          target={safetyTarget}
          alreadyNoted={notedSafetyIds.includes(safetyTarget.targetId)}
          onClose={() => setSafetyTarget(null)}
          onSubmit={handleSubmitSafetyNote}
        />
      ) : null}

      {alertRoute ? (
        <AlertSheet
          route={alertRoute}
          reportedKinds={alertReportedKinds}
          onClose={() => setAlertRouteId(null)}
          onSubmit={handleSubmitAlert}
        />
      ) : null}

      {/* First-visit walkthrough; replayed from the account area. */}
      <Tour />
    </div>
  )
}
