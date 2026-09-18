import type { CollectionConfig } from 'payload'

// Generic document uploads (contracts, statutory documents, module-note
// deliverables). Kept separate from Media (images only) and MediaAssets
// (the consent-tracked cohort media library, §6.4) since these are working
// documents, not promotional media.
export const Files: CollectionConfig = {
  slug: 'files',
  admin: {
    useAsTitle: 'filename',
  },
  access: {
    read: () => true,
  },
  fields: [],
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
