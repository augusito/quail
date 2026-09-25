import type { CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, adminOrRoleOwnsFieldOnCreate, isAdmin } from '../access/roles'

// §5/§6.2 (proposal v2): trainer profile data collected at self-registration
// — additive to `Users` (which stays the auth/role anchor for every role,
// including admin/supervisor) rather than replacing it. Every existing
// collection that references "trainer" (Contracts, Sessions, Notes, Scores,
// Evaluations, MediaAssets, ...) keeps relating to `users`, not this
// collection — this only holds the richer profile fields §6.2 asks to
// collect, one row per trainer `User`.
//
// §7 "sensitive personal data" (nationalIdNumber, kraPin): row-level access
// already limits reads to admin or the trainer themself (no other role is
// granted "Register/manage own profile" for someone else's row, §4), so the
// only realistic extra exposure surface is bulk export — handled by simply
// not including these fields in the `trainers` export definition
// (src/exports/registry.ts), rather than a redundant field-level access
// restriction that wouldn't change any actual reader's access.
export const Trainer: CollectionConfig = {
  slug: 'trainers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'occupation', 'phone'],
  },
  access: {
    create: adminOrRoleOwnsFieldOnCreate('trainer', 'user'),
    read: adminOrRoleOwnsField('trainer', 'user'),
    update: adminOrRoleOwnsField('trainer', 'user'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: 'The trainer\'s login account. Set once at self-registration (§6.2).',
      },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'occupation', type: 'text', required: true },
    { name: 'address', type: 'text' },
    { name: 'phone', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    {
      name: 'nationalIdNumber',
      type: 'text',
      required: true,
      admin: { description: 'National identifier or passport number (§5, §6.2, §7 — sensitive).' },
    },
    { name: 'kraPin', type: 'text', required: true, admin: { description: 'KRA PIN (§5, §6.2, §7 — sensitive).' } },
  ],
}
