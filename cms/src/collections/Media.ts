import type { CollectionConfig } from 'payload'

// General-purpose uploads (e.g. rich text embeds, alumni profile photos).
// Cohort media (§6 "Media library") lives in MediaAssets instead, since it
// carries a consent flag and cohort-scoped visibility that this doesn't need.
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
  },
}
