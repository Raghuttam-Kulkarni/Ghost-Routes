"use client";

import dynamic from "next/dynamic";

/**
 * The AI + Maps module is embeddable: the page owns the shell (header, nav,
 * spacing) and the module lives inside `#map-workspace`, so a different
 * frontend can mount the same component without inheriting this layout.
 *
 * Leaflet touches `window`/`document` at import time, so the module is loaded
 * client-only; `ssr: false` keeps it out of server rendering and the
 * prerendered HTML, which is what avoids hydration mismatches.
 */
const GhostRouteMapper = dynamic(() => import("@/components/ai-maps/GhostRouteMapper"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center rounded-2xl border border-cyan-500/20 bg-[#050b14]">
      <span className="animate-pulse text-xs tracking-[0.3em] text-cyan-300/80 uppercase">
        Loading ghost routes…
      </span>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex shrink-0 flex-col gap-2">
        <p className="text-[11px] tracking-[0.35em] text-cyan-400/70 uppercase">Ghost Routes</p>
        <h1 className="text-2xl font-semibold text-cyan-50 sm:text-3xl">
          Discover &amp; Map Local Routes
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Describe a shared auto, minibus, or local transit route in plain words—we&apos;ll map the exact
          stops, fare, and street path.
        </p>
      </header>

      <section id="map-workspace" className="w-full">
        <GhostRouteMapper />
      </section>
    </main>
  );
}
