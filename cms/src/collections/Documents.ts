import type { CollectionConfig } from 'payload'

// §6.7 Document Vault. Confirmed document types from the pitch deck; a
// verification status (not just storage) lets admin track compliance.
export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'type', 'verificationStatus'],
  },
  fields: [
    {
      name: 'intern',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'National ID', value: 'national-id' },
        { label: 'Driving Licence', value: 'driving-licence' },
        { label: 'Certificate of Good Conduct', value: 'certificate-of-good-conduct' },
        { label: 'SHA', value: 'sha' },
        { label: 'KRA PIN', value: 'kra-pin' },
        { label: 'NSSF', value: 'nssf' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'file',
      type: 'relationship',
      relationTo: 'files',
      required: true,
    },
    {
      name: 'verificationStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
      admin: {
        condition: (_, siblingData) => siblingData?.verificationStatus === 'rejected',
      },
    },
  ],
}
