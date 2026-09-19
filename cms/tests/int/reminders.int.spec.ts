import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

let payload: Payload
let sendEmailSpy: ReturnType<typeof vi.spyOn>

type Seeded = {
  admin: User
  trainer: User
  internA: User
  internB: User
}

let seeded: Seeded

describe('Session reminders (§6.3)', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    sendEmailSpy = vi.spyOn(payload, 'sendEmail')

    const [admin, trainer, internA, internB] = await Promise.all([
      payload.create({
        collection: 'users',
        data: { email: 'reminders-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'reminders-trainer@test.dev', password: 'test1234', role: 'trainer' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'reminders-internA@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      }),
      payload.create({
        collection: 'users',
        data: { email: 'reminders-internB@test.dev', password: 'test1234', role: 'intern' as const, status: 'active' as const },
      }),
    ])
    seeded = { admin, trainer, internA, internB }
  })

  afterEach(() => {
    sendEmailSpy.mockClear()
  })

  afterAll(async () => {
    sendEmailSpy.mockRestore()
    for (const collection of ['payload-jobs', 'training-sessions', 'enrollments', 'modules', 'cohorts'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await Promise.all(
      Object.values(seeded).map((u) => payload.delete({ collection: 'users', id: u.id, overrideAccess: true })),
    )
  })

  async function setUp(name: string, scheduledDate: Date) {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name,
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
      },
      overrideAccess: true,
    })
    const trainingModule = await payload.create({
      collection: 'modules',
      data: { track: 'ict', name: `${name} module` },
      overrideAccess: true,
    })
    for (const intern of [seeded.internA, seeded.internB]) {
      await payload.create({
        collection: 'enrollments',
        data: { intern: intern.id, cohort: cohort.id, track: 'ict' as const, outcome: 'in-progress' as const },
        overrideAccess: true,
      })
    }
    const session = await payload.create({
      collection: 'training-sessions',
      data: {
        module: trainingModule.id,
        trainer: seeded.trainer.id,
        cohort: cohort.id,
        scheduledDate: scheduledDate.toISOString(),
        status: 'scheduled' as const,
      },
      overrideAccess: true,
    })
    return { cohort, module: trainingModule, session }
  }

  async function reminderJobsFor(sessionId: number) {
    const jobs = await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'sendSessionReminder' } },
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    return jobs.docs.filter((job) => (job.input as { sessionId?: number })?.sessionId === sessionId)
  }

  async function latestReminderJob(sessionId: number, reason: 'reminder' | 'rescheduled' = 'reminder') {
    const jobs = await reminderJobsFor(sessionId)
    return jobs.find((job) => (job.input as { reason?: string })?.reason === reason)
  }

  it('queues a reminder job for ~2 hours before the scheduled time when a session is created', async () => {
    const scheduledDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days out
    const { session } = await setUp('Reminder Queue Test', scheduledDate)

    const job = await latestReminderJob(session.id)
    expect(job).toBeDefined()
    expect((job!.input as { reason?: string }).reason).toBe('reminder')
    expect(job!.waitUntil).toBeTruthy()

    const expectedWaitUntil = scheduledDate.getTime() - 2 * 60 * 60 * 1000
    expect(Math.abs(new Date(job!.waitUntil!).getTime() - expectedWaitUntil)).toBeLessThan(5000)
  })

  it('running the reminder job emails every in-progress enrolled intern and marks reminderStatus sent', async () => {
    // Scheduled soon enough that the 2-hours-before window is already in
    // the past, so the queued job has no waitUntil and is immediately due.
    const scheduledDate = new Date(Date.now() + 5 * 60 * 1000)
    const { session } = await setUp('Reminder Send Test', scheduledDate)

    const job = await latestReminderJob(session.id)
    expect(job!.waitUntil).toBeFalsy()

    await payload.jobs.runByID({ id: job!.id, overrideAccess: true })

    expect(sendEmailSpy).toHaveBeenCalledTimes(2)
    const recipients = sendEmailSpy.mock.calls
      .map((call: unknown[]) => (call[0] as { to: string }).to)
      .sort()
    expect(recipients).toEqual([seeded.internA.email, seeded.internB.email].sort())
    expect((sendEmailSpy.mock.calls[0][0] as { subject: string }).subject).toMatch(/^Reminder:/)

    const updated = await payload.findByID({ collection: 'training-sessions', id: session.id, overrideAccess: true })
    expect(updated.reminderStatus).toBe('sent')
  })

  it('rescheduling before any reminder was sent reschedules the job without emailing anyone yet', async () => {
    const originalDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const { session } = await setUp('Reschedule Before Send Test', originalDate)

    const newDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    await payload.update({
      collection: 'training-sessions',
      id: session.id,
      data: { scheduledDate: newDate.toISOString() },
      overrideAccess: true,
    })

    expect(sendEmailSpy).not.toHaveBeenCalled()

    const job = await latestReminderJob(session.id)
    const expectedWaitUntil = newDate.getTime() - 2 * 60 * 60 * 1000
    expect(Math.abs(new Date(job!.waitUntil!).getTime() - expectedWaitUntil)).toBeLessThan(5000)
  })

  it('rescheduling after interns were already notified sends an immediate re-notification and re-arms the reminder', async () => {
    const scheduledDate = new Date(Date.now() + 5 * 60 * 1000)
    const { session } = await setUp('Reschedule After Send Test', scheduledDate)

    const firstJob = await latestReminderJob(session.id)
    await payload.jobs.runByID({ id: firstJob!.id, overrideAccess: true })
    expect(sendEmailSpy).toHaveBeenCalledTimes(2)
    sendEmailSpy.mockClear()

    const newDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
    await payload.update({
      collection: 'training-sessions',
      id: session.id,
      data: { scheduledDate: newDate.toISOString() },
      overrideAccess: true,
    })

    const updated = await payload.findByID({ collection: 'training-sessions', id: session.id, overrideAccess: true })
    expect(updated.reminderStatus).toBe('pending')

    // The "rescheduled" notice is queued for immediate pickup (no
    // waitUntil delay), not sent inline from the hook — same as every
    // other reminder job, so a slow mail provider never blocks the
    // request that rescheduled the session.
    const rescheduledJob = await latestReminderJob(session.id, 'rescheduled')
    expect(rescheduledJob).toBeDefined()
    expect(rescheduledJob!.waitUntil).toBeFalsy()

    await payload.jobs.runByID({ id: rescheduledJob!.id, overrideAccess: true })
    expect(sendEmailSpy).toHaveBeenCalledTimes(2)
    expect((sendEmailSpy.mock.calls[0][0] as { subject: string }).subject).toMatch(/^Rescheduled:/)

    const newReminderJob = await latestReminderJob(session.id, 'reminder')
    const expectedWaitUntil = newDate.getTime() - 2 * 60 * 60 * 1000
    expect(Math.abs(new Date(newReminderJob!.waitUntil!).getTime() - expectedWaitUntil)).toBeLessThan(5000)
  })

  it('a cancelled session never sends its reminder even if the job is forced to run', async () => {
    const scheduledDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const { session } = await setUp('Cancelled Session Test', scheduledDate)
    const job = await latestReminderJob(session.id)

    await payload.update({
      collection: 'training-sessions',
      id: session.id,
      data: { status: 'cancelled' },
      overrideAccess: true,
    })

    await payload.jobs.runByID({ id: job!.id, overrideAccess: true })
    expect(sendEmailSpy).not.toHaveBeenCalled()
  })
})
