import type { Access, AccessResult, CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, hasRole, isAdmin } from '../access/roles'

const readAccess: Access = ({ req: { user } }): AccessResult => {
  if (hasRole(user, 'admin')) return true
  if (hasRole(user, 'intern')) {
    return { or: [{ optedIn: { equals: true } }, { intern: { equals: user!.id } }] }
  }
  // Public (and any other authenticated role): Talent Board view, opted-in only.
  return { optedIn: { equals: true } }
}

// §6.9 Talent Board + §6.10 Alumni Hub. Talent Board eligibility is limited
// to actual graduates (not resigned/non-completing alumni) — check the
// linked intern's Enrollment.outcome (§6.1) before surfacing optedIn
// profiles publicly. Employers contact admin as intermediary; this is not a
// messaging surface (§6.9).
//
// §4: "View talent board" — Admin (all), Public (✅, view-only). "Edit own
// talent board listing" — Admin, Intern (own, post-graduation opt-in).
// Public/anonymous read is scoped to optedIn profiles only; the intern
// still needs to read their own profile pre-opt-in to edit it.
export const AlumniProfiles: CollectionConfig = {
  slug: 'alumni-profiles',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'optedIn'],
  },
  access: {
    create: adminOrRoleOwnsField('intern', 'intern'),
    read: readAccess,
    update: adminOrRoleOwnsField('intern', 'intern'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'photo',
      type: 'relationship',
      relationTo: 'media',
    },
    {
      name: 'employmentStatus',
      type: 'text',
    },
    {
      name: 'courses',
      type: 'array',
      admin: {
        description: 'Driving class certifications, defensive driving certification, diploma/course names and issuing institutions (§6.9).',
      },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      name: 'workExperience',
      type: 'array',
      fields: [{ name: 'description', type: 'text', required: true }],
    },
    {
      name: 'bio',
      type: 'textarea',
      admin: {
        description: 'Narrative skills/ability summary: soft skills, technical skills gained, notable achievements (§6.9).',
      },
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'optedIn',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Opt-in step at graduation for appearing on the public Talent Board; self-service, can be withdrawn at any time (§6.9).',
      },
    },
  ],
}
