import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  graduatedIntern: User
  resignedIntern: User
}

let seeded: Seeded

describe('Public Talent Board access (§6.9, §6.1 graduate-only eligibility)', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, graduatedIntern, resignedIntern] = await Promise.all([
      payload.create({
        collection: 'users',
        data: { email: 'tb-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'tb-graduate@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'tb-resigned@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      }),
    ])
    seeded = { admin, graduatedIntern, resignedIntern }

    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Talent Board Test Cohort',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'closed' as const,
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: graduatedIntern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'graduated' as const },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: resignedIntern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'resigned' as const },
      overrideAccess: true,
    })

    await payload.create({
      collection: 'alumnae',
      data: { intern: graduatedIntern.id, name: 'Graduated Alum', optedIn: true },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'alumnae',
      data: { intern: resignedIntern.id, name: 'Resigned Alum', optedIn: true },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    for (const collection of ['alumnae', 'enrollments', 'cohorts'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  it('the public Talent Board (unauthenticated) shows a graduated, opted-in alum', async () => {
    const { docs } = await payload.find({
      collection: 'alumnae',
      overrideAccess: false,
      user: null,
    })
    const names = docs.map((d) => d.name)
    expect(names).toContain('Graduated Alum')
  })

  it("the public Talent Board never shows a resigned (non-completing) alum, even if opted in", async () => {
    const { docs } = await payload.find({
      collection: 'alumnae',
      overrideAccess: false,
      user: null,
    })
    const names = docs.map((d) => d.name)
    expect(names).not.toContain('Resigned Alum')
  })

  it('a resigned alum can still read their own profile (Alumni Hub access, §6.10) even though the public board hides it', async () => {
    const { docs } = await payload.find({
      collection: 'alumnae',
      where: { intern: { equals: seeded.resignedIntern.id } },
      overrideAccess: false,
      user: seeded.resignedIntern,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0].name).toBe('Resigned Alum')
  })

  it('admin sees every profile regardless of opt-in or graduation status', async () => {
    const { docs } = await payload.find({
      collection: 'alumnae',
      overrideAccess: false,
      user: seeded.admin,
    })
    const names = docs.map((d) => d.name)
    expect(names).toEqual(expect.arrayContaining(['Graduated Alum', 'Resigned Alum']))
  })
})
