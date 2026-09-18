import type { CollectionConfig } from 'payload'

import { isAdmin, isAuthenticated } from '../access/roles'

// General-purpose uploads (e.g. rich text embeds, alumni profile photos).
// Cohort media (§6 "Media library") lives in MediaAssets instead, since it
// carries a consent flag and cohort-scoped visibility that this doesn't need.
// Not governed by a §4 matrix row directly — kept public-read since it's
// used for public-facing images (e.g. Talent Board photos, §6.9), and
// write-restricted to authenticated users; only admin can delete/replace.
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
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
