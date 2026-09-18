import type { CollectionConfig } from 'payload'

export const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'track'],
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
