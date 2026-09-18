import type { CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, isAdmin, isAuthenticated } from '../access/roles'

// §6.3: reminder sent 2 hours before the scheduled session; a reschedule
// after interns are notified must trigger an automatic re-notification.
// §4 "Pick training dates": Admin (any), Trainer (own modules only).
// Deleting a session isn't a granted capability for trainers — they
// reschedule/cancel via the status field instead, which update access covers.
export const TrainingSessions: CollectionConfig = {
  slug: 'training-sessions',
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
