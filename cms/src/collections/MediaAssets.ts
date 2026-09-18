import type { CollectionConfig } from 'payload'

// Cohort media library (§4, §6.4). Distinct from Media (generic uploads):
// this carries a consent flag — capturing whether the depicted intern or
// trainer has consented to promotional use beyond the library itself — and
// cohort-scoped visibility (admin-only vs. cohort-extended).
export const MediaAssets: CollectionConfig = {
  slug: 'media-assets',
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['cohort', 'visibilityScope', 'consentGiven'],
  },
  fields: [
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
    },
    {
      name: 'visibilityScope',
      type: 'select',
      required: true,
      defaultValue: 'admin-only',
      options: [
        { label: 'Admin Only', value: 'admin-only' },
        { label: 'Cohort Extended', value: 'cohort-extended' },
      ],
    },
    {
      name: 'consentGiven',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether the depicted intern/trainer has consented to promotional use (§6.4).',
      },
    },
  ],
  upload: {
    mimeTypes: ['image/*', 'video/*'],
  },
}
