import type { Access, AccessResult, CollectionConfig } from 'payload'

import { adminOnlyField, hasRole, isAdmin } from '../access/roles'
import { getSupervisedInternIds } from '../access/scoping'

const readAccess: Access = async ({ req: { user, payload } }): Promise<AccessResult> => {
  if (!user) return false
  if (hasRole(user, 'admin')) return true
  if (hasRole(user, 'supervisor')) {
    const internIds = await getSupervisedInternIds(payload, user.id)
    return { or: [{ id: { equals: user.id } }, { id: { in: internIds } }] }
  }
  return { id: { equals: user.id } }
}

const updateAccess: Access = ({ req: { user }, id }): AccessResult => {
  if (hasRole(user, 'admin')) return true
  if (!user) return false
  return user.id === id
}

// Roles per proposal §4. Program Director/Consultant/Coordinator job titles
// all map to the Admin role — no separate tier for them. "Public" is not a
// user role; it describes unauthenticated access to the Talent Board (§6.9).
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'status'],
  },
  access: {
    // Public self-registration (§6.2 invite-link flow — not yet wired up,
    // but create access needs to stay open for it). `role`/`status` are
    // locked down below via field-level access, so a public registrant
    // can't self-assign admin or bypass the intern default.
    create: () => true,
    read: readAccess,
    update: updateAccess,
    delete: isAdmin,
  },
  auth: true,
  fields: [
    // Email added by default
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'intern',
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Trainer', value: 'trainer' },
        { label: 'Intern', value: 'intern' },
        { label: 'Supervisor', value: 'supervisor' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    {
      name: 'phone',
      type: 'text',
    },
  ],
}
