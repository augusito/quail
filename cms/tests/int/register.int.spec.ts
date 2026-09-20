// @vitest-environment node
// This spec exercises real login (JWT signing via `jose`) — jsdom's
// polyfills interfere with that the same way they interfered with
// `file-type`'s buffer sniffing in lifecycle.int.spec.ts, so this file
// opts back into the plain Node environment.
import { getPayload, handleEndpoints, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let payloadConfig: Awaited<typeof config>

describe('POST /api/register (§6.2 invite-link self-registration)', () => {
  beforeAll(async () => {
    payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  afterAll(async () => {
    for (const collection of ['enrollments', 'users', 'invites', 'cohorts'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
  })

  // Registration is rate-limited per source IP (src/lib/rateLimit.ts); give
  // each test its own IP via X-Forwarded-For so they don't trip each
  // other's limit. Tests that exercise the limiter itself pass their own.
  let ipCounter = 0
  function nextIp() {
    ipCounter += 1
    return `10.0.0.${ipCounter}`
  }

  async function callRegister(body: unknown, ip: string = nextIp()) {
    const request = new Request('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify(body),
    })
    return handleEndpoints({ config: payloadConfig, request })
  }

  async function callLogin(email: string, password: string) {
    const request = new Request('http://localhost:3000/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return handleEndpoints({ config: payloadConfig, request })
  }

  async function createInvite(overrides: Partial<{ revoked: boolean; expiresAt: string }> = {}) {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name: `Invite Test ${Date.now()}-${Math.random()}`,
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
      },
      overrideAccess: true,
    })
    let invite = await payload.create({
      collection: 'invites',
      data: { cohort: cohort.id, track: 'ict' as const },
      overrideAccess: true,
    })
    if (overrides.revoked !== undefined || overrides.expiresAt !== undefined) {
      invite = await payload.update({
        collection: 'invites',
        id: invite.id,
        data: overrides,
        overrideAccess: true,
      })
    }
    return { cohort, invite }
  }

  it('auto-generates a token and expiry, and logs the invite link (no email integration yet)', async () => {
    const { invite } = await createInvite()
    expect(invite.token).toBeTruthy()
    expect(invite.expiresAt).toBeTruthy()
    expect(new Date(invite.expiresAt!).getTime()).toBeGreaterThan(Date.now())
  })

  it('registers a new intern, auto-enrolls them in the invite’s cohort/track, and leaves them pending approval', async () => {
    const { cohort, invite } = await createInvite()

    const response = await callRegister({
      token: invite.token,
      email: `register-${Date.now()}@test.dev`,
      password: 'test1234',
      name: 'New Intern',
    })
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.userId).toBeDefined()

    const user = await payload.findByID({ collection: 'users', id: body.userId, overrideAccess: true })
    expect(user.role).toBe('intern')
    expect(user.status).toBe('pending')

    const enrollments = await payload.find({
      collection: 'enrollments',
      where: { intern: { equals: user.id } },
      depth: 0,
      overrideAccess: true,
    })
    expect(enrollments.docs).toHaveLength(1)
    expect(enrollments.docs[0].cohort).toBe(cohort.id)
    expect(enrollments.docs[0].track).toBe('ict')
    expect(enrollments.docs[0].outcome).toBe('in-progress')
  })

  it('ignores a client-supplied role/status and never grants anything but pending intern', async () => {
    const { invite } = await createInvite()

    const response = await callRegister({
      token: invite.token,
      email: `escalate-${Date.now()}@test.dev`,
      password: 'test1234',
      role: 'admin',
      status: 'active',
    })
    expect(response.status).toBe(201)
    const body = await response.json()

    const user = await payload.findByID({ collection: 'users', id: body.userId, overrideAccess: true })
    expect(user.role).toBe('intern')
    expect(user.status).toBe('pending')
  })

  it('rejects an unknown token', async () => {
    const response = await callRegister({ token: 'not-a-real-token', email: 'x@test.dev', password: 'test1234' })
    expect(response.status).toBe(404)
  })

  it('rejects a revoked invite', async () => {
    const { invite } = await createInvite({ revoked: true })
    const response = await callRegister({ token: invite.token, email: `revoked-${Date.now()}@test.dev`, password: 'test1234' })
    expect(response.status).toBe(410)
  })

  it('rejects an expired invite', async () => {
    const { invite } = await createInvite({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    const response = await callRegister({ token: invite.token, email: `expired-${Date.now()}@test.dev`, password: 'test1234' })
    expect(response.status).toBe(410)
  })

  it('rejects a request missing required fields', async () => {
    const response = await callRegister({ email: 'missing-token@test.dev', password: 'test1234' })
    expect(response.status).toBe(400)
  })

  it('blocks login while pending, then allows it once admin approves (§6.2 approval flow)', async () => {
    const { invite } = await createInvite()
    const email = `approval-flow-${Date.now()}@test.dev`
    const password = 'test1234'

    const registerResponse = await callRegister({ token: invite.token, email, password })
    expect(registerResponse.status).toBe(201)
    const { userId } = await registerResponse.json()

    const blockedLogin = await callLogin(email, password)
    expect(blockedLogin.status).toBe(403)

    // The admin's approval action — an ordinary Users.update, same as
    // clicking "Active" in the admin UI and saving.
    const approved = await payload.update({
      collection: 'users',
      id: userId,
      data: { status: 'active' },
      overrideAccess: true,
    })
    expect(approved.status).toBe('active')

    const allowedLogin = await callLogin(email, password)
    expect(allowedLogin.status).toBe(200)
  })

  describe('rate limiting (per source IP, 5 requests / 15 min)', () => {
    it('rejects the 6th attempt from the same IP with 429 and a Retry-After header', async () => {
      const ip = '203.0.113.1'
      for (let i = 0; i < 5; i++) {
        const response = await callRegister({ token: 'not-a-real-token', email: 'x@test.dev', password: 'test1234' }, ip)
        expect(response.status).toBe(404) // under the limit: normal invalid-token handling
      }

      const limited = await callRegister({ token: 'not-a-real-token', email: 'x@test.dev', password: 'test1234' }, ip)
      expect(limited.status).toBe(429)
      expect(limited.headers.get('Retry-After')).toBeTruthy()
    })

    it('does not rate-limit a different IP once another is exhausted', async () => {
      const exhaustedIp = '203.0.113.2'
      for (let i = 0; i < 5; i++) {
        await callRegister({ token: 'not-a-real-token', email: 'x@test.dev', password: 'test1234' }, exhaustedIp)
      }
      const limited = await callRegister({ token: 'not-a-real-token', email: 'x@test.dev', password: 'test1234' }, exhaustedIp)
      expect(limited.status).toBe(429)

      const { invite } = await createInvite()
      const otherIp = '203.0.113.3'
      const response = await callRegister(
        { token: invite.token, email: `rate-limit-other-ip-${Date.now()}@test.dev`, password: 'test1234' },
        otherIp,
      )
      expect(response.status).toBe(201)
    })
  })

  it('blocks login for a deactivated (inactive) account', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `inactive-${Date.now()}@test.dev`,
        password: 'test1234',
        role: 'intern' as const,
        status: 'inactive' as const,
      },
      overrideAccess: true,
    })

    const response = await callLogin(user.email, 'test1234')
    expect(response.status).toBe(403)
  })
})
