import type { Access, AccessResult, CollectionConfig, Where } from 'payload'

import { hasRole, isAdmin } from '../access/roles'
import { getMediaGrantedCohortIds } from '../access/scoping'

const readAccess: Access = async ({ req: { user, payload } }): Promise<AccessResult> => {
  if (hasRole(user, 'admin')) return true
  if (!hasRole(user, 'trainer')) return false

  const grantedCohortIds = await getMediaGrantedCohortIds(payload, user!.id)
  if (grantedCohortIds.length === 0) return false

  const where: Where = {
    and: [{ cohort: { in: grantedCohortIds } }, { visibilityScope: { equals: 'cohort-extended' } }],
  }
  return where
}

// Cohort media library (§4, §6.4). Renamed from `MediaAssets` to `Media` per
// proposal v2's §5 naming notes — the old generic-uploads collection moved
// to `Images` (src/collections/Images.ts) to free up this slug/name, since
// this is the entity the proposal actually names `Media`. Distinct from
// Images: this carries a consent flag — capturing whether the depicted
// intern or trainer has consented to promotional use beyond the library
// itself — and cohort-scoped visibility (admin-only vs. cohort-extended).
//
// §4 "Media library access": Admin (all). Trainer is granted read-only
// access, but only to visibilityScope: 'cohort-extended' assets belonging to
// a cohort they've been listed on via Cohort.mediaAccessGrantedTo ("unless
// granted per cohort") — admin-only assets stay admin-exclusive even within
// a granted cohort. Intern/Supervisor/Public remain ❌, matching the matrix.
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['cohort', 'visibilityScope', 'consentGiven'],
  },
  access: {
    create: isAdmin,
    read: readAccess,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
    },
    {
      name: 'visibilityScope',
      type: 'select',
      required: true,
      defaultValue: 'admin-only',
      options: [
        { label: 'Admin Only', value: 'admin-only' },
        { label: 'Cohort Extended', value: 'cohort-extended' },
      ],
    },
    {
      name: 'consentGiven',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether the depicted intern/trainer has consented to promotional use (§6.4).',
      },
    },
  ],
  upload: {
    mimeTypes: ['image/*', 'video/*'],
  },
}
