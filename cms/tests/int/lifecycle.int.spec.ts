// @vitest-environment node
// This spec uploads a real file (see beforeAll) — jsdom's polyfills
// interfere with `file-type`'s buffer sniffing during upload validation,
// so this file opts back into the plain Node environment.
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import sharp from 'sharp'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  trainer: User
  intern: User
  dummyFileId: number
}

let seeded: Seeded

describe('Contract lifecycle & cohort-closing guards (§6.1, §6.4)', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, trainer, intern] = await Promise.all([
      payload.create({
        collection: 'users',
        data: { email: 'lc-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'lc-trainer@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'lc-intern@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      }),
    ])

    // A real (if minimal) 1x1 transparent PNG — Payload sniffs actual file
    // bytes to verify the mimetype, so a fake buffer with a spoofed
    // mimetype string is rejected. Generated with sharp (already a
    // dependency) rather than a hand-typed base64 literal, for reliability.
    const pngBuffer = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer()
    const dummyFile = await payload.create({
      collection: 'files',
      data: {},
      file: { data: pngBuffer, mimetype: 'image/png', name: 'test.png', size: pngBuffer.length },
      overrideAccess: true,
    })

    seeded = { admin, trainer, intern, dummyFileId: dummyFile.id }
  })

  afterAll(async () => {
    if (!seeded) return
    for (const collection of ['contracts', 'documents', 'evaluations', 'enrollments', 'cohorts', 'files'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded)
        .filter((v): v is User => typeof v === 'object')
        .map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  async function createCohort(name: string) {
    return payload.create({
      collection: 'cohorts',
      data: {
        name,
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'active' as const,
      },
      overrideAccess: true,
    })
  }

  describe('Contracts', () => {
    it('cannot skip states, even as admin', async () => {
      const cohort = await createCohort('Contract Test A')
      const contract = await payload.create({
        collection: 'contracts',
        data: { trainer: seeded.trainer.id, cohort: cohort.id, status: 'draft' as const },
        overrideAccess: true,
      })

      await expect(
        payload.update({
          collection: 'contracts',
          id: contract.id,
          data: { status: 'active' },
          overrideAccess: false,
          user: seeded.admin,
        }),
      ).rejects.toThrow()
    })

    it('a trainer may move their own contract from sent to signed, but not to active', async () => {
      const cohort = await createCohort('Contract Test B')
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

      await expect(
        payload.update({
          collection: 'contracts',
          id: contract.id,
          data: { status: 'active' },
          overrideAccess: false,
          user: seeded.trainer,
        }),
      ).rejects.toThrow()
    })

    it('only admin may release/discharge a contract, never the trainer', async () => {
      const cohort = await createCohort('Contract Test C')
      const contract = await payload.create({
        collection: 'contracts',
        data: { trainer: seeded.trainer.id, cohort: cohort.id, status: 'active' as const },
        overrideAccess: true,
      })

      await expect(
        payload.update({
          collection: 'contracts',
          id: contract.id,
          data: { status: 'released' },
          overrideAccess: false,
          user: seeded.trainer,
        }),
      ).rejects.toThrow()

      const released = await payload.update({
        collection: 'contracts',
        id: contract.id,
        data: { status: 'released' },
        overrideAccess: false,
        user: seeded.admin,
      })
      expect(released.status).toBe('released')
    })
  })

  describe('Cohort closing checklist', () => {
    it('blocks closing while a contract for the cohort is unreleased', async () => {
      const cohort = await createCohort('Closing Test A')
      await payload.create({
        collection: 'contracts',
        data: { trainer: seeded.trainer.id, cohort: cohort.id, status: 'active' as const },
        overrideAccess: true,
      })

      await expect(
        payload.update({
          collection: 'cohorts',
          id: cohort.id,
          data: { status: 'closed' },
          overrideAccess: false,
          user: seeded.admin,
        }),
      ).rejects.toThrow()
    })

    it('blocks closing while an in-progress intern has no evaluation or an unverified document', async () => {
      const cohort = await createCohort('Closing Test B')
      await payload.create({
        collection: 'enrollments',
        data: { intern: seeded.intern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'in-progress' as const },
        overrideAccess: true,
      })

      // No evaluation yet — blocked.
      await expect(
        payload.update({
          collection: 'cohorts',
          id: cohort.id,
          data: { status: 'closed' },
          overrideAccess: false,
          user: seeded.admin,
        }),
      ).rejects.toThrow()

      await payload.create({
        collection: 'evaluations',
        data: {
          intern: seeded.intern.id,
          author: seeded.admin.id,
          cohort: cohort.id,
          type: 'standard' as const,
        },
        overrideAccess: true,
      })
      const unverifiedDoc = await payload.create({
        collection: 'documents',
        data: {
          intern: seeded.intern.id,
          type: 'national-id' as const,
          file: seeded.dummyFileId,
          verificationStatus: 'pending' as const,
        },
        overrideAccess: true,
      })

      // Evaluation now exists, but the document is still pending — blocked.
      await expect(
        payload.update({
          collection: 'cohorts',
          id: cohort.id,
          data: { status: 'closed' },
          overrideAccess: false,
          user: seeded.admin,
        }),
      ).rejects.toThrow()

      await payload.update({
        collection: 'documents',
        id: unverifiedDoc.id,
        data: { verificationStatus: 'verified' },
        overrideAccess: true,
      })

      const closed = await payload.update({
        collection: 'cohorts',
        id: cohort.id,
        data: { status: 'closed' },
        overrideAccess: false,
        user: seeded.admin,
      })
      expect(closed.status).toBe('closed')
    })
  })
})
