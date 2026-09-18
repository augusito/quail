import type { CollectionConfig } from 'payload'

// §6.5: normally supervisor-authored. The driving-skills checkpoint
// (driver track only, baseline + pre-graduation) is a confirmed exception —
// trainer-authored instead.
export const Evaluations: CollectionConfig = {
  slug: 'evaluations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'cohort', 'type', 'author'],
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Supervisor for standard evaluations; trainer for driving-skills checkpoints (§6.5).',
      },
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Driving Skills — Baseline', value: 'driving-skills-baseline' },
        { label: 'Driving Skills — Final', value: 'driving-skills-final' },
      ],
    },
    {
      name: 'criteria',
      type: 'textarea',
    },
    {
      name: 'outcome',
      type: 'textarea',
    },
  ],
}
