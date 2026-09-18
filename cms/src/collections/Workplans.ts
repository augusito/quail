import type { CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, isAdmin } from '../access/roles'

// §4 "Submit workplans & evaluations": Supervisor only (own). Not granted
// to interns in the matrix, even though the workplan is about them.
export const Workplans: CollectionConfig = {
  slug: 'workplans',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['supervisor', 'intern', 'cohort'],
  },
  access: {
    create: adminOrRoleOwnsField('supervisor', 'supervisor'),
    read: adminOrRoleOwnsField('supervisor', 'supervisor'),
    update: adminOrRoleOwnsField('supervisor', 'supervisor'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'supervisor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
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
      required: true,
    },
    {
      name: 'content',
      type: 'textarea',
    },
  ],
}
