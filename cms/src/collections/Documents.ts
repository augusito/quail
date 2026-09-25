import type { CollectionConfig } from 'payload'

import { adminOnlyField, adminOrRoleOwnsField, isAdmin } from '../access/roles'

// §6.7 Document Vault. Confirmed document types from the pitch deck; a
// verification status (not just storage) lets admin track compliance.
// §4 "Upload statutory documents": Admin (any), Intern (own). Not granted
// to trainer/supervisor in the matrix.
//
// §6.7 "Numbers vs. proof" (proposal v2): this vault holds the
// scanned/uploaded proof file only — the actual ID/KRA PIN/SHIF/NSSF
// *numbers* live as text fields on the Trainer/Intern statutory profile
// (§5, src/collections/Trainer.ts / Intern.ts) instead. The two are linked
// but distinct: the number is needed for contracts/records, the document
// here for compliance verification.
export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'type', 'verificationStatus'],
  },
  access: {
    create: adminOrRoleOwnsField('intern', 'intern'),
    read: adminOrRoleOwnsField('intern', 'intern'),
    // Interns can re-upload after a rejection, but can't self-verify —
    // verificationStatus/rejectionReason are locked to admin below.
    update: adminOrRoleOwnsField('intern', 'intern'),
    // Deletion isn't a granted capability — these are compliance records
    // (§6.7); admin manages the record lifecycle once submitted.
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
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'National ID', value: 'national-id' },
        { label: 'Driving Licence', value: 'driving-licence' },
        { label: 'Certificate of Good Conduct', value: 'certificate-of-good-conduct' },
        { label: 'SHA/SHIF', value: 'sha-shif' },
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
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
      admin: {
        condition: (_, siblingData) => siblingData?.verificationStatus === 'rejected',
      },
    },
  ],
}
