import type { CollectionConfig } from 'payload'

// §6.1: a cohort can run multiple tracks in parallel. Closing is a
// deliberate admin-confirmed action, not automatic on end date — see the
// closing-checklist validation to be added alongside this collection.
export const Cohorts: CollectionConfig = {
  slug: 'cohorts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'startDate', 'endDate'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'tracks',
      type: 'select',
      required: true,
      hasMany: true,
      options: [
        { label: 'Truck Driving', value: 'truck-driving' },
        { label: 'Automotive Mechanics', value: 'mechanics' },
        { label: 'ICT', value: 'ict' },
        { label: 'Supply Chain', value: 'supply-chain' },
        { label: 'Business Management', value: 'business-management' },
      ],
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Open', value: 'open' },
        { label: 'Active', value: 'active' },
        { label: 'Closed', value: 'closed' },
      ],
    },
  ],
}
