import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signInAction } from '@/app/actions'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/'

  const session = await getSession()
  if (session) redirect(next)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text transition-colors hover:text-text"
        >
          ← Ghost Routes
        </Link>

        <h1 className="mt-4 font-sans text-xl font-medium tracking-tight text-text">
          Sign in to request a seat
        </h1>
        <p className="mt-2 font-sans text-sm text-muted-text">
          Browsing, search and reports stay open to everyone. Only seat requests need an account.
        </p>

        <form action={signInAction} className="mt-5">
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-route-solid bg-route-solid/15 font-sans text-sm text-route-solid transition-colors hover:bg-route-solid/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-solid"
          >
            Continue
          </button>
        </form>

        <p className="mt-3 font-sans text-[11px] text-muted-text">
          Demo sign-in: creates an anonymous account in this browser. No name, phone or email is
          collected.
        </p>
      </div>
    </main>
  )
}
