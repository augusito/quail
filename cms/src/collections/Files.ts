import type { CollectionConfig } from 'payload'

import { adminOnlyField, adminOrOwnRecord, isAdmin, isAuthenticated } from '../access/roles'

// Generic document uploads (contracts, statutory documents, module-note
// deliverables). Kept separate from Media (images only) and MediaAssets
// (the consent-tracked cohort media library, §6.4) since these are working
// documents, not promotional media.
//
// These hold sensitive content (signed contracts, statutory IDs), so this
// is deliberately NOT public like Media. It isn't governed by a single §4
// matrix row either — it's shared plumbing under Contracts/Documents/
// ModuleNotes, each of which already scopes who may reference a file (e.g.
// only a document's own intern, only a contract's own trainer). Read access
// here is intentionally broader (any authenticated user, not just the
// uploader) because e.g. a trainer must be able to download a contract
// admin uploaded — enforcing "only the requester's own contract/document/
// module-note may reference this file" would need a cross-collection join
// per request; left as a known gap/follow-up rather than built here.
export const Files: CollectionConfig = {
  slug: 'files',
  admin: {
    useAsTitle: 'filename',
  },
  access: {
    create: isAuthenticated,
    read: isAuthenticated,
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
