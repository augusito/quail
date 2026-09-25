import type { TaskConfig } from 'payload'

type Input = {
  reason: 'reminder' | 'rescheduled'
  scheduledDateAtQueueTime: string
  sessionId: number
}

type Output = {
  recipientCount: number
  skippedReason?: 'already-sent' | 'cancelled' | 'no-recipients' | 'not-found' | 'superseded'
}

// §6.3: "Reminder timing: 2 hours before session." / "A trainer can
// reschedule after interns are already notified, and that should trigger
// an automatic re-notification."
//
// Rather than tracking and cancelling stale queued jobs when a session is
// rescheduled, scheduleSessionReminder (src/hooks/sessionReminders.ts)
// just queues a fresh, correctly-targeted job every time scheduledDate
// changes and leaves any earlier job for the old time sitting in the
// queue. This task detects that it's one of those superseded leftovers by
// comparing the scheduledDate it was queued against (captured in its
// input) to the session's *current* scheduledDate — a mismatch means a
// newer job already covers this session, so it's a safe no-op.
export const sendSessionReminderTask: TaskConfig<{ input: Input; output: Output }> = {
  slug: 'sendSessionReminder',
  label: 'Send training session reminder',
  inputSchema: [
    { name: 'sessionId', type: 'number', required: true },
    { name: 'scheduledDateAtQueueTime', type: 'date', required: true },
    {
      name: 'reason',
      type: 'select',
      required: true,
      defaultValue: 'reminder',
      options: [
        { label: 'Upcoming session reminder', value: 'reminder' },
        { label: 'Session rescheduled', value: 'rescheduled' },
      ],
    },
  ],
  outputSchema: [
    { name: 'recipientCount', type: 'number' },
    { name: 'skippedReason', type: 'text' },
  ],
  retries: 2,
  handler: async ({ input, req }) => {
    const { payload } = req

    const session = await payload.findByID({
      collection: 'sessions',
      id: input.sessionId,
      depth: 1,
      overrideAccess: true,
    })
    if (!session) {
      return { output: { recipientCount: 0, skippedReason: 'not-found' } }
    }
    if (session.status === 'cancelled') {
      return { output: { recipientCount: 0, skippedReason: 'cancelled' } }
    }
    if (
      input.reason === 'reminder' &&
      new Date(session.scheduledDate).getTime() !== new Date(input.scheduledDateAtQueueTime).getTime()
    ) {
      return { output: { recipientCount: 0, skippedReason: 'superseded' } }
    }
    if (input.reason === 'reminder' && session.reminderStatus === 'sent') {
      return { output: { recipientCount: 0, skippedReason: 'already-sent' } }
    }

    const cohortId = typeof session.cohort === 'object' ? session.cohort.id : session.cohort
    const enrollments = await payload.find({
      collection: 'enrollments',
      where: { and: [{ cohort: { equals: cohortId } }, { outcome: { equals: 'in-progress' } }] },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    const internIds = [...new Set(enrollments.docs.map((e) => e.intern))]

    if (internIds.length === 0) {
      return { output: { recipientCount: 0, skippedReason: 'no-recipients' } }
    }

    const interns = await payload.find({
      collection: 'users',
      where: { id: { in: internIds } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    const moduleDoc = typeof session.module === 'object' ? session.module : null
    const trainerDoc = typeof session.trainer === 'object' ? session.trainer : null
    const moduleName = moduleDoc?.name ?? 'your session'
    const trainerName = trainerDoc?.name || trainerDoc?.email || 'your trainer'
    const when = new Date(session.scheduledDate).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const subject =
      input.reason === 'rescheduled'
        ? `Rescheduled: ${moduleName} is now on ${when}`
        : `Reminder: ${moduleName} starts at ${when}`
    const text =
      input.reason === 'rescheduled'
        ? `Your session "${moduleName}" with ${trainerName} has been rescheduled. It's now on ${when}.`
        : `This is a reminder that your session "${moduleName}" with ${trainerName} starts at ${when} (in about 2 hours).`

    const recipients = interns.docs.filter((intern) => Boolean(intern.email))
    await Promise.all(recipients.map((intern) => payload.sendEmail({ to: intern.email, subject, text })))

    if (input.reason === 'reminder') {
      await payload.update({
        collection: 'sessions',
        id: input.sessionId,
        data: { reminderStatus: 'sent' },
        overrideAccess: true,
        req,
      })
    }

    return { output: { recipientCount: recipients.length } }
  },
}
