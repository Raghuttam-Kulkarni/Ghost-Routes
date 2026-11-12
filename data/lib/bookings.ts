import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

export type BookingStatus = 'requested' | 'confirmed' | 'cancelled'

export type Booking = {
  id: string
  user_id: string
  route_id: string
  board_stop_id: string
  alight_stop_id: string
  departure_time: string
  seats: number
  status: BookingStatus
  created_at: string
}

export type NewBooking = Omit<Booking, 'id' | 'status' | 'created_at'>

// A booking is identified to riders by a short code derived from its id, so the
// table keeps exactly the columns the feature asked for.
export function bookingCode(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 10000
  return `GR-${String(hash).padStart(4, '0')}`
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
// RLS is enabled on `bookings` with no anon policies (writes are meant to go
// through this server layer with the service-role key), so the anon key cannot
// insert or update here. Without the service-role key we stay on the local file
// rather than letting every seat request fail at the database.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let warnedAboutKey = false

// Supabase is used whenever the service-role credentials exist; otherwise
// bookings persist to a local JSON file so the demo flow still works.
function supabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    if (SUPABASE_URL && !SUPABASE_SERVICE_KEY && !warnedAboutKey) {
      warnedAboutKey = true
      console.warn(
        '[bookings] SUPABASE_SERVICE_ROLE_KEY is not set, so seat requests use the local .data file. ' +
          'Add the service-role key to store bookings in Supabase (see .env.example).',
      )
    }
    return null
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'bookings.json')

async function readRows(): Promise<Booking[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    return JSON.parse(raw) as Booking[]
  } catch {
    return []
  }
}

async function writeRows(rows: Booking[]) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const temp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(temp, JSON.stringify(rows, null, 2), 'utf8')
  await fs.rename(temp, DATA_FILE)
}

export async function createBooking(input: NewBooking): Promise<Booking> {
  const client = supabase()

  if (client) {
    const { data, error } = await client
      .from('bookings')
      .insert({
        user_id: input.user_id,
        route_id: input.route_id,
        board_stop_id: input.board_stop_id,
        alight_stop_id: input.alight_stop_id,
        departure_time: input.departure_time,
        seats: input.seats,
        status: 'requested',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as Booking
  }

  const booking: Booking = {
    ...input,
    id: randomUUID(),
    status: 'requested',
    created_at: new Date().toISOString(),
  }

  const rows = await readRows()
  rows.push(booking)
  await writeRows(rows)
  return booking
}

export async function listBookings(userId: string): Promise<Booking[]> {
  const client = supabase()

  if (client) {
    const { data, error } = await client
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('departure_time', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as Booking[]
  }

  const rows = await readRows()
  return rows
    .filter((row) => row.user_id === userId)
    .sort((a, b) => a.departure_time.localeCompare(b.departure_time))
}

export async function getBooking(userId: string, id: string): Promise<Booking | null> {
  const client = supabase()

  if (client) {
    const { data, error } = await client
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as Booking | null) ?? null
  }

  const rows = await readRows()
  return rows.find((row) => row.id === id && row.user_id === userId) ?? null
}

export async function setBookingStatus(
  userId: string,
  id: string,
  status: BookingStatus,
): Promise<Booking | null> {
  const client = supabase()

  if (client) {
    const { data, error } = await client
      .from('bookings')
      .update({ status })
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return (data as Booking | null) ?? null
  }

  const rows = await readRows()
  const index = rows.findIndex((row) => row.id === id && row.user_id === userId)
  if (index === -1) return null

  rows[index] = { ...rows[index], status }
  await writeRows(rows)
  return rows[index]
}
