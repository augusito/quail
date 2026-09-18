import type { CollectionConfig } from 'payload'

// §6.4: admin uploads terms, trainer downloads/signs/scans/uploads back.
// Lifecycle: Draft → Sent → Signed → Active → Released/Discharged, and only
// admin may move a contract to Released/Discharged (confirmed). ratePerSession
// is reference-only — payment processing is out of scope for v1 (§3); the
// platform's job is limited to giving an accurate completed-session count.
export const Contracts: CollectionConfig = {
  slug: 'contracts',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['trainer', 'cohort', 'status'],
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
  ],
}
