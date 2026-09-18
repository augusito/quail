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

  async function callRegister(body: unknown) {
    const request = new Request('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
})
