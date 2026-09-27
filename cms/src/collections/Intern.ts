import type { CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, adminOrRoleOwnsFieldOnCreate, isAdmin } from '../access/roles'

// §5/§6.2 (proposal v2): intern profile data collected at self-registration
// — additive to `Users`, same reasoning as `Trainer.ts`. Every existing
// collection that references "intern" (Enrollments, Documents, Scores,
// Evaluations, Workplans, Logbooks, Alumnae, ...) keeps relating to `users`.
//
// §7 sensitive fields (dateOfBirth, nationalIdNumber, kraPin, shifNumber,
// nssfNumber): same reasoning as Trainer.ts — row-level access already
// limits reads to admin or the intern themself; the export-exclusion in
// src/exports/registry.ts is what actually satisfies "not exposed in bulk
// exports". Not referenced at all by the public Talent Board (`Alumna`
// only links back to `users`, never to this collection), so no exposure
// risk there either.
export const Intern: CollectionConfig = {
  slug: 'interns',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'nationality', 'phone'],
  },
  access: {
    create: adminOrRoleOwnsFieldOnCreate('intern', 'user'),
    read: adminOrRoleOwnsField('intern', 'user'),
    update: adminOrRoleOwnsField('intern', 'user'),
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
        description: 'The intern\'s login account. Set once at self-registration (§6.2).',
      },
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'dateOfBirth',
      type: 'date',
      required: true,
      admin: {
        description:
          'Statutory/records purposes only — no minimum-age gate is enforced at registration (§6.2, confirmed not needed for v1).',
      },
    },
    {
      name: 'gender',
      type: 'select',
      required: true,
      options: [
        { label: 'Female', value: 'female' },
        { label: 'Male', value: 'male' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'nationality', type: 'text', required: true },
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
    {
      name: 'shifNumber',
      type: 'text',
      required: true,
      admin: { description: 'SHIF (formerly SHA) number (§5, §6.2, §7 — sensitive).' },
    },
    {
      name: 'nssfNumber',
      type: 'text',
      required: true,
      admin: { description: 'NSSF number (§5, §6.2, §7 — sensitive).' },
    },
    {
      name: 'nextOfKin',
      type: 'group',
      admin: {
        description:
          '"Exactly one required contact" (§5) — a single next-of-kin record, not a repeatable list. Name/relationship/phone are the load-bearing fields required to actually reach someone; address/email are collected when available but not required, same judgment call as the optional email/phone on the public Talent Board listing (§6.9).',
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'relationship', type: 'text', required: true },
        { name: 'address', type: 'text' },
        { name: 'phone', type: 'text', required: true },
        { name: 'email', type: 'email' },
      ],
    },
  ],
}
