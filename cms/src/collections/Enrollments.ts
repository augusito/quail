import type { CollectionConfig } from 'payload'

// Links Intern ↔ Cohort ↔ Track (§5). outcome captures the §6.1
// non-completion paths: Termination (account closed, no Alumni Hub) vs.
// Resignation (moves to Alumni Hub, flagged separately from graduates so
// Talent Board eligibility can be limited to actual graduates).
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'cohort', 'track', 'outcome'],
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
      required: true,
    },
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
      name: 'outcome',
      type: 'select',
      defaultValue: 'in-progress',
      options: [
        { label: 'In Progress', value: 'in-progress' },
        { label: 'Graduated', value: 'graduated' },
        { label: 'Resigned', value: 'resigned' },
        { label: 'Terminated', value: 'terminated' },
      ],
    },
  ],
}
