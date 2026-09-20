import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from 'payload'

import type { TrainingSession } from '../payload-types'

const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000

/**
 * Resets reminderStatus to "pending" whenever scheduledDate changes, so the
 * reminder job queued by scheduleSessionReminder below (for the *new* time)
 * doesn't immediately skip itself on the "already sent" check in
 * src/jobs/sendSessionReminder.ts. Runs in beforeChange (mutating this same
 * write) rather than a follow-up update, so it can't trigger the afterChange
 * hook a second time.
 */
export const resetReminderStatusOnReschedule: CollectionBeforeChangeHook<TrainingSession> = ({
  data,
  originalDoc,
  operation,
}) => {
  if (
    operation === 'update' &&
    originalDoc &&
    data.scheduledDate &&
    new Date(data.scheduledDate).getTime() !== new Date(originalDoc.scheduledDate).getTime()
  ) {
    data.reminderStatus = 'pending'
  }
  return data
}

/**
 * §6.3: queues the "sendSessionReminder" job (src/jobs/sendSessionReminder.ts)
 * for 2 hours before a session's scheduledDate, and — "a trainer can
 * reschedule after interns are already notified, and that should trigger
 * an automatic re-notification" — queues an immediate "rescheduled" email
 * too when a reschedule happens after the original reminder already went
 * out.
 *
 * Queues (rather than sends inline) so a slow email provider never blocks
 * the request that created/rescheduled the session, and so retries are
 * Payload's job-queue retry, not ours to hand-roll.
 */
export const scheduleSessionReminder: CollectionAfterChangeHook<TrainingSession> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (doc.status === 'cancelled' || doc.status === 'completed') return doc

  const scheduledDateChanged =
    operation === 'update' &&
    previousDoc &&
    new Date(previousDoc.scheduledDate).getTime() !== new Date(doc.scheduledDate).getTime()
  // doc.status is guaranteed not 'cancelled' here by the early return above.
  const unCancelled = operation === 'update' && previousDoc?.status === 'cancelled'
  const alreadyNotified = previousDoc?.reminderStatus === 'sent'

  if (operation !== 'create' && !scheduledDateChanged && !unCancelled) return doc

  const targetTime = new Date(doc.scheduledDate).getTime() - REMINDER_LEAD_MS
  await req.payload.jobs.queue({
    task: 'sendSessionReminder',
    input: { sessionId: doc.id, reason: 'reminder', scheduledDateAtQueueTime: doc.scheduledDate },
    waitUntil: targetTime > Date.now() ? new Date(targetTime) : undefined,
    req,
  })

  if (scheduledDateChanged && alreadyNotified) {
    await req.payload.jobs.queue({
      task: 'sendSessionReminder',
      input: { sessionId: doc.id, reason: 'rescheduled', scheduledDateAtQueueTime: doc.scheduledDate },
      req,
    })
  }

  return doc
}
