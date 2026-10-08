// @vitest-environment node
// Uploads a real file for the Documents case (see uploadDummyFile) — jsdom's
// polyfills interfere with `file-type`'s buffer sniffing during upload
// validation, same issue hit in filesAndAnnouncements.int.spec.ts.
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { uploadDummyFile } from '../helpers/dummyFile'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  trainerA: User
  trainerB: User
  internA: User
  internB: User
  supervisorA: User
  supervisorB: User
}

let seeded: Seeded

// Regression coverage for the `create`-access gap described in
// adminOrRoleOwnsField's doc comment (src/access/roles.ts): a `Where`
// returned from a `create` access function is never merged into the
// submitted `data` by Payload, so it behaves like `true` and never actually
// checks the row names the caller as its owner. Note, Documents, and Alumna
// switched their `create` access to `adminOrRoleOwnsFieldOnCreate`, which
// checks `data[field] === user.id` directly; Workplans has a bespoke
// createAccess that additionally cross-checks the named intern is actually
// assigned to the calling supervisor (src/collections/Workplans.ts) — these
// confirm each one now rejects a row naming someone else as its owner.
describe('create access rejects naming someone else as the owner field', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, trainerA, trainerB, internA, internB, supervisorA, supervisorB] = await Promise.all([
      payload.create({ collection: 'users', data: { email: 'cao-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'cao-trainerA@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'cao-trainerB@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'cao-internA@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'cao-internB@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'cao-supervisorA@test.dev', password: 'test1234', role: 'supervisor' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'cao-supervisorB@test.dev', password: 'test1234', role: 'supervisor' as const, status: 'active' as const } }),
    ])
    seeded = { admin, trainerA, trainerB, internA, internB, supervisorA, supervisorB }
  })

  afterAll(async () => {
    for (const collection of [
      'notes',
      'documents',
      'workplans',
      'enrollments',
      'alumnae',
      'files',
      'sessions',
      'modules',
      'cohorts',
    ] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  it('a trainer cannot create a Note naming another trainer as the note-taker', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'CAO Cohort', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    const trainingModule = await payload.create({ collection: 'modules', data: { track: 'ict', name: 'CAO Module' }, overrideAccess: true })
    const session = await payload.create({
      collection: 'sessions',
      data: { module: trainingModule.id, trainer: seeded.trainerA.id, cohort: cohort.id, scheduledDate: '2026-02-01', status: 'scheduled' as const },
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'notes',
        data: { session: session.id, trainer: seeded.trainerB.id },
        overrideAccess: false,
        user: seeded.trainerA,
      }),
    ).rejects.toThrow()

    const ownNote = await payload.create({
      collection: 'notes',
      data: { session: session.id, trainer: seeded.trainerA.id },
      overrideAccess: false,
      user: seeded.trainerA,
    })
    expect(ownNote.id).toBeDefined()
  })

  it('a trainer cannot create a Note against a session they do not teach, even naming themselves', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'CAO Notes Cohort', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    const trainingModule = await payload.create({ collection: 'modules', data: { track: 'ict', name: 'CAO Notes Module' }, overrideAccess: true })
    const othersSession = await payload.create({
      collection: 'sessions',
      data: { module: trainingModule.id, trainer: seeded.trainerB.id, cohort: cohort.id, scheduledDate: '2026-02-01', status: 'scheduled' as const },
      overrideAccess: true,
    })

    // Self-attributed `trainer`, but the session belongs to trainerB: denied.
    await expect(
      payload.create({
        collection: 'notes',
        data: { session: othersSession.id, trainer: seeded.trainerA.id },
        overrideAccess: false,
        user: seeded.trainerA,
      }),
    ).rejects.toThrow()
  })

  it('an intern cannot create a Document naming another intern as its owner', async () => {
    const file = await uploadDummyFile(payload)

    await expect(
      payload.create({
        collection: 'documents',
        data: { intern: seeded.internB.id, type: 'national-id' as const, file: file.id, verificationStatus: 'pending' as const },
        overrideAccess: false,
        user: seeded.internA,
      }),
    ).rejects.toThrow()

    const ownDocument = await payload.create({
      collection: 'documents',
      data: { intern: seeded.internA.id, type: 'national-id' as const, file: file.id, verificationStatus: 'pending' as const },
      overrideAccess: false,
      user: seeded.internA,
    })
    expect(ownDocument.id).toBeDefined()
  })

  it('a supervisor cannot create a Workplan naming another supervisor as its owner', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'CAO Workplan Cohort', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    // internA is assigned to supervisorA; internB is not assigned to either
    // supervisor — needed below to also cover the related-intern cross-check,
    // not just the self-attribution check.
    await payload.create({
      collection: 'enrollments',
      data: { intern: seeded.internA.id, cohort: cohort.id, supervisor: seeded.supervisorA.id, track: 'ict' as const },
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'workplans',
        data: { supervisor: seeded.supervisorB.id, intern: seeded.internA.id, cohort: cohort.id },
        overrideAccess: false,
        user: seeded.supervisorA,
      }),
    ).rejects.toThrow()

    // Denied even naming themselves, because internB isn't their assigned intern.
    await expect(
      payload.create({
        collection: 'workplans',
        data: { supervisor: seeded.supervisorA.id, intern: seeded.internB.id, cohort: cohort.id },
        overrideAccess: false,
        user: seeded.supervisorA,
      }),
    ).rejects.toThrow()

    const ownWorkplan = await payload.create({
      collection: 'workplans',
      data: { supervisor: seeded.supervisorA.id, intern: seeded.internA.id, cohort: cohort.id },
      overrideAccess: false,
      user: seeded.supervisorA,
    })
    expect(ownWorkplan.id).toBeDefined()
  })

  it('an intern cannot create an Alumna profile naming another intern as its owner', async () => {
    await expect(
      payload.create({
        collection: 'alumnae',
        data: { intern: seeded.internB.id, name: 'Someone Else' },
        overrideAccess: false,
        user: seeded.internA,
      }),
    ).rejects.toThrow()

    const ownProfile = await payload.create({
      collection: 'alumnae',
      data: { intern: seeded.internA.id, name: 'CAO Intern A' },
      overrideAccess: false,
      user: seeded.internA,
    })
    expect(ownProfile.id).toBeDefined()
  })
})
