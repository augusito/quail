import type { CollectionConfig } from 'payload'

// §6.4 per-session deliverables: slide deck, prose write-up, the assignment
// given to interns, and an end-of-module assessment report.
export const ModuleNotes: CollectionConfig = {
  slug: 'module-notes',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['session', 'trainer'],
  },
  fields: [
    {
      name: 'session',
      type: 'relationship',
      relationTo: 'training-sessions',
      required: true,
    },
    {
      name: 'trainer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'content',
      type: 'textarea',
      admin: {
        description: 'Prose write-up of what was taught.',
      },
    },
    {
      name: 'slideDeck',
      type: 'relationship',
      relationTo: 'files',
    },
    {
      name: 'assignment',
      type: 'relationship',
      relationTo: 'files',
    },
    {
      name: 'assessmentReport',
      type: 'relationship',
      relationTo: 'files',
      admin: {
        description: 'End-of-module assessment report (25 questions: 15 MCQ, 5 true/false, 1 case study worth 5 structured questions — §6.4).',
      },
    },
  ],
}
