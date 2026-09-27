import type { Access, AccessResult, CollectionConfig } from 'payload'

import { adminOnlyField, adminOrOwnRecord, hasRole, isAdmin, isAuthenticated } from '../access/roles'
import { getAccessibleFileIds } from '../access/scoping'

const readAccess: Access = async ({ req: { user, payload } }): Promise<AccessResult> => {
  if (hasRole(user, 'admin')) return true
  if (!user) return false
  const fileIds = await getAccessibleFileIds(payload, user.id)
  return { id: { in: fileIds } }
}

// Generic document uploads (contracts, statutory documents, note
// deliverables). Kept separate from Images (generic image uploads) and
// Media (the consent-tracked cohort media library, §6.4) since these are
// working documents, not promotional media.
//
// These hold sensitive content (signed contracts, statutory IDs), so this
// is deliberately NOT public like Images. It isn't governed by a single §4
// matrix row either — it's shared plumbing under Contracts/Documents/
// Notes, each of which already scopes who may reference a file.
// readAccess walks those same relationships (getAccessibleFileIds) rather
// than a flat "any authenticated user" — e.g. a trainer can read a
// contract's file *admin* uploaded (their own contract), but not an
// unrelated intern's statutory documents.
export const Files: CollectionConfig = {
  slug: 'files',
  admin: {
    useAsTitle: 'filename',
  },
  access: {
    create: isAuthenticated,
    read: readAccess,
    update: adminOrOwnRecord('uploadedBy'),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
      admin: {
        readOnly: true,
        description: 'Set automatically on upload; used for update ownership.',
      },
      hooks: {
        beforeChange: [
          ({ req, operation, value }) => {
            if (operation === 'create') return req.user?.id ?? value
            return value
          },
        ],
      },
    },
  ],
  upload: {
    mimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
}
