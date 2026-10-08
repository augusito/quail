import type { Access, CollectionConfig } from 'payload'

import { adminOrRoleOwnsField, hasRole, isAdmin } from '../access/roles'
import { getSupervisedInternIds } from '../access/scoping'

// Self-attributing `supervisor` isn't enough on its own — the named `intern`
// must actually be one this supervisor is assigned to (Enrollment.supervisor),
// the same cross-check Evaluations' standard-type branch already applies.
// Without it, a supervisor could create a Workplan about any intern, not
// just their own assigned ones.
const createAccess: Access = async ({ req: { user, payload }, data }) => {
  if (hasRole(user, 'admin')) return true
  if (!hasRole(user, 'supervisor')) return false
  if (data?.supervisor !== user!.id || data?.intern === undefined) return false
  const internIds = await getSupervisedInternIds(payload, user!.id)
  return internIds.some((id) => id === data.intern)
}

// "Submit workplans & evaluations": Supervisor only (own). Not granted
// to interns, even though the workplan is about them.
export const Workplans: CollectionConfig = {
  slug: 'workplans',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['supervisor', 'intern', 'cohort'],
  },
  access: {
    create: createAccess,
    read: adminOrRoleOwnsField('supervisor', 'supervisor'),
    update: adminOrRoleOwnsField('supervisor', 'supervisor'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'supervisor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'intern',
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
      name: 'content',
      type: 'textarea',
    },
  ],
}
