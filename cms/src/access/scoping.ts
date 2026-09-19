import type { Payload } from 'payload'

/**
 * Row-level scoping that needs a query, not just a field comparison on the
 * document itself — e.g. §4's "supervisor may read logbook entries only for
 * their assigned interns" and §10's "trainer may read Scores only where the
 * module's trainer is themself". Both cross a relationship the target
 * collection doesn't carry directly, so we resolve the allowed ID set first.
 */

type ID = number | string

/** Enrollment.supervisor (added for this) is how "assigned interns" (§4, §6.6, §6.8) is modeled. */
export async function getSupervisedInternIds(payload: Payload, supervisorId: ID): Promise<ID[]> {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { supervisor: { equals: supervisorId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return [...new Set(docs.map((doc) => doc.intern as ID))]
}

/** "Own modules" for a trainer (§4, §6.5, §10) is derived from TrainingSession.trainer, since Module itself has no trainer field. */
export async function getTrainerModuleIds(payload: Payload, trainerId: ID): Promise<ID[]> {
  const { docs } = await payload.find({
    collection: 'training-sessions',
    where: { trainer: { equals: trainerId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return [...new Set(docs.map((doc) => doc.module as ID))]
}

/**
 * §6.1: "Resigned (non-completing) alumni are flagged internally as
 * distinct from graduated alumni, so Talent Board eligibility can be
 * limited to actual graduates while both still share the same Alumni Hub
 * access." AlumniProfile itself doesn't record why an intern left — that's
 * Enrollment.outcome — so public Talent Board visibility (§6.9) has to be
 * cross-checked against it here.
 */
export async function getGraduatedInternIds(payload: Payload): Promise<ID[]> {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { outcome: { equals: 'graduated' } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return [...new Set(docs.map((doc) => doc.intern as ID))]
}
