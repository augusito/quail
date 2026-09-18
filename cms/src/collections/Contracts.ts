import type { CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, hasRole, isAdmin } from '../access/roles'
import { validateContractStatusTransition } from '../hooks/contractLifecycle'

// §6.4: admin uploads terms, trainer downloads/signs/scans/uploads back.
// Lifecycle: Draft → Sent → Signed → Active → Released/Discharged, and only
// admin may move a contract to Released/Discharged (confirmed). ratePerSession
// is reference-only — payment processing is out of scope for v1 (§3); the
// platform's job is limited to giving an accurate completed-session count.
//
// Access control below grants trainers row-level read/write on their own
// contract (§4 "Sign & manage own contract"); the beforeChange hook narrows
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
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
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
        { label: 'Released / Discharged', value: 'released' },
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
      name: 'ratePerSession',
      type: 'number',
      admin: {
        description: 'Reference only — used to produce session-count evidence for the trainer\'s own invoice. Not processed for payment (§3, §6.4).',
      },
    },
    {
      name: 'mediaConsent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Standing media-release consent from the Trainers Agreement (name/photo/video usable in promotional material).',
      },
    },
    {
      name: 'releaseRequested',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          '"A trainer can flag/request completion, but admin makes the final transition" (§6.4, confirmed). Setting this does not itself release the contract — admin still moves status to Released/Discharged.',
      },
    },
  ],
}
