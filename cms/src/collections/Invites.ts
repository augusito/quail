import crypto from 'node:crypto'

import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

const INVITE_TTL_HOURS = 24

// §6.2 (proposal v2): "Both interns and trainers self-register, via an
// invite link personalized to their email — admin enters the person's
// email address (plus their role and cohort) to generate and send it,
// rather than one shareable link per cohort. Only that email address can
// complete registration with it." /api/register (src/endpoints/register.ts)
// enforces the "only that email" half by using this record's own `email`
// as the account's email outright, rather than accepting a separately
// submitted one to compare against — there's no mismatch to check if the
// client never gets to supply it.
//
// `track` only makes sense for an intern invite (which track they're
// auto-enrolled into) — a trainer invite just associates the trainer with
// the cohort ahead of their contract (§6.4), no track involved.
export const Invites: CollectionConfig = {
  slug: 'invites',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'cohort', 'track', 'status', 'expiresAt'],
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
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Intern', value: 'intern' },
        { label: 'Trainer', value: 'trainer' },
      ],
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: {
        description: 'Only this address can complete registration with the resulting link (§6.2).',
      },
    },
    {
      name: 'track',
      type: 'select',
      admin: {
        condition: (_, siblingData) => siblingData?.role === 'intern',
        description: 'Which track this intern is auto-enrolled into. Not used for trainer invites.',
      },
      validate: (value: string | string[] | null | undefined, { siblingData }: { siblingData?: { role?: string } }) => {
        if (siblingData?.role === 'intern' && !value) return 'Track is required for intern invites.'
        return true
      },
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
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'sent',
      admin: {
        description:
          "Set automatically: 'used' once registration completes, 'expired' the first time a stale invite is checked past expiresAt. 'Revoked' is admin's discretion (e.g. entered the wrong email, or the person is no longer eligible) — rejected the same as an expired one.",
      },
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Used', value: 'used' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
      ],
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
          `[invite] cohort=${cohortId} role=${doc.role} email=${doc.email} track=${doc.track ?? '—'} expiresAt=${doc.expiresAt} link=${baseUrl}/register?token=${doc.token}`,
        )
      },
    ],
  },
}
