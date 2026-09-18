import type { CollectionConfig } from 'payload'

import { isAdmin, isAuthenticated } from '../access/roles'

// Curriculum reference data — not explicitly assigned to a role in §4, so
// treated as admin-managed like Cohorts, readable by anyone authenticated
// who needs to reference it (trainers scheduling sessions, interns viewing
// their track).
export const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'track'],
  },
  access: {
    create: isAdmin,
    read: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'track',
      type: 'select',
      required: true,
      options: [
        { label: 'Truck Driving', value: 'truck-driving' },
        { label: 'Automotive Mechanics', value: 'mechanics' },
        { label: 'ICT', value: 'ict' },
        { label: 'Supply Chain', value: 'supply-chain' },
        { label: 'Business Management', value: 'business-management' },
      ],
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'curriculumReference',
      type: 'text',
    },
  ],
}
