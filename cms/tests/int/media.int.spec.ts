// @vitest-environment node
// Uploads real files (see uploadDummyImage) — jsdom's polyfills interfere
// with `file-type`'s buffer sniffing during upload validation, same issue
// hit in lifecycle.int.spec.ts.
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import sharp from 'sharp'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  grantedTrainer: User
  ungrantedTrainer: User
  intern: User
}

let seeded: Seeded

async function uploadDummyImage(
  payload: Payload,
  data: { cohort: number; visibilityScope: 'admin-only' | 'cohort-extended' },
) {
  const pngBuffer = await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer()
  return payload.create({
    collection: 'media',
    data,
    file: { data: pngBuffer, mimetype: 'image/png', name: `test-${Date.now()}-${Math.random()}.png`, size: pngBuffer.length },
    overrideAccess: true,
  })
}

describe('Media read scoping — §4 "unless granted per cohort" trainer exception', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, grantedTrainer, ungrantedTrainer, intern] = await Promise.all([
      payload.create({ collection: 'users', data: { email: 'ma-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'ma-granted-trainer@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'ma-ungranted-trainer@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'ma-intern@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
    ])
    seeded = { admin, grantedTrainer, ungrantedTrainer, intern }
  })

  afterAll(async () => {
    await payload.delete({ collection: 'media', where: {}, overrideAccess: true })
    await payload.delete({ collection: 'cohorts', where: {}, overrideAccess: true })
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  it('admin can read any media asset, regardless of visibilityScope', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'Admin Read Cohort', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    const asset = await uploadDummyImage(payload, { cohort: cohort.id, visibilityScope: 'admin-only' as const })

    const found = await payload.findByID({
      collection: 'media',
      id: asset.id,
      overrideAccess: false,
      user: seeded.admin,
      disableErrors: true,
    })
    expect(found).not.toBeNull()
  })

  it('a granted trainer can read cohort-extended assets for their granted cohort', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Granted Cohort',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
        mediaAccessGrantedTo: [seeded.grantedTrainer.id],
      },
      overrideAccess: true,
    })
    const asset = await uploadDummyImage(payload, { cohort: cohort.id, visibilityScope: 'cohort-extended' as const })

    const found = await payload.findByID({
      collection: 'media',
      id: asset.id,
      overrideAccess: false,
      user: seeded.grantedTrainer,
      disableErrors: true,
    })
    expect(found).not.toBeNull()
  })

  it('a granted trainer cannot read admin-only assets in that same granted cohort', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Granted Cohort Admin Only',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
        mediaAccessGrantedTo: [seeded.grantedTrainer.id],
      },
      overrideAccess: true,
    })
    const asset = await uploadDummyImage(payload, { cohort: cohort.id, visibilityScope: 'admin-only' as const })

    const found = await payload.findByID({
      collection: 'media',
      id: asset.id,
      overrideAccess: false,
      user: seeded.grantedTrainer,
      disableErrors: true,
    })
    expect(found).toBeNull()
  })

  it('an ungranted trainer cannot read cohort-extended assets for a cohort they were not granted', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Ungranted Cohort',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
        mediaAccessGrantedTo: [seeded.grantedTrainer.id],
      },
      overrideAccess: true,
    })
    const asset = await uploadDummyImage(payload, { cohort: cohort.id, visibilityScope: 'cohort-extended' as const })

    const found = await payload.findByID({
      collection: 'media',
      id: asset.id,
      overrideAccess: false,
      user: seeded.ungrantedTrainer,
      disableErrors: true,
    })
    expect(found).toBeNull()
  })

  it('an intern cannot read media assets even for a cohort-extended asset', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: { name: 'Intern Denied Cohort', tracks: ['ict' as const], startDate: '2026-01-01', endDate: '2026-06-01', status: 'open' as const },
      overrideAccess: true,
    })
    const asset = await uploadDummyImage(payload, { cohort: cohort.id, visibilityScope: 'cohort-extended' as const })

    const found = await payload.findByID({
      collection: 'media',
      id: asset.id,
      overrideAccess: false,
      user: seeded.intern,
      disableErrors: true,
    })
    expect(found).toBeNull()
  })

  it('a trainer cannot create, update, or delete media assets even when granted on the cohort', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Trainer Write Denied Cohort',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
        mediaAccessGrantedTo: [seeded.grantedTrainer.id],
      },
      overrideAccess: true,
    })
    const asset = await uploadDummyImage(payload, { cohort: cohort.id, visibilityScope: 'cohort-extended' as const })

    await expect(
      uploadDummyImage(payload, { cohort: cohort.id, visibilityScope: 'cohort-extended' as const }).then(() =>
        payload.create({
          collection: 'media',
          data: { cohort: cohort.id, visibilityScope: 'cohort-extended' as const },
          overrideAccess: false,
          user: seeded.grantedTrainer,
          file: { data: Buffer.from([]), mimetype: 'image/png', name: 'x.png', size: 0 },
        }),
      ),
    ).rejects.toThrow()

    await expect(
      payload.update({
        collection: 'media',
        id: asset.id,
        data: { consentGiven: true },
        overrideAccess: false,
        user: seeded.grantedTrainer,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'media',
        id: asset.id,
        overrideAccess: false,
        user: seeded.grantedTrainer,
      }),
    ).rejects.toThrow()
  })
})
