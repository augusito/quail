import type { Access, AccessResult, CollectionConfig } from 'payload'

import { hasRole, isAdmin } from '../access/roles'
import { getOwnInternProfileId } from '../access/scoping'

// §5 (proposal v2): "Education → intern, school, start date, end date,
// qualification (repeatable — an intern may list more than one)". A
// separate collection (relating to the new `Intern` profile, not `users`
// directly) rather than an array field on Intern, matching how §5 lists it
// as its own first-class entity alongside Cohort/Contract/etc.
const ownAccess: Access = async ({ req: { user, payload } }): Promise<AccessResult> => {
  if (hasRole(user, 'admin')) return true
  if (!hasRole(user, 'intern')) return false
  const internProfileId = await getOwnInternProfileId(payload, user!.id)
  if (!internProfileId) return false
  return { intern: { equals: internProfileId } }
}

// create needs its own boolean check against `data.intern`, rather than
// reusing `ownAccess` above — Payload never validates a `create` access
// function's returned `Where` against the submitted data (see the comment
// on `adminOrRoleOwnsField` in src/access/roles.ts), so returning
// `{ intern: { equals: internProfileId } }` here would let any intern
// create an Education row under *someone else's* profile.
const createAccess: Access = async ({ req: { user, payload }, data }) => {
  if (hasRole(user, 'admin')) return true
  if (!hasRole(user, 'intern')) return false
  const internProfileId = await getOwnInternProfileId(payload, user!.id)
  return internProfileId !== null && data?.intern === internProfileId
}

export const Education: CollectionConfig = {
  slug: 'education',
  admin: {
    useAsTitle: 'qualification',
    defaultColumns: ['intern', 'school', 'qualification'],
  },
  access: {
    create: createAccess,
    read: ownAccess,
    update: ownAccess,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'interns',
      required: true,
    },
    { name: 'school', type: 'text', required: true },
    { name: 'startDate', type: 'date' },
    { name: 'endDate', type: 'date' },
    { name: 'qualification', type: 'text', required: true },
  ],
}
