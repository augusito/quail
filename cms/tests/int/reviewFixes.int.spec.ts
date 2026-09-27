// @vitest-environment node
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  trainer: User
  otherTrainer: User
  intern: User
}

let seeded: Seeded

// Regression coverage for the four access-control gaps found in the
// consistency/completeness/correctness review of proposal v2 (PR #7):
// §6.10 logbook read-only after graduation, §6.4 admin-only ratePerSession,
// §6.5 driving-skills-checkpoint track scoping, and job-managed
// Session.reminderStatus.
describe('Review fixes: logbook read-only, contract rate lock, driving-skills track scoping, reminder status lock', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, trainer, otherTrainer, intern] = await Promise.all([
      payload.create({
        collection: 'users',
        data: { email: 'rf-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'rf-trainer@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'rf-other-trainer@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'rf-intern@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      }),
    ])
    seeded = { admin, trainer, otherTrainer, intern }
  })

  // `seeded.intern`/`seeded.trainer` are shared across every test case
  // below, so each test's own Enrollment (in-progress vs. graduated, ICT vs.
  // truck-driving) must not leak into the next one's scoping checks.
  afterEach(async () => {
    for (const collection of ['evaluations', 'logbooks', 'contracts', 'sessions', 'modules', 'enrollments', 'cohorts'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
  })

  afterAll(async () => {
    if (!seeded) return
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  async function createCohort(name: string, tracks: string[] = ['ict']) {
    return payload.create({
      collection: 'cohorts',
      data: { name, tracks: tracks as ('ict' | 'truck-driving')[], startDate: '2026-01-01', endDate: '2026-06-01', status: 'active' as const },
      overrideAccess: true,
    })
  }

  describe('§6.10 Logbook read-only after graduation', () => {
    it('an in-progress intern can still update her own logbook entry', async () => {
      const cohort = await createCohort('Logbook Test A')
      await payload.create({
        collection: 'enrollments',
        data: { intern: seeded.intern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'in-progress' as const },
        overrideAccess: true,
      })
      const entry = await payload.create({
        collection: 'logbooks',
        data: { intern: seeded.intern.id, type: 'non-driver' as const, date: '2026-02-01' },
        overrideAccess: true,
      })

      const updated = await payload.update({
        collection: 'logbooks',
        id: entry.id,
        data: { status: 'submitted' },
        overrideAccess: false,
        user: seeded.intern,
      })
      expect(updated.status).toBe('submitted')
    })

    it('a graduated alumna cannot update her old logbook entries', async () => {
      const cohort = await createCohort('Logbook Test B')
      await payload.create({
        collection: 'enrollments',
        data: { intern: seeded.intern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'graduated' as const },
        overrideAccess: true,
      })
      const entry = await payload.create({
        collection: 'logbooks',
        data: { intern: seeded.intern.id, type: 'non-driver' as const, date: '2026-02-01' },
        overrideAccess: true,
      })

      await expect(
        payload.update({
          collection: 'logbooks',
          id: entry.id,
          data: { status: 'submitted' },
          overrideAccess: false,
          user: seeded.intern,
        }),
      ).rejects.toThrow()

      // Read-only, not invisible — she can still see her past entries.
      const stillReadable = await payload.findByID({
        collection: 'logbooks',
        id: entry.id,
        overrideAccess: false,
        user: seeded.intern,
      })
      expect(stillReadable.id).toBe(entry.id)
    })

    it('a graduated alumna cannot create a new logbook entry either', async () => {
      const cohort = await createCohort('Logbook Test C')
      await payload.create({
        collection: 'enrollments',
        data: { intern: seeded.intern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'graduated' as const },
        overrideAccess: true,
      })

      await expect(
        payload.create({
          collection: 'logbooks',
          data: { intern: seeded.intern.id, type: 'non-driver' as const, date: '2026-03-01' },
          overrideAccess: false,
          user: seeded.intern,
        }),
      ).rejects.toThrow()
    })
  })

  describe('§6.4 Contracts.ratePerSession is admin-only', () => {
    it('a trainer cannot change the rate on their own contract', async () => {
      const cohort = await createCohort('Contract Rate Test')
      const contract = await payload.create({
        collection: 'contracts',
        data: { trainer: seeded.trainer.id, cohort: cohort.id, status: 'draft' as const, ratePerSession: 7500 },
        overrideAccess: true,
      })

      const attempted = await payload.update({
        collection: 'contracts',
        id: contract.id,
        data: { ratePerSession: 50000 },
        overrideAccess: false,
        user: seeded.trainer,
      })
      // Field-level access silently drops disallowed fields rather than
      // throwing, so assert the value didn't actually change.
      expect(attempted.ratePerSession).toBe(7500)

      const reread = await payload.findByID({ collection: 'contracts', id: contract.id, overrideAccess: true })
      expect(reread.ratePerSession).toBe(7500)
    })

    it('admin can set the rate', async () => {
      const cohort = await createCohort('Contract Rate Test 2')
      const contract = await payload.create({
        collection: 'contracts',
        data: { trainer: seeded.trainer.id, cohort: cohort.id, status: 'draft' as const },
        overrideAccess: true,
      })

      const updated = await payload.update({
        collection: 'contracts',
        id: contract.id,
        data: { ratePerSession: 8000 },
        overrideAccess: false,
        user: seeded.admin,
      })
      expect(updated.ratePerSession).toBe(8000)
    })

    it('a trainer can still sign their own contract (unrelated field still writable)', async () => {
      const cohort = await createCohort('Contract Rate Test 3')
      const contract = await payload.create({
        collection: 'contracts',
        data: { trainer: seeded.trainer.id, cohort: cohort.id, status: 'sent' as const },
        overrideAccess: true,
      })

      const signed = await payload.update({
        collection: 'contracts',
        id: contract.id,
        data: { status: 'signed' },
        overrideAccess: false,
        user: seeded.trainer,
      })
      expect(signed.status).toBe('signed')
    })
  })

  describe('§6.5 driving-skills checkpoint is scoped to the truck-driving track', () => {
    it('a trainer can author a driving-skills evaluation for a truck-driving intern', async () => {
      const cohort = await createCohort('Driving Track Test A', ['truck-driving'])
      await payload.create({
        collection: 'enrollments',
        data: { intern: seeded.intern.id, cohort: cohort.id, track: 'truck-driving' as const, outcome: 'in-progress' as const },
        overrideAccess: true,
      })

      const evaluation = await payload.create({
        collection: 'evaluations',
        data: {
          intern: seeded.intern.id,
          author: seeded.trainer.id,
          cohort: cohort.id,
          type: 'driving-skills-baseline' as const,
        },
        overrideAccess: false,
        user: seeded.trainer,
      })
      expect(evaluation.type).toBe('driving-skills-baseline')
    })

    it('a trainer cannot author a driving-skills evaluation for an ICT-track intern', async () => {
      const cohort = await createCohort('Driving Track Test B', ['ict'])
      await payload.create({
        collection: 'enrollments',
        data: { intern: seeded.intern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'in-progress' as const },
        overrideAccess: true,
      })

      await expect(
        payload.create({
          collection: 'evaluations',
          data: {
            intern: seeded.intern.id,
            author: seeded.trainer.id,
            cohort: cohort.id,
            type: 'driving-skills-baseline' as const,
          },
          overrideAccess: false,
          user: seeded.trainer,
        }),
      ).rejects.toThrow()
    })
  })

  describe('Session.reminderStatus is job-managed, not trainer-writable', () => {
    it('a trainer cannot mark their own session reminder as already sent', async () => {
      const cohort = await createCohort('Reminder Lock Test')
      const moduleDoc = await payload.create({
        collection: 'modules',
        data: { track: 'ict' as const, name: 'Reminder Lock Module' },
        overrideAccess: true,
      })
      const session = await payload.create({
        collection: 'sessions',
        data: {
          module: moduleDoc.id,
          trainer: seeded.trainer.id,
          cohort: cohort.id,
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'scheduled' as const,
        },
        overrideAccess: true,
      })

      const attempted = await payload.update({
        collection: 'sessions',
        id: session.id,
        data: { reminderStatus: 'sent' },
        overrideAccess: false,
        user: seeded.trainer,
      })
      expect(attempted.reminderStatus).toBe('pending')
    })

    it('a trainer can still reschedule their own session (unrelated field still writable)', async () => {
      const cohort = await createCohort('Reminder Lock Test 2')
      const moduleDoc = await payload.create({
        collection: 'modules',
        data: { track: 'ict' as const, name: 'Reminder Lock Module 2' },
        overrideAccess: true,
      })
      const session = await payload.create({
        collection: 'sessions',
        data: {
          module: moduleDoc.id,
          trainer: seeded.trainer.id,
          cohort: cohort.id,
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'scheduled' as const,
        },
        overrideAccess: true,
      })

      const rescheduled = await payload.update({
        collection: 'sessions',
        id: session.id,
        data: { status: 'rescheduled' },
        overrideAccess: false,
        user: seeded.trainer,
      })
      expect(rescheduled.status).toBe('rescheduled')

      // Clean up the reminder job this write queues (afterChange hook),
      // same as tests/int/reminders.int.spec.ts, so it doesn't leak.
      await payload.delete({ collection: 'payload-jobs', where: {}, overrideAccess: true })
    })
  })
})
