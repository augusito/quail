import type { Access, AccessResult, CollectionConfig } from 'payload'

import { hasRole, isAdmin } from '../access/roles'
import { getTrainerModuleIds } from '../access/scoping'

const createAccess: Access = async ({ req: { user, payload }, data }) => {
  if (hasRole(user, 'admin')) return true
  if (!hasRole(user, 'trainer')) return false
  const moduleIds = await getTrainerModuleIds(payload, user!.id)
  return moduleIds.some((id) => id === data?.module)
}

const readAccess: Access = async ({ req: { user, payload } }): Promise<AccessResult> => {
  if (!user) return false
  if (hasRole(user, 'admin')) return true
  if (hasRole(user, 'trainer')) {
    const moduleIds = await getTrainerModuleIds(payload, user.id)
    return { module: { in: moduleIds } }
  }
  if (hasRole(user, 'intern')) {
    return { and: [{ intern: { equals: user.id } }, { finalized: { equals: true } }] }
  }
  return false
}

const updateAccess: Access = async ({ req: { user, payload } }) => {
  if (hasRole(user, 'admin')) return true
  if (!hasRole(user, 'trainer')) return false
  const moduleIds = await getTrainerModuleIds(payload, user!.id)
  return { module: { in: moduleIds } }
}

// §6.5: once a module completes and its score is finalized, the intern can
// see that module's score immediately, rather than waiting for cohort end.
// §4 "View scores" / "Post module notes/scores": Admin (all), Trainer (own
// modules only — Module has no `trainer` field, so "own modules" is derived
// from Session.trainer via getTrainerModuleIds, per §10's
// "trainer may read Scores only where the module's trainer is themself"),
// Intern (own, and only once finalized).
export const Scores: CollectionConfig = {
  slug: 'scores',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'module', 'value', 'finalized'],
  },
  access: {
    create: createAccess,
    read: readAccess,
    update: updateAccess,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'modules',
      required: true,
    },
    {
      name: 'value',
      type: 'number',
      required: true,
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'finalized',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Controls whether the intern can see this score yet (§6.5).',
      },
    },
  ],
}
