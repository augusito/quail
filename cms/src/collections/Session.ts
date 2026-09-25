import type { CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, isAdmin, isAuthenticated } from '../access/roles'
import { resetReminderStatusOnReschedule, scheduleSessionReminder } from '../hooks/sessionReminders'

// §6.3: reminder sent 2 hours before the scheduled session; a reschedule
// after interns are notified must trigger an automatic re-notification.
// See src/hooks/sessionReminders.ts and src/jobs/sendSessionReminder.ts.
// §4 "Pick training dates": Admin (any), Trainer (own modules only).
// Deleting a session isn't a granted capability for trainers — they
// reschedule/cancel via the status field instead, which update access covers.
//
// Renamed from `TrainingSession` to `Session` per proposal v2's §5 naming
// notes: confirmed to keep the single-word name despite the collision with
// "session" as a login/auth concept (including Payload's own internal use
// of the word) — the two sit in clearly different parts of the codebase (a
// `sessions` collection vs. Payload's internal auth session) and won't be
// confused in practice.
export const Session: CollectionConfig = {
  slug: 'sessions',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['module', 'trainer', 'cohort', 'scheduledDate', 'status'],
  },
  access: {
    create: adminOrRoleOwnsField('trainer', 'trainer'),
    read: isAuthenticated,
    update: adminOrRoleOwnsField('trainer', 'trainer'),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [resetReminderStatusOnReschedule],
    afterChange: [scheduleSessionReminder],
  },
  fields: [
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'modules',
      required: true,
    },
    {
      name: 'trainer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
    },
    {
      name: 'scheduledDate',
      type: 'date',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Completed', value: 'completed' },
        { label: 'Rescheduled', value: 'rescheduled' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'reminderStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sent', value: 'sent' },
      ],
    },
  ],
}
