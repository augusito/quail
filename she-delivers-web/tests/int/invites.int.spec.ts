import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

let payload: Payload
let sendEmailSpy: ReturnType<typeof vi.spyOn>

let admin: User

describe('Invite emails', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    sendEmailSpy = vi.spyOn(payload, 'sendEmail')

    admin = await payload.create({
      collection: 'users',
      data: { email: 'invites-admin@test.dev', password: 'test1234', role: 'admin' as const, status: 'active' as const },
    })
  })

  afterEach(() => {
    sendEmailSpy.mockClear()
  })

  afterAll(async () => {
    sendEmailSpy.mockRestore()
    for (const collection of ['payload-jobs', 'invites', 'cohorts'] as const) {
      await payload.delete({ collection, where: {}, overrideAccess: true })
    }
    await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true })
  })

  async function latestInviteJob(inviteId: number) {
    const jobs = await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'sendInviteEmail' } },
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    return jobs.docs.find((job) => (job.input as { inviteId?: number })?.inviteId === inviteId)
  }

  it('queues an invite-email job (not sent inline) when a trainer invite is created', async () => {
    const invite = await payload.create({
      collection: 'invites',
      data: { role: 'trainer', email: 'new-trainer@test.dev', status: 'sent' },
      overrideAccess: true,
    })

    expect(sendEmailSpy).not.toHaveBeenCalled()
    const job = await latestInviteJob(invite.id)
    expect(job).toBeDefined()
    expect(job!.waitUntil).toBeFalsy()
  })

  it('running the queued job emails the invited address with the registration link', async () => {
    const cohort = await payload.create({
      collection: 'cohorts',
      data: {
        name: 'Invite Email Cohort',
        tracks: ['ict' as const],
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        status: 'open' as const,
      },
      overrideAccess: true,
    })
    const invite = await payload.create({
      collection: 'invites',
      data: { role: 'intern', email: 'new-intern@test.dev', cohort: cohort.id, track: 'ict', status: 'sent' },
      overrideAccess: true,
    })

    const job = await latestInviteJob(invite.id)
    await payload.jobs.runByID({ id: job!.id, overrideAccess: true })

    expect(sendEmailSpy).toHaveBeenCalledTimes(1)
    const call = sendEmailSpy.mock.calls[0][0] as { to: string; subject: string; text: string }
    expect(call.to).toBe('new-intern@test.dev')
    expect(call.text).toContain(`/register?token=${invite.token}`)
  })

  it('a revoked invite is left unsent if the job runs after the revoke', async () => {
    const invite = await payload.create({
      collection: 'invites',
      data: { role: 'trainer', email: 'revoked-trainer@test.dev', status: 'sent' },
      overrideAccess: true,
    })
    const job = await latestInviteJob(invite.id)

    await payload.update({ collection: 'invites', id: invite.id, data: { status: 'revoked' }, overrideAccess: true })
    await payload.jobs.runByID({ id: job!.id, overrideAccess: true })

    expect(sendEmailSpy).not.toHaveBeenCalled()
  })

  it('a failed send is logged and does not throw, so the invite record is unaffected', async () => {
    sendEmailSpy.mockRejectedValueOnce(new Error('SMTP2GO rejected the message'))
    const loggerErrorSpy = vi.spyOn(payload.logger, 'error').mockImplementation(() => payload.logger)

    const invite = await payload.create({
      collection: 'invites',
      data: { role: 'trainer', email: 'bounces@test.dev', status: 'sent' },
      overrideAccess: true,
    })
    const job = await latestInviteJob(invite.id)

    await expect(payload.jobs.runByID({ id: job!.id, overrideAccess: true })).resolves.not.toThrow()
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('bounces@test.dev'))

    const stillSent = await payload.findByID({ collection: 'invites', id: invite.id, overrideAccess: true })
    expect(stillSent.status).toBe('sent')

    loggerErrorSpy.mockRestore()
  })
})
