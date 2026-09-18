import type { CollectionConfig } from 'payload'

import { isAdmin, isAuthenticated } from '../access/roles'

// §4 "Alumni Hub announcements": Admin only (authoring). Read is opened to
// any authenticated user rather than alumni-only, since the matrix doesn't
// define a separate "Alumni" role — Alumni Hub access is really "any
// graduated/resigned intern" (§6.1), which isn't a role this schema can
// filter by at the collection-access level (it's an Enrollment.outcome
// value, not a Users.role). Flagged as a possible refinement.
export const Announcements: CollectionConfig = {
  slug: 'announcements',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'publishedAt'],
  },
  access: {
    create: isAdmin,
    read: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
  ],
}
