'use server'

import { redirect } from 'next/navigation'
import { createSession, destroySession } from '@/lib/session'

function safeNext(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/'
}

export async function signInAction(formData: FormData) {
  const next = safeNext(formData.get('next'))
  await createSession()
  redirect(next)
}

export async function signOutAction() {
  await destroySession()
  redirect('/')
}
