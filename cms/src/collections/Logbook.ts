import type { CollectionConfig } from 'payload'

import { hasRole, isAdmin, roleOnlyField } from '../access/roles'
import { getSupervisedInternIds } from '../access/scoping'

// §6.6 (proposal v2): "The sample driver logbook's second sheet ('Mentor
// Driver' — distance driven, area, areas of improvement per intern) is
// dropped: not needed, so it's out of the model. Each intern keeps a
// single logbook, self-authored, with the Supervisor reviewing and
// commenting (§4) — no separate rollup log." This drops the `author` field
// and the supervisor-authored rollup entries v1 modeled here — a
// supervisor no longer creates Logbook rows at all, only reviews/comments
// on the intern's own entries via `supervisorComment`.
//
// §4: "Update own logbook" — Intern only (own entries). "Review/comment on
// logbooks" — Admin (all), Supervisor (assigned interns only, via
// Enrollment.supervisor). Trainer has no logbook access in the matrix.
//
// Renamed from `LogbookEntry` to `Logbook` per proposal v2's §5 naming
// notes.
export const Logbook: CollectionConfig = {
  slug: 'logbooks',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'type', 'status'],
  },
  access: {
    create: async ({ req: { user }, data }) => {
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'intern')) return data?.intern === user!.id
      return false
    },
    read: async ({ req: { user, payload } }) => {
      if (!user) return false
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'intern')) return { intern: { equals: user.id } }
      if (hasRole(user, 'supervisor')) {
        const internIds = await getSupervisedInternIds(payload, user.id)
        return { intern: { in: internIds } }
      }
      return false
    },
    update: async ({ req: { user, payload } }) => {
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'intern')) return { intern: { equals: user!.id } }
      if (hasRole(user, 'supervisor')) {
        const internIds = await getSupervisedInternIds(payload, user!.id)
        return { intern: { in: internIds } }
      }
      return false
    },
    delete: isAdmin,
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Driver', value: 'driver' },
        { label: 'Non-Driver', value: 'non-driver' },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    // Driver logbook — per-trip entries (§6.6)
    {
      name: 'trip',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'driver',
      },
      fields: [
        { name: 'area', type: 'text' },
        { name: 'kmsDriven', type: 'number' },
        { name: 'timeFrom', type: 'text' },
        { name: 'timeTo', type: 'text' },
        {
          name: 'activities',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Dispatch', value: 'dispatch' },
            { label: 'Offloading', value: 'offloading' },
            { label: 'Fueling', value: 'fueling' },
            { label: 'Checkpoint', value: 'checkpoint' },
          ],
        },
        { name: 'lessons', type: 'textarea' },
      ],
    },
    // Non-driver logbook — per-week entries (§6.6)
    {
      name: 'week',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'non-driver',
      },
      fields: [
        { name: 'startDate', type: 'date' },
        { name: 'endDate', type: 'date' },
        { name: 'projectAssigned', type: 'text' },
        { name: 'activitiesAndResources', type: 'textarea' },
        { name: 'notes', type: 'textarea' },
      ],
    },
    {
      name: 'supervisorComment',
      type: 'textarea',
      access: {
        create: roleOnlyField('admin', 'supervisor'),
        update: roleOnlyField('admin', 'supervisor'),
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Reviewed', value: 'reviewed' },
      ],
    },
  ],
}
