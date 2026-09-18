import type { CollectionConfig } from 'payload'

// §6.5: once a module completes and its score is finalized, the intern can
// see that module's score immediately, rather than waiting for cohort end.
export const Scores: CollectionConfig = {
  slug: 'scores',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'module', 'value', 'finalized'],
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'modules',
      required: true,
    },
    {
      name: 'value',
      type: 'number',
      required: true,
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'finalized',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Controls whether the intern can see this score yet (§6.5).',
      },
    },
  ],
}
