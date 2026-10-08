import type { CollectionConfig } from 'payload'

import { adminOnlyField, adminOrRoleOwnsField, isAdmin, isAuthenticated } from '../access/roles'
import { resetReminderStatusOnReschedule, scheduleSessionReminder } from '../hooks/sessionReminders'

// Reminder sent 2 hours before the scheduled session; a reschedule
// after interns are notified must trigger an automatic re-notification.
// See src/hooks/sessionReminders.ts and src/jobs/sendSessionReminder.ts.
// "Pick training dates": Admin (any), Trainer (own modules only).
// Deleting a session isn't a granted capability for trainers — they
// reschedule/cancel via the status field instead, which update access covers.
//
// Renamed from `TrainingSession` to `Session`: confirmed to keep the
// single-word name despite the collision with "session" as a login/auth
// concept (including Payload's own internal use of the word) — the two sit
// in clearly different parts of the codebase (a `sessions` collection vs.
// Payload's internal auth session) and won't be confused in practice.
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
      // Job-managed state (src/hooks/sessionReminders.ts,
      // src/jobs/sendSessionReminder.ts both write it via
      // overrideAccess/hooks, which aren't subject to field access) — not
      // something a trainer should be able to set by hand on their own
      // session and use to suppress the real reminder job.
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sent', value: 'sent' },
      ],
    },
  ],
}
