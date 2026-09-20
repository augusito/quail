import type { Access, CollectionConfig } from 'payload'

import { hasRole, isAdmin } from '../access/roles'
import { getAlumniInternIds } from '../access/scoping'

const readAccess: Access = async ({ req: { user, payload } }) => {
  if (hasRole(user, 'admin')) return true
  if (!user) return false
  const alumniInternIds = await getAlumniInternIds(payload)
  return alumniInternIds.includes(user.id)
}

// §4 "Alumni Hub announcements": Admin only (authoring). Read is scoped to
// admin plus actual Alumni Hub members — graduated or resigned interns
// (§6.1: "both still share the same Alumni Hub access") — via
// getAlumniInternIds, rather than any authenticated user. A
// still-in-progress intern, trainer, or supervisor has no Alumni Hub to
// read announcements in.
export const Announcements: CollectionConfig = {
  slug: 'announcements',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'publishedAt'],
  },
  access: {
    create: isAdmin,
    read: readAccess,
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
