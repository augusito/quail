import type { CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, isAdmin } from '../access/roles'

// §6.4 per-session deliverables: slide deck, prose write-up, the assignment
// given to interns, and an end-of-module assessment report.
// §4 "Post module notes/scores": Admin (view all), Trainer (own modules
// only — scoped here via the `trainer` field on the note itself). Not
// granted to interns/supervisors in the matrix.
export const ModuleNotes: CollectionConfig = {
  slug: 'module-notes',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['session', 'trainer'],
  },
  access: {
    create: adminOrRoleOwnsField('trainer', 'trainer'),
    read: adminOrRoleOwnsField('trainer', 'trainer'),
    update: adminOrRoleOwnsField('trainer', 'trainer'),
    delete: isAdmin,
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
