import type { CollectionConfig } from 'payload'

import { hasRole, isAdmin, roleOnlyField } from '../access/roles'
import { getSupervisedInternIds } from '../access/scoping'

// §6.6: driver and non-driver logbooks have different field structures.
// The driver track also has a supervisor/"Mentor" rollup log alongside the
// intern's own per-trip entries — modeled here as author = 'supervisor'
// records distinguished in the UI as "Supervisor observations", rather than
// a separate collection (§4, §6.6).
//
// §4: "Update own logbook" — Intern only (own entries). "Review/comment on
// logbooks" — Admin (all), Supervisor (assigned interns only, via
// Enrollment.supervisor). Trainer has no logbook access in the matrix.
export const LogbookEntries: CollectionConfig = {
  slug: 'logbook-entries',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'type', 'author', 'status'],
  },
  access: {
    create: async ({ req: { user, payload }, data }) => {
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'intern')) return data?.intern === user!.id
      if (hasRole(user, 'supervisor')) {
        const internIds = await getSupervisedInternIds(payload, user!.id)
        return internIds.some((id) => id === data?.intern)
      }
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
      name: 'author',
      type: 'select',
      required: true,
      defaultValue: 'self',
      options: [
        { label: 'Intern (self)', value: 'self' },
        { label: 'Supervisor', value: 'supervisor' },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    // Driver logbook — intern's own per-trip entries (§6.6)
    {
      name: 'trip',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'driver' && siblingData?.author === 'self',
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
    // Driver logbook — supervisor/"Mentor" rollup (§6.6)
    {
      name: 'supervisorRollup',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'driver' && siblingData?.author === 'supervisor',
      },
      fields: [
        { name: 'distanceDriven', type: 'number' },
        { name: 'areaRegion', type: 'text' },
        { name: 'areasOfImprovement', type: 'textarea' },
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
