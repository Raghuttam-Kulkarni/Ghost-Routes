import { getBooking, setBookingStatus } from '@/lib/bookings'
import { getSession } from '@/lib/session'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Sign in first.' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const action = body?.action

  if (action !== 'confirm' && action !== 'cancel') {
    return Response.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const booking = await getBooking(session.userId, id)
  if (!booking) {
    return Response.json({ error: 'Booking not found.' }, { status: 404 })
  }

  if (booking.status === 'cancelled') {
    return Response.json({ error: 'This booking is already cancelled.' }, { status: 409 })
  }

  if (action === 'cancel' && new Date(booking.departure_time).getTime() < Date.now()) {
    return Response.json({ error: 'Past bookings cannot be cancelled.' }, { status: 409 })
  }

  const updated = await setBookingStatus(
    session.userId,
    id,
    action === 'confirm' ? 'confirmed' : 'cancelled',
  )

  return Response.json({ booking: updated })
}
