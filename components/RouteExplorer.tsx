'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { distanceKm, formatKm, plottedPoints } from '@/lib/geo';
import type { Route } from '@/lib/types';

const RouteMap = dynamic(() => import('./RouteMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-slate-500">Charting the map…</div>
  ),
});

type Notice = { kind: 'config' | 'error'; message: string } | null;

const EMPTY_FORM = { origin: '', destination: '', description: '' };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function RouteExplorer() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/routes', { cache: 'no-store' });
        const json = await readJson(response);

        if (!response.ok) {
          if (!cancelled) {
            setNotice({
              kind: response.status === 503 ? 'config' : 'error',
              message: typeof json.error === 'string' ? json.error : 'Could not load routes.',
            });
          }
          return;
        }

        if (!cancelled) {
          setRoutes((json.routes as Route[] | undefined) ?? []);
        }
      } catch {
        if (!cancelled) {
          setNotice({ kind: 'error', message: 'Could not reach the routes API.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const plottedCount = useMemo(
    () => routes.filter((route) => plottedPoints(route) !== null).length,
    [routes],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await readJson(response);

      if (!response.ok) {
        setNotice({
          kind: response.status === 503 ? 'config' : 'error',
          message: typeof json.error === 'string' ? json.error : 'Could not save that route.',
        });
        return;
      }

      const created = json.route as Route | undefined;
      if (created) {
        setRoutes((current) => [created, ...current]);
        setSelectedId(created.id);
        setForm(EMPTY_FORM);
      }
    } catch {
      setNotice({ kind: 'error', message: 'Could not reach the routes API.' });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRoute = routes.find((route) => route.id === selectedId) ?? null;

  return (
    <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="relative h-[58vh] min-h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0a12] shadow-[0_30px_90px_-50px_rgba(0,0,0,1)] lg:h-[calc(100vh-13rem)]">
        <RouteMap routes={routes} selectedId={selectedId} onSelect={setSelectedId} />

        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em]">
          <span className="rounded-md border border-white/10 bg-black/55 px-2 py-1 text-slate-300 backdrop-blur">
            {routes.length} {routes.length === 1 ? 'route' : 'routes'} logged
          </span>
          {routes.length > plottedCount && (
            <span className="rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-amber-200/90 backdrop-blur">
              {routes.length - plottedCount} unlocated
            </span>
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4 lg:h-[calc(100vh-13rem)]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-ghost-panel/80 p-4 shadow-halo backdrop-blur"
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Log a new route
          </h2>

          <div className="grid gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ghost-spirit/80">
                Origin
              </span>
              <input
                required
                maxLength={120}
                value={form.origin}
                onChange={(event) => setForm({ ...form, origin: event.target.value })}
                placeholder="e.g. Lisbon, Portugal"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ghost-haze/60 focus:outline-none focus:ring-2 focus:ring-ghost-haze/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ghost-haze/90">
                Destination
              </span>
              <input
                required
                maxLength={120}
                value={form.destination}
                onChange={(event) => setForm({ ...form, destination: event.target.value })}
                placeholder="e.g. Porto, Portugal"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ghost-haze/60 focus:outline-none focus:ring-2 focus:ring-ghost-haze/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-slate-500">
                What happened
              </span>
              <textarea
                rows={3}
                maxLength={600}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="The bus that was not on the timetable, the road that only appears after midnight…"
                className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ghost-haze/60 focus:outline-none focus:ring-2 focus:ring-ghost-haze/20"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full rounded-lg bg-ghost-haze px-4 py-2.5 text-sm font-semibold text-[#120d20] transition hover:bg-[#b9a6ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Placing on the map…' : 'Log this route'}
          </button>

          {notice && (
            <p
              className={
                notice.kind === 'config'
                  ? 'mt-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100'
                  : 'mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-200'
              }
            >
              {notice.message}
            </p>
          )}
        </form>

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-ghost-panel/60">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {selectedRoute ? 'Selected route' : 'Recent sightings'}
            </h2>
            {selectedRoute && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-[11px] text-ghost-haze/80 underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {loading && <p className="px-1 py-6 text-center text-xs text-slate-500">Loading routes…</p>}

            {!loading && routes.length === 0 && !notice && (
              <p className="px-2 py-8 text-center text-xs leading-relaxed text-slate-500">
                Nothing logged yet. Add the first origin and destination — the map is listening.
              </p>
            )}

            {routes.map((route) => {
              const points = plottedPoints(route);
              const isSelected = route.id === selectedId;

              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : route.id)}
                  className={
                    isSelected
                      ? 'block w-full rounded-xl border border-ghost-haze/50 bg-ghost-haze/10 p-3 text-left transition'
                      : 'block w-full rounded-xl border border-white/5 bg-black/25 p-3 text-left transition hover:border-white/15 hover:bg-black/40'
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">
                      <span className="text-ghost-spirit">{route.origin}</span>
                      <span className="mx-1.5 text-slate-600">→</span>
                      <span className="text-ghost-haze">{route.destination}</span>
                    </p>
                    {!points && (
                      <span className="shrink-0 rounded border border-amber-300/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-200/80">
                        unlocated
                      </span>
                    )}
                  </div>

                  {route.description && (
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-400">
                      {route.description}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <span>{new Date(route.created_at).toLocaleDateString()}</span>
                    {points && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span>{formatKm(distanceKm(points.origin, points.destination))}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
