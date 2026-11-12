'use client'

import dynamic from 'next/dynamic'
import type { GhostRoute } from '@/lib/routes'

const GhostMap = dynamic(() => import('@/components/ghost-map'), {
  ssr: false,
  loading: () => <div className="size-full bg-bg" aria-hidden="true" />,
})

export function MapLoader({ routes, signedIn }: { routes: GhostRoute[]; signedIn: boolean }) {
  return <GhostMap routes={routes} signedIn={signedIn} />
}
