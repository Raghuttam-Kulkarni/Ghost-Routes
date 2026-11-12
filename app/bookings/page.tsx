import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccountMenu } from '@/components/account-menu'
import { CancelBookingButton } from '@/components/cancel-booking-button'
import { bookingCode, listBookings, type Booking, type BookingStatus } from '@/lib/bookings'
import { formatDeparture } from '@/lib/datetime'
import { getRoutes } from '@/lib/routes'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<BookingStatus, string> = {
  requested: 'border-route-flicker text-route-flicker',
  confirmed: 'border-route-solid text-route-solid',
  cancelled: 'border-line text-muted-text',
}

function BookingCard({ booking }: { booking: Booking }) {
  const route = getRoutes().find((entry) => entry.id === booking.route_id)
  const board = route?.stops.find((stop) => stop.id === booking.board_stop_id)
  const alight = route?.stops.find((stop) => stop.id === booking.alight_stop_id)
  const upcoming = new Date(booking.departure_time).getTime() > Date.now()

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-medium text-text">
            {route?.name ?? booking.route_id}
          </p>
          <p className="mt-0.5 truncate font-sans text-xs text-muted-text">
            {board?.name ?? booking.board_stop_id} to {alight?.name ?? booking.alight_stop_id}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STATUS_STYLES[booking.status]}`}
        >
          {booking.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-text">
          {formatDeparture(booking.departure_time)} · {booking.seats} seat
          {booking.seats === 1 ? '' : 's'} · {bookingCode(booking.id)}
        </p>
        {upcoming && booking.status !== 'cancelled' ? (
          <CancelBookingButton id={booking.id} />
        ) : null}
      </div>
    </li>
  )
}

export default async function BookingsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/bookings')

  const bookings = await listBookings(session.userId)
  const now = Date.now()
  const upcoming = bookings.filter(
    (booking) => new Date(booking.departure_time).getTime() >= now,
  )
  const past = bookings.filter((booking) => new Date(booking.departure_time).getTime() < now)

  return (
    <main className="min-h-dvh bg-bg px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text transition-colors hover:text-text"
            >
              ← Ghost Routes
            </Link>
            <h1 className="mt-2 font-sans text-2xl font-medium tracking-tight text-text">
              My bookings
            </h1>
          </div>
          <AccountMenu signedIn />
        </header>

        {bookings.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface p-4 font-sans text-sm text-muted-text">
            No bookings yet. Open a route on the map and request a seat.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
                Upcoming
              </h2>
              {upcoming.length === 0 ? (
                <p className="font-sans text-sm text-muted-text">Nothing coming up.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {upcoming.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-text">
                Past
              </h2>
              {past.length === 0 ? (
                <p className="font-sans text-sm text-muted-text">No past bookings.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {past.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
