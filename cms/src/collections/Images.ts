import type { CollectionConfig } from 'payload'

import { isAdmin, isAuthenticated } from '../access/roles'

// General-purpose image uploads (e.g. rich text embeds, alumna photos).
// Named `Images` (slug `images`) rather than `Media` — proposal v2's §5
// entity list renames the cohort media library (MediaAssets) to `Media`
// (see src/collections/Media.ts), which collides with what used to be this
// collection's slug; this one moved out of the way rather than the other
// way around, since it's implementation-only plumbing with no §5 entity of
// its own, while `Media` is an explicitly named, confirmed entity (§5's
// "Naming notes": "Every other rename (Trainer, Intern, Education, Session,
// Note, Logbook, Media, Alumna) reads cleanly on its own").
//
// Not governed by a §4 matrix row directly — kept public-read since it's
// used for public-facing images (e.g. Talent Board photos, §6.9), and
// write-restricted to authenticated users; only admin can delete/replace.
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
