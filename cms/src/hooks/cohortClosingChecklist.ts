import { APIError, type CollectionBeforeChangeHook } from 'payload'

import type { Cohort } from '../payload-types'

/**
 * §6.1: "Closing a cohort should be a deliberate, admin-confirmed action
 * (not automatic on end-date) with a checklist: all evaluations submitted,
 * all documents verified, all contracts released — before interns migrate
 * to Alumni Hub... enforced with a straightforward validation check before
 * the status change to 'closed' is saved — plain guard logic."
 *
 * Access control already restricts Cohorts.update to admin only, so the
 * "admin-confirmed" half of that sentence is covered elsewhere; this hook
 * is the checklist itself. Only enrollments still `in-progress` are
 * checked — a cohort's already-graduated/resigned/terminated interns don't
 * block closing.
 *
 * Documents and Evaluations aren't precisely scoped to "for this cohort"
 * by the proposal (Document has no cohort field at all — it's a standing
 * per-intern compliance record; Evaluation does have one). This
 * implements the most literal reading: every still-in-progress intern in
 * this cohort needs at least one Evaluation tied to this cohort, and no
 * outstanding (pending/rejected) Document. It does not check evaluations
 * are complete *per track* (e.g. both driving-skills checkpoints for a
 * driver-track intern) — flagged as a possible refinement.
 */
export const validateCohortClosingChecklist: CollectionBeforeChangeHook<Cohort> = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return data
  if (data.status !== 'closed' || originalDoc?.status === 'closed') return data

  // No req.user means a trusted system-level call (seeding/migrations),
  // which intentionally bypasses this guard the same way it bypasses
  // access control.
  if (!req.user) return data

  const { payload } = req
  const cohortId = originalDoc!.id

  const unreleasedContracts = await payload.find({
    collection: 'contracts',
    where: { and: [{ cohort: { equals: cohortId } }, { status: { not_equals: 'released' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (unreleasedContracts.totalDocs > 0) {
    throw new APIError(
      'Cannot close this cohort: not every trainer contract for this cohort has been released/discharged.',
      400,
      undefined,
      true,
    )
  }

  const activeEnrollments = await payload.find({
    collection: 'enrollments',
    where: { and: [{ cohort: { equals: cohortId } }, { outcome: { equals: 'in-progress' } }] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  for (const enrollment of activeEnrollments.docs) {
    const internId = enrollment.intern

    const evaluations = await payload.find({
      collection: 'evaluations',
      where: { and: [{ cohort: { equals: cohortId } }, { intern: { equals: internId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (evaluations.totalDocs === 0) {
      throw new APIError(
        `Cannot close this cohort: intern ${internId} has no evaluation on record for this cohort.`,
        400,
        undefined,
        true,
      )
    }

    const unverifiedDocuments = await payload.find({
      collection: 'documents',
      where: { and: [{ intern: { equals: internId } }, { verificationStatus: { not_equals: 'verified' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (unverifiedDocuments.totalDocs > 0) {
      throw new APIError(
        `Cannot close this cohort: intern ${internId} has an unverified or rejected document.`,
        400,
        undefined,
        true,
      )
    }
  }

  return data
}
