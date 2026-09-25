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

describe('/api/register (§6.2 invite-link self-registration, proposal v2)', () => {
  beforeAll(async () => {
    payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  afterAll(async () => {
    for (const collection of ['enrollments', 'education', 'interns', 'trainers', 'contracts', 'users', 'invites', 'cohorts'] as const) {
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

  async function callLookup(token: string, ip: string = nextIp()) {
    const request = new Request(`http://localhost:3000/api/register?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'X-Forwarded-For': ip },
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

  async function createInvite(
    role: 'intern' | 'trainer' = 'intern',
    overrides: Partial<{ email: string; expiresAt: string; status: 'expired' | 'revoked' | 'sent' | 'used' }> = {},
  ) {
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
    const inviteData: {
      cohort: number
      email: string
      role: 'intern' | 'trainer'
      status: 'sent'
      track?: 'business-management' | 'ict' | 'mechanics' | 'supply-chain' | 'truck-driving'
    } = {
      cohort: cohort.id,
      role,
      email: overrides.email ?? `invite-${Date.now()}-${Math.random()}@test.dev`,
      status: 'sent',
      track: role === 'intern' ? 'ict' : undefined,
    }
    let invite = await payload.create({
      collection: 'invites',
      data: inviteData,
      overrideAccess: true,
    })
    if (overrides.status !== undefined || overrides.expiresAt !== undefined) {
      invite = await payload.update({
        collection: 'invites',
        id: invite.id,
        data: { status: overrides.status, expiresAt: overrides.expiresAt },
        overrideAccess: true,
      })
    }
    return { cohort, invite }
  }

  function internBody(overrides: Record<string, unknown> = {}) {
    return {
      password: 'test1234',
      name: 'New Intern',
      dateOfBirth: '2000-01-01',
      gender: 'female',
      nationality: 'Kenyan',
      phone: '0700000000',
      nationalIdNumber: '12345678',
      kraPin: 'A123456789Z',
      shifNumber: 'SHIF123',
      nssfNumber: 'NSSF123',
      nextOfKin: { name: 'Next Kin', relationship: 'Sister', phone: '0711111111' },
      ...overrides,
    }
  }

  function trainerBody(overrides: Record<string, unknown> = {}) {
    return {
      password: 'test1234',
      name: 'New Trainer',
      occupation: 'Driving Instructor',
      phone: '0700000001',
      nationalIdNumber: '87654321',
      kraPin: 'B987654321Z',
      ...overrides,
    }
  }

  it('auto-generates a token and expiry, and logs the invite link (no email integration yet)', async () => {
    const { invite } = await createInvite()
    expect(invite.token).toBeTruthy()
    expect(invite.expiresAt).toBeTruthy()
    expect(new Date(invite.expiresAt!).getTime()).toBeGreaterThan(Date.now())
    expect(invite.status).toBe('sent')
  })

  describe('GET /api/register?token= (invite lookup)', () => {
    it('returns role/email/cohort/track for a valid invite', async () => {
      const { cohort, invite } = await createInvite('intern')
      const response = await callLookup(invite.token!)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toMatchObject({ role: 'intern', email: invite.email, track: 'ict', cohortName: cohort.name })
    })

    it('rejects an unknown token', async () => {
      const response = await callLookup('not-a-real-token')
      expect(response.status).toBe(404)
    })

    it('rejects a revoked invite', async () => {
      const { invite } = await createInvite('intern', { status: 'revoked' })
      const response = await callLookup(invite.token!)
      expect(response.status).toBe(410)
    })
  })

  describe('intern registration', () => {
    it('registers a new intern, creates their profile + education history, auto-enrolls them, and leaves them pending', async () => {
      const { cohort, invite } = await createInvite('intern')

      const response = await callRegister({
        token: invite.token,
        ...internBody({ education: [{ school: 'Nairobi Girls', qualification: 'KCSE', startDate: '2016-01-01', endDate: '2019-11-01' }] }),
      })
      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.userId).toBeDefined()

      const user = await payload.findByID({ collection: 'users', id: body.userId, overrideAccess: true })
      expect(user.role).toBe('intern')
      expect(user.status).toBe('pending')
      expect(user.email).toBe(invite.email)

      const { docs: internProfiles } = await payload.find({
        collection: 'interns',
        where: { user: { equals: user.id } },
        overrideAccess: true,
      })
      expect(internProfiles).toHaveLength(1)
      expect(internProfiles[0]).toMatchObject({
        name: 'New Intern',
        gender: 'female',
        nationality: 'Kenyan',
        nationalIdNumber: '12345678',
        shifNumber: 'SHIF123',
        nssfNumber: 'NSSF123',
      })
      expect(internProfiles[0].nextOfKin).toMatchObject({ name: 'Next Kin', relationship: 'Sister', phone: '0711111111' })

      const { docs: education } = await payload.find({
        collection: 'education',
        where: { intern: { equals: internProfiles[0].id } },
        overrideAccess: true,
      })
      expect(education).toHaveLength(1)
      expect(education[0]).toMatchObject({ school: 'Nairobi Girls', qualification: 'KCSE' })

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

      const usedInvite = await payload.findByID({ collection: 'invites', id: invite.id, overrideAccess: true })
      expect(usedInvite.status).toBe('used')
    })

    it('rejects a request missing required intern fields', async () => {
      const { invite } = await createInvite('intern')
      const { dateOfBirth: _omit, ...incomplete } = internBody()
      const response = await callRegister({ token: invite.token, ...incomplete })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/dateOfBirth/)
    })

    it('rejects a request missing a required next-of-kin field', async () => {
      const { invite } = await createInvite('intern')
      const response = await callRegister({
        token: invite.token,
        ...internBody({ nextOfKin: { name: 'Next Kin' } }),
      })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/nextOfKin/)
    })
  })

  describe('trainer registration', () => {
    it('registers a new trainer, creates their profile, and associates them with the cohort via a Draft contract', async () => {
      const { cohort, invite } = await createInvite('trainer')

      const response = await callRegister({ token: invite.token, ...trainerBody() })
      expect(response.status).toBe(201)
      const { userId } = await response.json()

      const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
      expect(user.role).toBe('trainer')
      expect(user.status).toBe('pending')
      expect(user.email).toBe(invite.email)

      const { docs: trainerProfiles } = await payload.find({
        collection: 'trainers',
        where: { user: { equals: user.id } },
        overrideAccess: true,
      })
      expect(trainerProfiles).toHaveLength(1)
      expect(trainerProfiles[0]).toMatchObject({ name: 'New Trainer', occupation: 'Driving Instructor' })

      const { docs: contracts } = await payload.find({
        collection: 'contracts',
        where: { trainer: { equals: user.id } },
        overrideAccess: true,
      })
      expect(contracts).toHaveLength(1)
      expect(contracts[0].status).toBe('draft')
      expect(typeof contracts[0].cohort === 'object' ? contracts[0].cohort.id : contracts[0].cohort).toBe(cohort.id)
    })

    it('rejects a request missing required trainer fields', async () => {
      const { invite } = await createInvite('trainer')
      const { occupation: _omit, ...incomplete } = trainerBody()
      const response = await callRegister({ token: invite.token, ...incomplete })
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toMatch(/occupation/)
    })
  })

  it('ignores a client-supplied email/role/status — the account always uses the invite\'s own email and role', async () => {
    const { invite } = await createInvite('intern')

    const response = await callRegister({
      token: invite.token,
      ...internBody({ email: 'escalate@test.dev', role: 'admin', status: 'active' }),
    })
    expect(response.status).toBe(201)
    const body = await response.json()

    const user = await payload.findByID({ collection: 'users', id: body.userId, overrideAccess: true })
    expect(user.email).toBe(invite.email)
    expect(user.role).toBe('intern')
    expect(user.status).toBe('pending')
  })

  it('rejects an unknown token', async () => {
    const response = await callRegister({ token: 'not-a-real-token', ...internBody() })
    expect(response.status).toBe(404)
  })

  it('rejects a revoked invite', async () => {
    const { invite } = await createInvite('intern', { status: 'revoked' })
    const response = await callRegister({ token: invite.token, ...internBody() })
    expect(response.status).toBe(410)
  })

  it('rejects an expired invite, and flips its status to expired', async () => {
    const { invite } = await createInvite('intern', { expiresAt: new Date(Date.now() - 1000).toISOString() })
    const response = await callRegister({ token: invite.token, ...internBody() })
    expect(response.status).toBe(410)

    const updated = await payload.findByID({ collection: 'invites', id: invite.id, overrideAccess: true })
    expect(updated.status).toBe('expired')
  })

  it('rejects a second registration attempt with an already-used invite', async () => {
    const { invite } = await createInvite('intern')
    const first = await callRegister({ token: invite.token, ...internBody() })
    expect(first.status).toBe(201)

    const second = await callRegister({ token: invite.token, ...internBody({ name: 'Someone Else' }) })
    expect(second.status).toBe(410)
  })

  it('rejects a request missing token/password', async () => {
    const response = await callRegister({ name: 'Missing Token' })
    expect(response.status).toBe(400)
  })

  it('blocks login while pending, then allows it once admin approves (§6.2 approval flow)', async () => {
    const { invite } = await createInvite('intern')

    const registerResponse = await callRegister({ token: invite.token, ...internBody() })
    expect(registerResponse.status).toBe(201)
    const { userId } = await registerResponse.json()

    const blockedLogin = await callLogin(invite.email, 'test1234')
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

    const allowedLogin = await callLogin(invite.email, 'test1234')
    expect(allowedLogin.status).toBe(200)
  })

  describe('rate limiting (per source IP, 5 requests / 15 min)', () => {
    it('rejects the 6th attempt from the same IP with 429 and a Retry-After header', async () => {
      const ip = '203.0.113.1'
      for (let i = 0; i < 5; i++) {
        const response = await callRegister({ token: 'not-a-real-token', ...internBody() }, ip)
        expect(response.status).toBe(404) // under the limit: normal invalid-token handling
      }

      const limited = await callRegister({ token: 'not-a-real-token', ...internBody() }, ip)
      expect(limited.status).toBe(429)
      expect(limited.headers.get('Retry-After')).toBeTruthy()
    })

    it('does not rate-limit a different IP once another is exhausted', async () => {
      const exhaustedIp = '203.0.113.2'
      for (let i = 0; i < 5; i++) {
        await callRegister({ token: 'not-a-real-token', ...internBody() }, exhaustedIp)
      }
      const limited = await callRegister({ token: 'not-a-real-token', ...internBody() }, exhaustedIp)
      expect(limited.status).toBe(429)

      const { invite } = await createInvite('intern')
      const otherIp = '203.0.113.3'
      const response = await callRegister({ token: invite.token, ...internBody() }, otherIp)
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
