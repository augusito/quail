// §5/§6.2 (proposal v2): Trainer and Intern profile collections, plus the
// repeatable Education history that hangs off Intern. Access control
// mirrors §4's "Register/manage own profile": admin sees/edits everything,
// everyone else only their own row. `user` is unique on both collections
// (one profile per account), so each seeded user's profile is created once
// in beforeAll and reused read-only across tests, rather than re-created
// per test.
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { Intern, Trainer, User } from '@/payload-types'

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
let trainerProfileA: Trainer
let trainerProfileB: Trainer
let internProfileA: Intern
let internProfileB: Intern

describe('Trainer / Intern / Education access control (§4, §5, §6.2)', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const [admin, trainerA, trainerB, internA, internB, supervisorA] = await Promise.all([
      payload.create({ collection: 'users', data: { email: 'profiles-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'profiles-trainerA@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'profiles-trainerB@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'profiles-internA@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'profiles-internB@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const } }),
      payload.create({ collection: 'users', data: { email: 'profiles-supervisorA@test.dev', password: 'test1234', role: 'supervisor' as const, status: 'active' as const } }),
    ])
    seeded = { admin, trainerA, trainerB, internA, internB, supervisorA }

    ;[trainerProfileA, trainerProfileB] = await Promise.all([
      payload.create({
        collection: 'trainers',
        data: {
          user: trainerA.id,
          name: 'Trainer A',
          occupation: 'Driving Instructor',
          phone: '0700000000',
          email: trainerA.email,
          nationalIdNumber: '11111111',
          kraPin: 'A111111111Z',
        },
        overrideAccess: true,
      }),
      payload.create({
        collection: 'trainers',
        data: {
          user: trainerB.id,
          name: 'Trainer B',
          occupation: 'ICT Instructor',
          phone: '0700000002',
          email: trainerB.email,
          nationalIdNumber: '22222222',
          kraPin: 'A222222222Z',
        },
        overrideAccess: true,
      }),
    ])

    ;[internProfileA, internProfileB] = await Promise.all([
      payload.create({
        collection: 'interns',
        data: {
          user: internA.id,
          name: 'Intern A',
          dateOfBirth: '2000-01-01',
          gender: 'female' as const,
          nationality: 'Kenyan',
          phone: '0711111111',
          email: internA.email,
          nationalIdNumber: '55555555',
          kraPin: 'A555555555Z',
          shifNumber: 'SHIF-A',
          nssfNumber: 'NSSF-A',
          nextOfKin: { name: 'Kin A', relationship: 'Mother', phone: '0722222222' },
        },
        overrideAccess: true,
      }),
      payload.create({
        collection: 'interns',
        data: {
          user: internB.id,
          name: 'Intern B',
          dateOfBirth: '2001-01-01',
          gender: 'female' as const,
          nationality: 'Kenyan',
          phone: '0711111112',
          email: internB.email,
          nationalIdNumber: '66666666',
          kraPin: 'A666666666Z',
          shifNumber: 'SHIF-B',
          nssfNumber: 'NSSF-B',
          nextOfKin: { name: 'Kin B', relationship: 'Father', phone: '0722222223' },
        },
        overrideAccess: true,
      }),
    ])
  })

  afterAll(async () => {
    for (const collection of ['education', 'trainers', 'interns'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  describe('Trainer', () => {
    it('a trainer can read their own profile, but not another trainer\'s', async () => {
      const ownRead = await payload.findByID({
        collection: 'trainers',
        id: trainerProfileA.id,
        overrideAccess: false,
        user: seeded.trainerA,
        disableErrors: true,
      })
      expect(ownRead).not.toBeNull()

      const othersRead = await payload.findByID({
        collection: 'trainers',
        id: trainerProfileB.id,
        overrideAccess: false,
        user: seeded.trainerA,
        disableErrors: true,
      })
      expect(othersRead).toBeNull()
    })

    it('a trainer can update their own profile, but not another trainer\'s', async () => {
      const ownUpdate = await payload.update({
        collection: 'trainers',
        id: trainerProfileA.id,
        data: { occupation: 'Senior Driving Instructor' },
        overrideAccess: false,
        user: seeded.trainerA,
      })
      expect(ownUpdate.occupation).toBe('Senior Driving Instructor')

      await expect(
        payload.update({
          collection: 'trainers',
          id: trainerProfileB.id,
          data: { occupation: 'Hijacked' },
          overrideAccess: false,
          user: seeded.trainerA,
        }),
      ).rejects.toThrow()
    })

    it('an intern or supervisor cannot read any trainer profile', async () => {
      for (const user of [seeded.internA, seeded.supervisorA]) {
        const found = await payload.findByID({
          collection: 'trainers',
          id: trainerProfileA.id,
          overrideAccess: false,
          user,
          disableErrors: true,
        })
        expect(found).toBeNull()
      }
    })

    it('admin can read and update any trainer profile', async () => {
      const updated = await payload.update({
        collection: 'trainers',
        id: trainerProfileB.id,
        data: { occupation: 'Updated By Admin' },
        overrideAccess: false,
        user: seeded.admin,
      })
      expect(updated.occupation).toBe('Updated By Admin')
    })
  })

  describe('Intern', () => {
    it('an intern can read their own profile, but not another intern\'s', async () => {
      const ownRead = await payload.findByID({
        collection: 'interns',
        id: internProfileA.id,
        overrideAccess: false,
        user: seeded.internA,
        disableErrors: true,
      })
      expect(ownRead).not.toBeNull()

      const othersRead = await payload.findByID({
        collection: 'interns',
        id: internProfileB.id,
        overrideAccess: false,
        user: seeded.internA,
        disableErrors: true,
      })
      expect(othersRead).toBeNull()
    })

    it('an intern cannot update another intern\'s profile', async () => {
      await expect(
        payload.update({
          collection: 'interns',
          id: internProfileB.id,
          data: { nationality: 'Hijacked' },
          overrideAccess: false,
          user: seeded.internA,
        }),
      ).rejects.toThrow()
    })

    it('a trainer or supervisor cannot read any intern profile', async () => {
      for (const user of [seeded.trainerA, seeded.supervisorA]) {
        const found = await payload.findByID({
          collection: 'interns',
          id: internProfileA.id,
          overrideAccess: false,
          user,
          disableErrors: true,
        })
        expect(found).toBeNull()
      }
    })
  })

  describe('Education', () => {
    it('an intern can create and read their own education rows, but not another intern\'s', async () => {
      const ownEducation = await payload.create({
        collection: 'education',
        data: { intern: internProfileA.id, school: 'Own School', qualification: 'KCSE' },
        overrideAccess: false,
        user: seeded.internA,
      })
      expect(ownEducation.id).toBeDefined()

      await expect(
        payload.create({
          collection: 'education',
          data: { intern: internProfileB.id, school: 'Hijack School', qualification: 'KCSE' },
          overrideAccess: false,
          user: seeded.internA,
        }),
      ).rejects.toThrow()

      const othersEducation = await payload.create({
        collection: 'education',
        data: { intern: internProfileB.id, school: 'Other School', qualification: 'Diploma' },
        overrideAccess: true,
      })
      const cannotReadOthers = await payload.findByID({
        collection: 'education',
        id: othersEducation.id,
        overrideAccess: false,
        user: seeded.internA,
        disableErrors: true,
      })
      expect(cannotReadOthers).toBeNull()
    })
  })
})
