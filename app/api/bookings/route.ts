import { getRoutes } from '@/lib/routes'
import { bookingCode, createBooking } from '@/lib/bookings'
import { getSession } from '@/lib/session'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return Response.json({ error: 'Sign in to request a seat.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { routeId, boardStopId, alightStopId, departureTime, seats } = body

  if (
    typeof routeId !== 'string' ||
    typeof boardStopId !== 'string' ||
    typeof alightStopId !== 'string' ||
    typeof departureTime !== 'string'
  ) {
    return Response.json({ error: 'Missing booking details.' }, { status: 400 })
  }

  if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1 || seats > 4) {
    return Response.json({ error: 'Choose between 1 and 4 seats.' }, { status: 400 })
  }

  const route = getRoutes().find((entry) => entry.id === routeId)
  if (!route) {
    return Response.json({ error: 'That route no longer exists.' }, { status: 404 })
  }

  const boardIndex = route.stops.findIndex((stop) => stop.id === boardStopId)
  const alightIndex = route.stops.findIndex((stop) => stop.id === alightStopId)

  if (boardIndex === -1 || alightIndex === -1) {
    return Response.json({ error: 'Those stops are not on this route.' }, { status: 400 })
  }

  if (alightIndex <= boardIndex) {
    return Response.json(
      { error: 'Choose a drop-off after the boarding stop.' },
      { status: 400 },
    )
  }

  const departure = new Date(departureTime)
  if (Number.isNaN(departure.getTime()) || departure.getTime() <= Date.now()) {
    return Response.json({ error: 'That departure has already left.' }, { status: 400 })
  }

  const booking = await createBooking({
    user_id: session.userId,
    route_id: route.id,
    board_stop_id: boardStopId,
    alight_stop_id: alightStopId,
    departure_time: departure.toISOString(),
    seats,
  })

  return Response.json({ booking, code: bookingCode(booking.id) }, { status: 201 })
}
