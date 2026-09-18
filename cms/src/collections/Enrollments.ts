import type { Access, AccessResult, CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

const readAccess: Access = ({ req: { user } }): AccessResult => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'intern') return { intern: { equals: user.id } }
  if (user.role === 'supervisor') return { supervisor: { equals: user.id } }
  return false
}

// Links Intern ↔ Cohort ↔ Track (§5). outcome captures the §6.1
// non-completion paths: Termination (account closed, no Alumni Hub) vs.
// Resignation (moves to Alumni Hub, flagged separately from graduates so
// Talent Board eligibility can be limited to actual graduates).
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'cohort', 'track', 'supervisor', 'outcome'],
  },
  access: {
    create: isAdmin,
    // Admin manages enrollment; interns/supervisors need to read their own
    // rows (row-level scoping is applied in readAccess above).
    read: readAccess,
    update: isAdmin,
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
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
    },
    {
      name: 'supervisor',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Assigned supervisor/"Mentor" for this intern — drives the §4/§6.6/§6.8 "assigned interns" access scoping.',
      },
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
      name: 'outcome',
      type: 'select',
      defaultValue: 'in-progress',
      options: [
        { label: 'In Progress', value: 'in-progress' },
        { label: 'Graduated', value: 'graduated' },
        { label: 'Resigned', value: 'resigned' },
        { label: 'Terminated', value: 'terminated' },
      ],
    },
  ],
}
