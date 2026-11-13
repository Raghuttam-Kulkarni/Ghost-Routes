"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

/**
 * Standalone harness for the AI + Maps module: `/ai-maps-preview`.
 * Nothing here is part of the product UI — it exists so the module can be
 * exercised on its own while the main frontend is being built separately.
 */
const GhostRouteMapper = dynamic(() => import("@/components/ai-maps/GhostRouteMapper"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] w-full items-center justify-center rounded-2xl border border-cyan-500/20 bg-[#050b14]">
      <span className="animate-pulse text-xs tracking-[0.3em] text-cyan-300/80 uppercase">
        Loading AI + Maps…
      </span>
    </div>
  ),
});

export default function AiMapsPreviewPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] tracking-[0.35em] text-cyan-400/70 uppercase">
            Ghost Routes · module preview
          </p>
          <Link
            href="/"
            className="rounded-full border border-cyan-500/25 px-3 py-1 text-[10px] tracking-[0.12em] text-cyan-200/80 uppercase transition hover:border-cyan-400/50 hover:bg-cyan-400/10"
          >
            Back to app
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-cyan-50 sm:text-3xl">
          AI + Maps module harness
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Developer view of <code className="text-cyan-200/90">components/ai-maps/GhostRouteMapper</code>{" "}
          on its own, with no host page chrome. The same component is embedded on the home page inside{" "}
          <code className="text-cyan-200/90">#map-workspace</code>.
        </p>
      </header>

      <GhostRouteMapper />
    </main>
  );
}
