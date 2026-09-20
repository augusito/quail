'use client'

import { useSearchParams } from 'next/navigation'
import React, { useState } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

// §6.2 self-registration form. Reads the invite token from the URL
// (?token=... — the link logged by src/collections/Invites.ts) and posts
// to POST /api/register (src/endpoints/register.ts), which does the real
// validation. This page is a minimal, functional front end for that
// endpoint — not the polished public site; kept intentionally simple like
// the rest of this scaffold.
export default function RegisterPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password, name }),
      })
      const body = await response.json()

      if (!response.ok) {
        setStatus('error')
        setMessage(body?.error ?? 'Registration failed.')
        return
      }

      setStatus('success')
      setMessage(body?.message ?? 'Registration received. Your account is pending admin approval.')
    } catch {
      setStatus('error')
      setMessage('Could not reach the server. Please try again.')
    }
  }

  if (!token) {
    return (
      <main style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem', fontFamily: 'sans-serif', background: '#fff', color: '#111', minHeight: '100vh' }}>
        <h1>Invalid invite link</h1>
        <p>This link is missing an invite token. Ask your program admin for a fresh invite link.</p>
      </main>
    )
  }

  if (status === 'success') {
    return (
      <main style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem', fontFamily: 'sans-serif', background: '#fff', color: '#111', minHeight: '100vh' }}>
        <h1>You&rsquo;re registered</h1>
        <p>{message}</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', padding: '0 1rem', fontFamily: 'sans-serif', background: '#fff', color: '#111', minHeight: '100vh' }}>
      <h1>Register</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Submitting…' : 'Register'}
        </button>
        {status === 'error' && <p style={{ color: 'crimson' }}>{message}</p>}
      </form>
    </main>
  )
}
