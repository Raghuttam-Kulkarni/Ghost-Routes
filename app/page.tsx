import RouteExplorer from '@/components/RouteExplorer';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-ghost-spirit/80">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ghost-spirit shadow-[0_0_12px_rgba(94,234,212,0.9)]" />
            Field notes from the in-between
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Ghost<span className="text-ghost-haze">-</span>Routes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Name an origin and a destination, add what happened on the way, and the route is drawn on
            the map for everyone who comes after.
          </p>
        </div>
        <div className="hidden items-center gap-5 rounded-xl border border-white/10 bg-ghost-panel/70 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-400 sm:flex">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ghost-spirit" /> Origin
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-ghost-haze" /> Destination
          </span>
        </div>
      </header>

      <RouteExplorer />

      <footer className="pb-2 text-[11px] text-slate-600">
        Tiles by CARTO · geocoding by OpenStreetMap Nominatim · data stored in Supabase
      </footer>
    </main>
  );
}
