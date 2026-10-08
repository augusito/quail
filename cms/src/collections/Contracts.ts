import type { CollectionConfig } from 'payload'

import { adminOnlyField, adminOrRoleOwnsField, isAdmin } from '../access/roles'
import { validateContractStatusTransition } from '../hooks/contractLifecycle'

// Admin uploads contract terms; the trainer downloads, signs, and
// re-uploads it. Lifecycle: Draft → Sent → Signed → Active → Released, and
// only admin may move a contract to Released.
//
// Access control below grants trainers row-level read/write on their own
// contract ("Sign & manage own contract"); the beforeChange hook narrows
// that further to which specific status transition they're allowed to make
// (see src/hooks/contractLifecycle.ts).
export const Contracts: CollectionConfig = {
  slug: 'contracts',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['trainer', 'cohort', 'status'],
  },
  access: {
    create: isAdmin,
    read: adminOrRoleOwnsField('trainer', 'trainer'),
    update: adminOrRoleOwnsField('trainer', 'trainer'),
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [validateContractStatusTransition],
  },
  fields: [
    {
      name: 'trainer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      access: {
        // Row-level access below grants a trainer write access to their own
        // contract (to sign, upload, consent), but never to repoint which
        // trainer or cohort it belongs to — that stays admin-only.
        update: adminOnlyField,
      },
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
      access: {
        update: adminOnlyField,
      },
      admin: {
        description:
          "Trainers aren't tied to a cohort at invite time — each contract is created separately, per cohort the trainer participates in.",
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Sent', value: 'sent' },
        { label: 'Signed', value: 'signed' },
        { label: 'Active', value: 'active' },
        { label: 'Released', value: 'released' },
      ],
    },
    {
      name: 'file',
      type: 'relationship',
      relationTo: 'files',
      admin: {
        description: 'Signed, scanned contract upload.',
      },
    },
    {
      name: 'mediaConsent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Standing media-release consent from the Trainers Agreement (name/photo/video usable in promotional material).',
      },
    },
    {
      name: 'releaseRequested',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          "Trainer-set flag requesting release; checking it doesn't release the contract, only admin moving status to Released does.",
      },
    },
  ],
}
