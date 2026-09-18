import type { Access, FieldAccess } from 'payload'

import type { User } from '../payload-types'

export type Role = User['role']

/**
 * Global principle (documented once here rather than per collection):
 * Admin is the platform superuser and always has full CRUD access,
 * regardless of whether a given §4 matrix row's Admin cell says "submit"
 * or not — those cells describe who normally originates a workflow action
 * (e.g. a Supervisor submits an evaluation), not a restriction on Admin's
 * oversight. Program Director/Consultant/Coordinator job titles map to
 * Admin (§4 role mapping decisions), so this also covers their need for
 * full visibility. Every other role gets exactly what §4 grants them;
 * anything the matrix doesn't mention is denied by default.
 */

export const hasRole = (user: User | null | undefined, ...roles: Role[]): boolean =>
  !!user && roles.includes(user.role)

export const isAdmin: Access = ({ req: { user } }) => hasRole(user, 'admin')

export const isAuthenticated: Access = ({ req: { user } }) => !!user

export const adminOnlyField: FieldAccess = ({ req: { user } }) => hasRole(user, 'admin')

export const roleOnlyField =
  (...roles: Role[]): FieldAccess =>
  ({ req: { user } }) =>
    hasRole(user, ...roles)

/** Admin: full access. Everyone else: read/write only their own record (by `field`). */
export const adminOrOwnRecord =
  (field = 'id'): Access =>
  ({ req: { user } }) => {
    if (hasRole(user, 'admin')) return true
    if (!user) return false
    return { [field]: { equals: user.id } }
  }

/** Admin: full access. A given role: read/write only rows where `field` equals their own id. Everyone else: denied. */
export const adminOrRoleOwnsField =
  (role: Role, field: string): Access =>
  ({ req: { user } }) => {
    if (hasRole(user, 'admin')) return true
    if (!hasRole(user, role)) return false
    return { [field]: { equals: user!.id } }
  }
