import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'

// Demo identity: no name, phone or email is collected, only an opaque id.
// Swap these helpers for Supabase Auth (or another provider) and every caller
// keeps working, since they only ever see `{ userId }`.
const SESSION_COOKIE = 'gr_session'
const SESSION_DAYS = 30

export type Session = { userId: string }

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const userId = store.get(SESSION_COOKIE)?.value
  return userId ? { userId } : null
}

export async function createSession(): Promise<Session> {
  const userId = `demo_${randomUUID()}`
  const store = await cookies()
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  })
  return { userId }
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
