// @vitest-environment node
// exceljs's xlsx read/write goes through Node's zlib/stream internals —
// jsdom's polyfills have broken similar Node-native binary/crypto
// operations in this project before (file-type sniffing, jose JWT
// signing), so this file opts back into the plain Node environment
// pre-emptively rather than waiting to hit the same class of failure.
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'
import { exportCollectionEndpoint } from '@/endpoints/exportCollection'
import ExcelJS from 'exceljs'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type Seeded = {
  admin: User
  intern: User
}

let seeded: Seeded

type ExportHandler = typeof exportCollectionEndpoint.handler

describe('GET /api/export/:collection (§6.11 Excel exports)', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, intern] = await Promise.all([
      payload.create({
        collection: 'users',
        data: { email: 'export-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'export-intern@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      }),
    ])
    seeded = { admin, intern }
  })

  afterAll(async () => {
    for (const collection of ['enrollments', 'cohorts'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  // Calls the endpoint's own handler directly with the minimal fake
  // PayloadRequest it actually reads (user/payload/routeParams/query),
  // rather than round-tripping through handleEndpoints — which needs a
  // real authenticated Request (cookies/headers), while every other test
  // in this suite already establishes "acting as this user" via a plain
  // user object, not a live session.
  async function callExport(collection: string, options: { cohort?: string; user: User | null }) {
    const req = {
      payload,
      query: options.cohort ? { cohort: options.cohort } : {},
      routeParams: { collection },
      user: options.user,
    }
    return (exportCollectionEndpoint.handler as ExportHandler)(req as unknown as Parameters<ExportHandler>[0])
  }

  it('rejects a non-admin user', async () => {
    const response = await callExport('users', { user: seeded.intern })
    expect(response.status).toBe(403)
  })

  it('rejects an unknown collection', async () => {
    const response = await callExport('payload-jobs', { user: seeded.admin })
    expect(response.status).toBe(404)
  })

  it('returns a real .xlsx workbook with the expected rows for an admin', async () => {
    const response = await callExport('users', { user: seeded.admin })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="users-export-/)

    const buffer = Buffer.from(await response.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.getWorksheet('Users')
    expect(sheet).toBeDefined()

    const headerRow = sheet!.getRow(1).values as unknown[]
    expect(headerRow).toContain('Email')
    expect(headerRow).toContain('Role')

    const emailColumn = headerRow.indexOf('Email')
    const emails = new Set<string>()
    sheet!.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      emails.add(String(row.getCell(emailColumn).value))
    })
    expect(emails.has(seeded.admin.email)).toBe(true)
    expect(emails.has(seeded.intern.email)).toBe(true)
  })

  it('filters by ?cohort= for collections that carry a cohort field', async () => {
    const cohortA = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Export Cohort A',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
      },
      overrideAccess: true,
    })
    const cohortB = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Export Cohort B',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: seeded.intern.id, cohort: cohortA.id, track: 'ict' as const, outcome: 'in-progress' as const },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'enrollments',
      data: { intern: seeded.intern.id, cohort: cohortB.id, track: 'ict' as const, outcome: 'in-progress' as const },
      overrideAccess: true,
    })

    const response = await callExport('enrollments', { cohort: String(cohortA.id), user: seeded.admin })
    const buffer = Buffer.from(await response.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.getWorksheet('Enrollments')

    let dataRowCount = 0
    sheet!.eachRow((_row, rowNumber) => {
      if (rowNumber !== 1) dataRowCount += 1
    })
    expect(dataRowCount).toBe(1)
  })

  // §7 (proposal v2): "national ID/passport numbers, KRA PINs, SHIF/NSSF
  // numbers, and date of birth... not exposed in bulk exports". The
  // trainers/interns export definitions (src/exports/registry.ts) simply
  // don't list those columns — confirm that holds for a real .xlsx, not
  // just by re-reading the column list.
  it('never includes sensitive Trainer/Intern fields (national ID, KRA PIN, SHIF, NSSF, date of birth) in exports', async () => {
    const trainer = await payload.create({
      collection: 'users',
      data: { email: 'export-trainer@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'trainers',
      data: {
        user: trainer.id,
        name: 'Export Trainer',
        occupation: 'Instructor',
        phone: '0700000000',
        email: trainer.email,
        nationalIdNumber: 'SECRET-ID-TRAINER',
        kraPin: 'SECRET-KRA-TRAINER',
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'interns',
      data: {
        user: seeded.intern.id,
        name: 'Export Intern',
        dateOfBirth: '2000-05-05',
        gender: 'female' as const,
        nationality: 'Kenyan',
        phone: '0711111111',
        email: seeded.intern.email,
        nationalIdNumber: 'SECRET-ID-INTERN',
        kraPin: 'SECRET-KRA-INTERN',
        shifNumber: 'SECRET-SHIF-INTERN',
        nssfNumber: 'SECRET-NSSF-INTERN',
        nextOfKin: { name: 'Kin', relationship: 'Mother', phone: '0722222222' },
      },
      overrideAccess: true,
    })

    for (const collection of ['trainers', 'interns']) {
      const response = await callExport(collection, { user: seeded.admin })
      expect(response.status).toBe(200)
      const buffer = Buffer.from(await response.arrayBuffer())
      const raw = buffer.toString('latin1')
      for (const secret of [
        'SECRET-ID-TRAINER',
        'SECRET-KRA-TRAINER',
        'SECRET-ID-INTERN',
        'SECRET-KRA-INTERN',
        'SECRET-SHIF-INTERN',
        'SECRET-NSSF-INTERN',
        '2000-05-05',
      ]) {
        expect(raw).not.toContain(secret)
      }
    }

    await payload.delete({ collection: 'trainers', where: {}, overrideAccess: true })
    await payload.delete({ collection: 'interns', where: {}, overrideAccess: true })
    await payload.delete({ collection: 'users', id: trainer.id, overrideAccess: true })
  })
})
