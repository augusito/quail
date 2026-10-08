import type { CollectionConfig } from 'payload'

import { hasRole, isAdmin } from '../access/roles'
import { getSupervisedInternIds, isInternOnTruckDrivingTrack } from '../access/scoping'

// Normally supervisor-authored. The driving-skills checkpoint (driver
// track only, baseline + pre-graduation) is a confirmed exception —
// trainer-authored instead.
// "Submit workplans & evaluations": Supervisor only (plus the trainer
// exception for driving-skills checkpoints; Admin retains full access per
// the global principle in access/roles.ts). Not granted to interns — they
// see their Score, not the raw Evaluation.
export const Evaluations: CollectionConfig = {
  slug: 'evaluations',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['intern', 'cohort', 'type', 'author'],
  },
  access: {
    create: async ({ req: { user, payload }, data }) => {
      if (hasRole(user, 'admin')) return true
      if (data?.author !== user?.id) return false
      if (hasRole(user, 'supervisor') && data?.type === 'standard') {
        if (data?.intern === undefined || data?.cohort === undefined) return false
        const internIds = await getSupervisedInternIds(payload, user!.id, data.cohort)
        return internIds.some((id) => id === data.intern)
      }
      if (
        hasRole(user, 'trainer') &&
        (data?.type === 'driving-skills-baseline' || data?.type === 'driving-skills-final') &&
        data?.intern !== undefined &&
        data?.cohort !== undefined
      ) {
        // "Driver track only" — a trainer may author this checkpoint
        // only for an intern actually enrolled in the truck-driving track
        // for the named cohort, not for any intern on any track.
        return isInternOnTruckDrivingTrack(payload, data.intern, data.cohort)
      }
      return false
    },
    read: ({ req: { user } }) => {
      if (!user) return false
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'supervisor') || hasRole(user, 'trainer')) {
        return { author: { equals: user.id } }
      }
      return false
    },
    update: ({ req: { user } }) => {
      if (hasRole(user, 'admin')) return true
      if (hasRole(user, 'supervisor') || hasRole(user, 'trainer')) {
        return { author: { equals: user!.id } }
      }
      return false
    },
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
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Supervisor for standard evaluations; trainer for driving-skills checkpoints.',
      },
    },
    {
      name: 'cohort',
      type: 'relationship',
      relationTo: 'cohorts',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Driving Skills — Baseline', value: 'driving-skills-baseline' },
        { label: 'Driving Skills — Final', value: 'driving-skills-final' },
      ],
    },
    {
      name: 'criteria',
      type: 'textarea',
    },
    {
      name: 'outcome',
      type: 'textarea',
    },
  ],
}
