import type { CollectionConfig } from 'payload'

export const Workplans: CollectionConfig = {
  slug: 'workplans',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['supervisor', 'intern', 'cohort'],
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
