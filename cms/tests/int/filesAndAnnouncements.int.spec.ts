// @vitest-environment node
// Uploads real files (see beforeAll) — jsdom's polyfills interfere with
// `file-type`'s buffer sniffing during upload validation, same issue hit
// in lifecycle.int.spec.ts.
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import sharp from 'sharp'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  trainerA: User
  trainerB: User
  internA: User
  internB: User
  graduatedAlum: User
  resignedAlum: User
}

let seeded: Seeded

async function uploadDummyFile(payload: Payload) {
  const pngBuffer = await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer()
  return payload.create({
    collection: 'files',
    data: {},
    file: { data: pngBuffer, mimetype: 'image/png', name: `test-${Date.now()}-${Math.random()}.png`, size: pngBuffer.length },
    overrideAccess: true,
  })
}

describe('Files & Announcements read scoping (follow-up to the §4 access-control pass)', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, trainerA, trainerB, internA, internB, graduatedAlum, resignedAlum] = await Promise.all([
      payload.create({ collection: 'users', data: { email: 'fa-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'fa-trainerA@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'fa-trainerB@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'fa-internA@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'fa-internB@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'fa-graduated@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'fa-resigned@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
    ])
    seeded = { admin, trainerA, trainerB, internA, internB, graduatedAlum, resignedAlum }

    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'Files/Announcements Test Cohort', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'closed' as const },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: graduatedAlum.id, cohort: cohort.id, track: 'ict' as const, outcome: 'graduated' as const },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: resignedAlum.id, cohort: cohort.id, track: 'ict' as const, outcome: 'resigned' as const },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: internA.id, cohort: cohort.id, track: 'ict' as const, outcome: 'in-progress' as const },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    for (const collection of ['announcements', 'documents', 'contracts', 'enrollments', 'cohorts', 'files'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  describe('Files', () => {
    it('a trainer can read the file attached to their own contract, even if admin uploaded it', async () => {
      const cohort = await payload.create({
        collection: 'cohorts',
        data: { name: 'Contract File Test', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
        overrideAccess: true,
      })
      const contractFile = await uploadDummyFile(payload)
      await payload.create({
        collection: 'contracts',
        data: { trainer: seeded.trainerA.id, cohort: cohort.id, status: 'sent' as const, file: contractFile.id },
        overrideAccess: true,
      })

      const found = await payload.findByID({
        collection: 'files',
        id: contractFile.id,
        overrideAccess: false,
        user: seeded.trainerA,
        disableErrors: true,
      })
      expect(found).not.toBeNull()
    })

    it("a trainer cannot read an unrelated intern's document file", async () => {
      const documentFile = await uploadDummyFile(payload)
      await payload.create({
        collection: 'documents',
        data: { intern: seeded.internB.id, type: 'national-id' as const, file: documentFile.id, verificationStatus: 'pending' as const },
        overrideAccess: true,
      })

      const found = await payload.findByID({
        collection: 'files',
        id: documentFile.id,
        overrideAccess: false,
        user: seeded.trainerB,
        disableErrors: true,
      })
      expect(found).toBeNull()
    })

    it('an intern can read the file attached to their own document, but not another intern’s', async () => {
      const ownFile = await uploadDummyFile(payload)
      const othersFile = await uploadDummyFile(payload)
      await payload.create({
        collection: 'documents',
        data: { intern: seeded.internA.id, type: 'national-id' as const, file: ownFile.id, verificationStatus: 'pending' as const },
        overrideAccess: true,
      })
      await payload.create({
        collection: 'documents',
        data: { intern: seeded.internB.id, type: 'national-id' as const, file: othersFile.id, verificationStatus: 'pending' as const },
        overrideAccess: true,
      })

      const own = await payload.findByID({
        collection: 'files',
        id: ownFile.id,
        overrideAccess: false,
        user: seeded.internA,
        disableErrors: true,
      })
      expect(own).not.toBeNull()

      const others = await payload.findByID({
        collection: 'files',
        id: othersFile.id,
        overrideAccess: false,
        user: seeded.internA,
        disableErrors: true,
      })
      expect(others).toBeNull()
    })

    it('any user can always read their own upload, before it is linked to anything', async () => {
      const file = await payload.create({
        collection: 'files',
        data: {},
        overrideAccess: false,
        user: seeded.internA,
        file: (await (async () => {
          const pngBuffer = await sharp({
            create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
          })
            .png()
            .toBuffer()
          return { data: pngBuffer, mimetype: 'image/png', name: 'own-upload.png', size: pngBuffer.length }
        })()),
      })

      const found = await payload.findByID({
        collection: 'files',
        id: file.id,
        overrideAccess: false,
        user: seeded.internA,
        disableErrors: true,
      })
      expect(found).not.toBeNull()

      const othersView = await payload.findByID({
        collection: 'files',
        id: file.id,
        overrideAccess: false,
        user: seeded.internB,
        disableErrors: true,
      })
      expect(othersView).toBeNull()
    })

    it('admin can read any file', async () => {
      const file = await uploadDummyFile(payload)
      const found = await payload.findByID({
        collection: 'files',
        id: file.id,
        overrideAccess: false,
        user: seeded.admin,
        disableErrors: true,
      })
      expect(found).not.toBeNull()
    })
  })

  describe('Announcements', () => {
    async function createAnnouncement() {
      return payload.create({
        collection: 'announcements',
        data: { title: 'Test Announcement', content: 'Hello alumni', author: seeded.admin.id },
        overrideAccess: true,
      })
    }

    it('admin can read announcements', async () => {
      const announcement = await createAnnouncement()
      const found = await payload.findByID({
        collection: 'announcements',
        id: announcement.id,
        overrideAccess: false,
        user: seeded.admin,
        disableErrors: true,
      })
      expect(found).not.toBeNull()
    })

    it('a graduated alum can read announcements', async () => {
      const announcement = await createAnnouncement()
      const found = await payload.findByID({
        collection: 'announcements',
        id: announcement.id,
        overrideAccess: false,
        user: seeded.graduatedAlum,
        disableErrors: true,
      })
      expect(found).not.toBeNull()
    })

    it('a resigned alum can read announcements too (§6.1: same Alumni Hub access)', async () => {
      const announcement = await createAnnouncement()
      const found = await payload.findByID({
        collection: 'announcements',
        id: announcement.id,
        overrideAccess: false,
        user: seeded.resignedAlum,
        disableErrors: true,
      })
      expect(found).not.toBeNull()
    })

    it('a still-in-progress intern cannot read announcements', async () => {
      const announcement = await createAnnouncement()
      const found = await payload.findByID({
        collection: 'announcements',
        id: announcement.id,
        overrideAccess: false,
        user: seeded.internA,
        disableErrors: true,
      })
      expect(found).toBeNull()
    })

    it('a trainer cannot read announcements', async () => {
      const announcement = await createAnnouncement()
      const found = await payload.findByID({
        collection: 'announcements',
        id: announcement.id,
        overrideAccess: false,
        user: seeded.trainerA,
        disableErrors: true,
      })
      expect(found).toBeNull()
    })
  })
})
