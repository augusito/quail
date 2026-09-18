import crypto from 'node:crypto'

import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

const INVITE_TTL_HOURS = 24

// §6.2: "Interns self-register via a cohort-specific invite link sent via
// email. Admin generates the link per cohort when it opens; anyone with it
// can create an account and is auto-enrolled in that cohort's track."
// Since a cohort can run multiple tracks in parallel (§6.1), an invite is
// scoped to one specific track within a cohort — admin creates one per
// open track. "Expire 24 hours after issue, or can be revoked at admin's
// discretion" is enforced by the /api/register endpoint
// (src/endpoints/register.ts), which is the only consumer of this
// collection's token; the collection itself stays admin-only.
export const Invites: CollectionConfig = {
  slug: 'invites',
  admin: {
    useAsTitle: 'token',
    defaultColumns: ['cohort', 'track', 'expiresAt', 'revoked'],
  },
  access: {
    create: isAdmin,
    read: isAdmin,
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
      name: 'track',
      type: 'select',
      required: true,
      options: [
        { label: 'Truck Driving', value: 'truck-driving' },
        { label: 'Automotive Mechanics', value: 'mechanics' },
        { label: 'ICT', value: 'ict' },
        { label: 'Supply Chain', value: 'supply-chain' },
        { label: 'Business Management', value: 'business-management' },
      ],
    },
    {
      name: 'token',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated. The invite link is https://<app>/register?token=<this>.',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: `Auto-set to ${INVITE_TTL_HOURS}h after creation (§6.2).`,
      },
    },
    {
      name: 'revoked',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: "Admin's discretion, e.g. if the link leaked (§6.2). A revoked invite is rejected the same as an expired one.",
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      access: {
        create: () => false,
        update: () => false,
      },
      admin: {
        readOnly: true,
      },
      hooks: {
        beforeChange: [({ req, operation, value }) => (operation === 'create' ? req.user?.id : value)],
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation !== 'create') return data
        return {
          ...data,
          token: crypto.randomBytes(24).toString('hex'),
          expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
        }
      },
    ],
    afterChange: [
      ({ doc, operation, req }) => {
        if (operation !== 'create') return
        const baseUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
        const cohortId = typeof doc.cohort === 'object' ? doc.cohort.id : doc.cohort
        // Email integration not yet implemented (§6.2 asks for this to be
        // sent via email) — log the link so it's usable in the meantime.
        req.payload.logger.info(
          `[invite] cohort=${cohortId} track=${doc.track} expiresAt=${doc.expiresAt} link=${baseUrl}/register?token=${doc.token}`,
        )
      },
    ],
  },
}
