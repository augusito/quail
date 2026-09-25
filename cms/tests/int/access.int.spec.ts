import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  trainerA: User
  trainerB: User
  internA: User
  internB: User
  supervisorA: User
}

let seeded: Seeded

describe('Access control (§4 permissions matrix)', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, trainerA, trainerB, internA, internB, supervisorA] = await Promise.all([
      payload.create({ collection: 'users', data: { email: 'admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'trainerA@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'trainerB@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'internA@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'internB@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'supervisorA@test.dev', password: 'test1234', role: 'supervisor' as const, status: 'active' as const } }),
    ])
    seeded = { admin, trainerA, trainerB, internA, internB, supervisorA }
  })

  afterAll(async () => {
    // Delete in FK-safe order: documents that reference users/cohorts/modules
    // before the users/cohorts/modules themselves.
    for (const collection of [
      'scores',
      'logbooks',
      'sessions',
      'enrollments',
      'modules',
      'cohorts',
    ] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  it('a public/unauthenticated request cannot create a cohort', async () => {
    await expect(
      payload.create({
        collection: 'cohorts',
        data: { name: 'Unauthorized Cohort', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
        overrideAccess: false,
        user: null,
      }),
    ).rejects.toThrow()
  })

  it('a public/unauthenticated request cannot create a user directly (must go through /api/register)', async () => {
    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'direct-signup@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
        overrideAccess: false,
        user: null,
      }),
    ).rejects.toThrow()
  })

  it('a non-admin cannot self-assign the admin role via update', async () => {
    const self = await payload.create({
      collection: 'users',
      data: { email: 'selfpromote@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'users',
      id: self.id,
      // Attempted privilege escalation — role/status field access
      // (admin-only write) should silently drop these and keep the
      // original values.
      data: { role: 'admin' as const, status: 'inactive' as const },
      overrideAccess: false,
      user: self,
    })
    expect(updated.role).toBe('intern')
    expect(updated.status).toBe('active')

    await payload.delete({ collection: 'users', id: self.id, overrideAccess: true })
  })

  it('a trainer can only create a Score for a module they run', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'Cohort A', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    const moduleA = await payload.create({ collection: 'modules', data: { track: 'ict', name: 'Module A' }, overrideAccess: true })
    const moduleB = await payload.create({ collection: 'modules', data: { track: 'ict', name: 'Module B' }, overrideAccess: true })
    await payload.create({
      collection: 'sessions',
      data: { module: moduleA.id, trainer: seeded.trainerA.id, cohort: cohort.id, scheduledDate: '2026-02-01', status: 'scheduled' as const },
      overrideAccess: true,
    })

    // Own module: allowed
    const ownScore = await payload.create({
      collection: 'scores',
      data: { intern: seeded.internA.id, module: moduleA.id, value: 90 },
      overrideAccess: false,
      user: seeded.trainerA,
    })
    expect(ownScore.id).toBeDefined()

    // Someone else's module: denied
    await expect(
      payload.create({
        collection: 'scores',
        data: { intern: seeded.internA.id, module: moduleB.id, value: 50 },
        overrideAccess: false,
        user: seeded.trainerA,
      }),
    ).rejects.toThrow()
  })

  it('an intern cannot read an unfinalized score, and never another intern’s score', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'Cohort B', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    const trainingModule = await payload.create({ collection: 'modules', data: { track: 'ict', name: 'Module C' }, overrideAccess: true })
    await payload.create({
      collection: 'sessions',
      data: { module: trainingModule.id, trainer: seeded.trainerA.id, cohort: cohort.id, scheduledDate: '2026-02-01', status: 'scheduled' as const },
      overrideAccess: true,
    })
    const unfinalized = await payload.create({
      collection: 'scores',
      data: { intern: seeded.internA.id, module: trainingModule.id, value: 70, finalized: false },
      overrideAccess: true,
    })
    const finalized = await payload.create({
      collection: 'scores',
      data: { intern: seeded.internA.id, module: trainingModule.id, value: 85, finalized: true },
      overrideAccess: true,
    })

    const ownUnfinalized = await payload.findByID({
      collection: 'scores',
      id: unfinalized.id,
      overrideAccess: false,
      user: seeded.internA,
      disableErrors: true,
    })
    expect(ownUnfinalized).toBeNull()

    const ownFinalized = await payload.findByID({
      collection: 'scores',
      id: finalized.id,
      overrideAccess: false,
      user: seeded.internA,
    })
    expect(ownFinalized.id).toBe(finalized.id)

    const othersFinalized = await payload.findByID({
      collection: 'scores',
      id: finalized.id,
      overrideAccess: false,
      user: seeded.internB,
      disableErrors: true,
    })
    expect(othersFinalized).toBeNull()
  })

  it('a supervisor can only read logbook entries for their assigned interns', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'Cohort C', tracks: ['truck-driving' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: seeded.internA.id, cohort: cohort.id, track: 'truck-driving', supervisor: seeded.supervisorA.id },
      overrideAccess: true,
    })
    // internB has no enrollment with supervisorA
    const assignedEntry = await payload.create({
      collection: 'logbooks',
      data: { intern: seeded.internA.id, type: 'driver', date: '2026-02-01' },
      overrideAccess: true,
    })
    const unassignedEntry = await payload.create({
      collection: 'logbooks',
      data: { intern: seeded.internB.id, type: 'driver', date: '2026-02-01' },
      overrideAccess: true,
    })

    const canReadAssigned = await payload.findByID({
      collection: 'logbooks',
      id: assignedEntry.id,
      overrideAccess: false,
      user: seeded.supervisorA,
    })
    expect(canReadAssigned.id).toBe(assignedEntry.id)

    const cannotReadUnassigned = await payload.findByID({
      collection: 'logbooks',
      id: unassignedEntry.id,
      overrideAccess: false,
      user: seeded.supervisorA,
      disableErrors: true,
    })
    expect(cannotReadUnassigned).toBeNull()
  })

  it('the admin superuser can read across collections regardless of ownership', async () => {
    const result = await payload.find({
      collection: 'scores',
      overrideAccess: false,
      user: seeded.admin,
    })
    expect(result.docs.length).toBeGreaterThan(0)
  })
})
