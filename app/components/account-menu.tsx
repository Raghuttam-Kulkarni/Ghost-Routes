'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CircleUser, HelpCircle, LogOut, Ticket } from 'lucide-react'
import { signOutAction } from '@/app/actions'
import { openTour } from '@/components/tour'

// Always visible so the tour can be replayed signed in or out.
function HowItWorksButton() {
  return (
    <button
      type="button"
      onClick={() => openTour()}
      aria-label="How it works"
      title="How it works"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text transition-colors hover:bg-card hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
    >
      <HelpCircle className="size-3" aria-hidden="true" />
      How it works
    </button>
  )
}

export function AccountMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const triggerClass =
    'inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-text transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid'

  if (!signedIn) {
    return (
      <div className="flex items-center gap-2">
        <HowItWorksButton />
        <Link href="/login" aria-label="Sign in" title="Sign in" className={triggerClass}>
          <CircleUser className="size-4" aria-hidden="true" />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <HowItWorksButton />
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label="Account menu"
          aria-expanded={open}
          aria-haspopup="menu"
          className={triggerClass}
        >
          <CircleUser className="size-4" aria-hidden="true" />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-[1300] mt-2 w-44 overflow-hidden rounded-md border border-line bg-surface py-1"
          >
            <Link
              href="/bookings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 font-sans text-sm text-text transition-colors hover:bg-card"
            >
              <Ticket className="size-3.5 text-muted-text" aria-hidden="true" />
              My bookings
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-sm text-muted-text transition-colors hover:bg-card hover:text-text"
              >
                <LogOut className="size-3.5" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}
