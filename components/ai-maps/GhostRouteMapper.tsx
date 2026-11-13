"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FALLBACK_ROUTES, RAW_GPS_SAMPLE } from "@/lib/bengaluru";
import type { GhostRoute, LatLngTuple, NormalizedRouteData } from "../ghost-map.types";
import type { ManagedRoute } from "../MapLayerManager";
import { snapToRoads } from "@/lib/snapToRoads";

const MAX_INPUT_LENGTH = 4000;

/**
 * The layer manager owns the Leaflet map, so it is loaded client-only — the
 * same `ssr: false` boundary used by the rest of the map module.
 */
const MapLayerManager = dynamic(() => import("../MapLayerManager"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] w-full items-center justify-center rounded-xl border border-cyan-500/20 bg-[#050b14]">
      <span className="animate-pulse text-xs tracking-[0.3em] text-cyan-300/80 uppercase">
        Mapping ghost routes…
      </span>
    </div>
  ),
});

/** Preloaded so the map and the CLEANED layer are populated on first paint. */
const DEMO_ROUTE: ManagedRoute = { ...FALLBACK_ROUTES[0], isFallback: true } as ManagedRoute;

/** One-click prompts: fill the input and normalize immediately. */
const DEMO_SCENARIOS: { label: string; prompt: string }[] = [
  {
    label: "Yelahanka → Majestic",
    prompt: "Shared auto from Yelahanka to Majestic via Hebbal, ₹30, every 10 mins",
  },
  {
    label: "Majestic → Koramangala",
    prompt:
      "Shared auto from Majestic to Forum Koramangala via Sony World Signal, ₹25, every 10-15 mins",
  },
  {
    label: "Indiranagar → E-City",
    prompt: "Morning minibus from Indiranagar to Electronic City Phase 1 via Silk Board",
  },
];

/** Fare arrives as "INR 25-30"; the card shows it the way riders read it. */
function formatFare(fare: string): string {
  const trimmed = fare.trim();
  if (!trimmed || /^unknown$/i.test(trimmed)) return "Fare unknown";
  return trimmed.replace(/\bINR\b\s*/gi, "₹").replace(/\s+/g, " ");
}

export interface GhostRouteMapperProps {
  /**
   * Fired after a successful normalization, so a host screen can persist the
   * route or mirror it in its own state. Also receives the offline fallback
   * route when Gemini is unavailable, flagged with `isFallback: true`.
   */
  onRouteNormalized?: (routeData: NormalizedRouteData) => void;
  /** Routes to draw on the LOGGED ROUTES layer (e.g. already-loaded Supabase rows). */
  initialRoutes?: GhostRoute[];
  /** Extra classes for the outer wrapper, so a modal/tab can size it. */
  className?: string;
}

function pairFromNumbers(first: number, second: number): LatLngTuple | null {
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  // Accept [lat, lng] first, then the GeoJSON-friendly [lng, lat].
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [first, second];
  if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [second, first];
  return null;
}

/** Walks parsed JSON of any nesting and pulls out coordinate-looking pairs. */
function collectPairs(value: unknown, out: LatLngTuple[], depth = 0) {
  if (depth > 6 || out.length >= 500) return;

  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      const pair = pairFromNumbers(value[0], value[1]);
      if (pair) {
        out.push(pair);
        return;
      }
    }
    value.forEach((entry) => collectPairs(entry, out, depth + 1));
    return;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const lat = Number(record.lat ?? record.latitude);
    const lng = Number(record.lng ?? record.lon ?? record.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const pair = pairFromNumbers(lat, lng);
      if (pair) {
        out.push(pair);
        return;
      }
    }
    Object.values(record).forEach((entry) => collectPairs(entry, out, depth + 1));
  }
}

/**
 * Best-effort extraction of the "jittery" points the user supplied.
 * Handles JSON / GeoJSON and loose text such as `12.9756, 77.6068` per line.
 */
function extractRawPoints(rawInput: string): LatLngTuple[] {
  const text = rawInput.trim();
  if (!text) return [];

  const fromJson: LatLngTuple[] = [];
  if (/^[[{]/.test(text)) {
    try {
      collectPairs(JSON.parse(text), fromJson);
    } catch {
      // Not valid JSON — fall through to the text scan.
    }
    if (fromJson.length >= 2) return fromJson.slice(0, 500);
  }

  // Only comma/semicolon separated pairs, so prose like "INR 25-30" is ignored.
  const points: LatLngTuple[] = [];
  const pairPattern = /(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/g;
  for (const match of text.matchAll(pairPattern)) {
    const pair = pairFromNumbers(Number(match[1]), Number(match[2]));
    if (pair) points.push(pair);
    if (points.length >= 500) break;
  }
  return points;
}

/** A persisted route, in the shape the map's LOGGED ROUTES layer expects. */
interface SavedRoutePayload extends NormalizedRouteData {
  id?: string;
  source?: string;
}

function toGhostRoutes(routes: SavedRoutePayload[]): GhostRoute[] {
  return routes
    .filter((route) => Array.isArray(route.pathCoordinates) && route.pathCoordinates.length >= 2)
    .map((route) => ({
      id: route.id,
      name: route.routeName,
      coordinates: route.pathCoordinates,
    }));
}

/**
 * GhostRouteMapper — the whole AI + Maps module as one self-contained block.
 *
 * It owns its own state, network calls (`/api/normalize-route`, `/api/routes`),
 * Leaflet instance and OSRM road snapping, and it takes no page-level space
 * assumptions: drop it into a modal, a tab, a section or a full page and pass
 * `className` to size it. It never renders a header, nav or full-screen shell.
 */
export default function GhostRouteMapper({
  onRouteNormalized,
  initialRoutes = [],
  className = "",
}: GhostRouteMapperProps) {
  const [rawInput, setRawInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NormalizedRouteData | null>(null);
  const [demoPath, setDemoPath] = useState<LatLngTuple[] | null>(null);
  const [focusStop, setFocusStop] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [fetchedRoutes, setFetchedRoutes] = useState<GhostRoute[]>([]);
  const [saveState, setSaveState] = useState<{
    status: "idle" | "saving" | "saved" | "info" | "error";
    message: string;
  }>({
    status: "idle",
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // No input typed yet: show the preloaded demo trace on RAW GPS so the map is
  // never an empty grid, and the CLEANED layer starts on the Yelahanka route.
  const rawPoints = useMemo<LatLngTuple[]>(
    () => (rawInput.trim() ? extractRawPoints(rawInput) : RAW_GPS_SAMPLE),
    [rawInput],
  );

  // The preloaded route ships with straight stop-to-stop geometry; snap it to
  // real streets once on mount so the very first paint already follows roads.
  // snapToRoads memoises its result, so re-renders never re-fetch.
  useEffect(() => {
    let active = true;
    void snapToRoads(DEMO_ROUTE.stops ?? []).then((path) => {
      if (active && path && path.length >= 2) setDemoPath(path);
    });
    return () => {
      active = false;
    };
  }, []);

  // Stable identity so the map only re-frames itself when the route changes.
  const mapRoute = useMemo<ManagedRoute>(
    () => (result ? { ...result } : demoPath ? { ...DEMO_ROUTE, pathCoordinates: demoPath } : DEMO_ROUTE),
    [result, demoPath],
  );

  const loadSavedRoutes = useCallback(async () => {
    try {
      const response = await fetch("/api/routes", { cache: "no-store" });
      const payload = (await response.json()) as { routes?: SavedRoutePayload[]; count?: number };
      if (!response.ok) return;
      const routes = payload.routes ?? [];
      setFetchedRoutes(toGhostRoutes(routes));
    } catch {
      // The map still works without logged routes; no user-facing error.
    }
  }, []);

  useEffect(() => {
    void loadSavedRoutes();
  }, [loadSavedRoutes]);

  // Host-supplied routes plus the ones this module fetched, deduplicated.
  const savedRoutes = useMemo<GhostRoute[]>(() => {
    const seen = new Set<string>();
    const merged: GhostRoute[] = [];
    for (const route of [...initialRoutes, ...fetchedRoutes]) {
      const key = route.id ?? `${route.name ?? ""}:${route.coordinates?.[0]?.join(",") ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(route);
    }
    return merged;
  }, [initialRoutes, fetchedRoutes]);

  async function runNormalization(input: string) {
    if (isLoading) return;

    const trimmed = input.trim();
    if (!trimmed) {
      setError("Type an informal route description or paste some coordinates first.");
      textareaRef.current?.focus();
      return;
    }
    if (trimmed.length > MAX_INPUT_LENGTH) {
      setError(`Keep the input under ${MAX_INPUT_LENGTH} characters (currently ${trimmed.length}).`);
      return;
    }

    setRawInput(trimmed);
    setIsLoading(true);
    setError(null);
    setSaveState({ status: "idle", message: "" });

    try {
      const response = await fetch("/api/normalize-route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawInput: trimmed }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const failure = payload as { error?: string; detail?: string } | null;
        const message = [failure?.error, failure?.detail].filter(Boolean).join(" — ");
        throw new Error(message || `Normalization failed (HTTP ${response.status}).`);
      }

      const routeData = payload as NormalizedRouteData;
      setResult(routeData);
      // Hand the normalized route to the host (e.g. to persist in Supabase).
      onRouteNormalized?.(routeData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while normalizing the route.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runNormalization(rawInput);
  }

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (file.size > 200_000) {
      setError("That file is too large — keep coordinate uploads under 200 KB.");
      return;
    }

    try {
      const text = await file.text();
      setRawInput(text.slice(0, MAX_INPUT_LENGTH));
      setFileName(file.name);
      setError(null);
    } catch {
      setError("Could not read that file. Try a plain .txt, .csv, .json or .geojson file.");
    }
  }

  /** Persists the normalized route through POST /api/routes → Supabase. */
  async function handleSaveRoute() {
    if (!result || saveState.status === "saving") return;

    setSaveState({ status: "saving", message: "Saving route…" });

    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routeName: result.routeName,
          vehicleType: result.vehicleType,
          estimatedFare: result.estimatedFare,
          frequency: result.frequency,
          stops: result.stops,
          pathCoordinates: result.pathCoordinates,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { persisted?: boolean; message?: string; error?: string }
        | null;

      if (!response.ok) {
        setSaveState({
          status: "error",
          message: payload?.error ?? `Save failed (HTTP ${response.status}).`,
        });
        return;
      }

      setSaveState({
        status: payload?.persisted ? "saved" : "info",
        message: payload?.message ?? "Route saved.",
      });
      await loadSavedRoutes();
    } catch (requestError) {
      setSaveState({
        status: "error",
        message:
          requestError instanceof Error ? requestError.message : "Could not reach /api/routes.",
      });
    }
  }

  const saveStatusStyles: Record<typeof saveState.status, string> = {
    idle: "",
    saving: "text-cyan-200",
    saved: "text-[#7cf6a0]",
    info: "text-[#ffb86b]",
    error: "text-rose-200",
  };

  return (
    <div
      className={`grid w-full min-w-0 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] ${className}`}
    >
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 min-w-0 flex-col gap-3 rounded-2xl border border-cyan-500/20 bg-[#050b14]/80 p-4"
      >
        <div>
          <label
            htmlFor="raw-route-input"
            className="text-[11px] tracking-[0.2em] text-cyan-300/80 uppercase"
          >
            Route description
          </label>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Tell us where you&apos;re going and how you usually get there — we&apos;ll map the stops, fare
            and street path.
          </p>
        </div>

        <div
          role="group"
          aria-label="Quick Demo Scenarios"
          className="flex flex-wrap items-center gap-1.5"
        >
          <span className="w-full text-[10px] tracking-[0.2em] text-cyan-300/70 uppercase">
            Try a sample route
          </span>
          {DEMO_SCENARIOS.map((scenario) => (
            <button
              key={scenario.label}
              type="button"
              title={scenario.prompt}
              disabled={isLoading}
              onClick={() => {
                // Fill the box so the input matches what is being mapped, then
                // normalize straight away.
                setRawInput(scenario.prompt);
                setFocusStop(null);
                void runNormalization(scenario.prompt);
              }}
              className="rounded-full border border-cyan-500/25 bg-[#03070f] px-2.5 py-1 text-[10px] tracking-[0.04em] text-cyan-200/90 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 disabled:cursor-wait disabled:opacity-50"
            >
              {scenario.label}
            </button>
          ))}
        </div>

        <textarea
          id="raw-route-input"
          ref={textareaRef}
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          spellCheck={false}
          rows={7}
          disabled={isLoading}
          placeholder="Shared auto from Yelahanka to Majestic via Hebbal, about 30 rupees, every 10 mins…"
          className="w-full resize-y rounded-xl border border-cyan-500/20 bg-[#03070f] p-3 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.json,.geojson,text/plain,application/json"
            className="sr-only"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-cyan-500/25 px-3 py-1.5 text-[11px] tracking-wide text-cyan-200/90 transition hover:border-cyan-400/50 hover:bg-cyan-400/10 disabled:opacity-50"
          >
            Upload coordinates
          </button>
          <span className="truncate text-[11px] text-slate-500">{fileName ?? "or upload recorded GPS"}</span>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="relative flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-wait disabled:opacity-80"
        >
          {isLoading ? (
            <>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-200/30 border-t-cyan-200"
              />
              <span className="animate-pulse">Mapping your route…</span>
            </>
          ) : (
            "Normalize Route with Gemini AI"
          )}
        </button>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200"
          >
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="mt-1 space-y-2 rounded-xl border border-cyan-500/15 bg-[#03070f]/80 p-3">
            <p className="text-sm font-semibold text-cyan-50">{result.routeName}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-cyan-400/40 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-medium tracking-wide text-cyan-100">
                {result.vehicleType}
              </span>
              <span className="rounded-full border border-[#7cf6a0]/35 bg-[#7cf6a0]/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-[#c8ffd9]">
                {formatFare(result.estimatedFare)}
              </span>
              <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] tracking-wide text-slate-300">
                {result.frequency}
              </span>
            </div>
            <p className="pt-1 text-[10px] tracking-[0.18em] text-slate-500 uppercase">Stops</p>
            <ol className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
              {result.stops.map((stop, index) => (
                <li key={`${stop.name}-${index}`}>
                  <button
                    type="button"
                    onClick={() => setFocusStop({ lat: stop.lat, lng: stop.lng, key: Date.now() })}
                    title={`Show ${stop.name} on the map`}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-100"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 text-[9px] text-cyan-300">
                      {index + 1}
                    </span>
                    <span className="truncate">{stop.name}</span>
                  </button>
                </li>
              ))}
            </ol>

            <button
              type="button"
              disabled={saveState.status === "saving"}
              onClick={() => {
                void handleSaveRoute();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#7cf6a0]/40 bg-[#7cf6a0]/10 px-3 py-2 text-[11px] font-medium text-[#b9ffd8] transition hover:bg-[#7cf6a0]/20 disabled:cursor-wait disabled:opacity-60"
            >
              {saveState.status === "saving" ? "Saving…" : "Save this route"}
            </button>

            {saveState.message ? (
              <p className={`text-[10px] leading-relaxed ${saveStatusStyles[saveState.status]}`}>
                {saveState.message}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-slate-500">
            Showing the preloaded Yelahanka → Majestic route. Tap a demo scenario or describe a route
            to replace it.
          </p>
        )}
      </form>

      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <p className="text-[11px] text-slate-500">
          Pick a stop in the summary to jump to it on the map.
        </p>

        <div className="relative h-[min(70vh,620px)] min-h-[340px] w-full overflow-hidden rounded-2xl border border-cyan-500/25 shadow-[0_0_40px_-12px_rgba(0,243,255,0.55)]">
          <MapLayerManager
            route={mapRoute}
            focusPoint={focusStop}
            rawCoordinates={rawPoints}
            savedRoutes={savedRoutes}
          />

          {isLoading ? (
            <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-[#03070f]/45 backdrop-blur-[1px]">
              <span className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-[#050b14]/90 px-4 py-2 text-[11px] tracking-[0.2em] text-cyan-200 uppercase animate-pulse">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200/30 border-t-cyan-200"
                />
                Normalizing route
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
