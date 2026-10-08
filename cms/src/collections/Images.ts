import type { CollectionConfig } from 'payload'

import { isAdmin, isAuthenticated } from '../access/roles'

// General-purpose image uploads (e.g. rich text embeds, alumna photos).
// Named `Images` (slug `images`) rather than `Media` — the cohort media
// library (formerly MediaAssets) was renamed to `Media` (see
// src/collections/Media.ts), which collided with what used to be this
// collection's slug; this one moved out of the way rather than the other
// way around, since it's implementation-only plumbing with no entity name
// of its own to protect, while `Media` is an explicitly named entity.
//
// Kept public-read since it's used for public-facing images (e.g. Talent
// Board photos), and write-restricted to authenticated users; only admin
// can delete/replace.
export const Images: CollectionConfig = {
  slug: 'images',
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
