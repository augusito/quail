import type { Access, CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, hasRole, isAdmin } from '../access/roles'
import { isSessionOwnedByTrainer } from '../access/scoping'

// Per-session deliverables: slide deck, prose write-up, the assignment
// given to interns, and an end-of-module assessment report.
// Post module notes/scores: Admin (view all), Trainer (own modules
// only — scoped here via the `trainer` field on the note itself). Not
// granted to interns/supervisors.
//
// Renamed from `ModuleNote` to `Note`.
const createAccess: Access = async ({ req: { user, payload }, data }) => {
  if (hasRole(user, 'admin')) return true
  if (!hasRole(user, 'trainer')) return false
  if (data?.trainer !== user!.id || data?.session === undefined) return false
  // Self-attributing `trainer` isn't enough on its own — the named
  // `session` must actually be one this trainer teaches.
  return isSessionOwnedByTrainer(payload, user!.id, data.session)
}

export const Note: CollectionConfig = {
  slug: 'notes',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['session', 'trainer'],
  },
  access: {
    create: createAccess,
    read: adminOrRoleOwnsField('trainer', 'trainer'),
    update: adminOrRoleOwnsField('trainer', 'trainer'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'session',
      type: 'relationship',
      relationTo: 'sessions',
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
        description: 'End-of-module assessment report (25 questions: 15 MCQ, 5 true/false, 1 case study worth 5 structured questions).',
      },
    },
  ],
}
