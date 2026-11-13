import { AccountMenu } from '@/components/account-menu'
import { AiRoutePanel } from '@/components/ai-maps/ai-route-panel'
import { MapLoader } from '@/components/map-loader'
import { ThemeToggle } from '@/components/theme-toggle'
import { getRoutes } from '@/lib/routes'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const routes = getRoutes()
  const session = await getSession()

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <div className="fixed inset-0 z-0">
        <MapLoader routes={routes} signedIn={Boolean(session)} />
      </div>

      <div className="fixed right-4 top-4 z-[1100] flex flex-col items-end gap-2 md:right-6 md:top-6">
        <ThemeToggle />
        <AccountMenu signedIn={Boolean(session)} />
      </div>

      {/* AI + Maps lives in its own sheet so it never restyles the map shell. */}
      <div className="pointer-events-none fixed bottom-14 left-3 z-[1090] md:bottom-16">
        <AiRoutePanel />
      </div>
    </main>
  )
}
