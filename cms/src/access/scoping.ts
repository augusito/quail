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

/** "Own modules" for a trainer (§4, §6.5, §10) is derived from Session.trainer, since Module itself has no trainer field. */
export async function getTrainerModuleIds(payload: Payload, trainerId: ID): Promise<ID[]> {
  const { docs } = await payload.find({
    collection: 'sessions',
    where: { trainer: { equals: trainerId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return [...new Set(docs.map((doc) => doc.module as ID))]
}

/**
 * §6.5: the driving-skills checkpoint exception is scoped to "each
 * driver-track intern" — used by Evaluations' create access
 * (src/collections/Evaluations.ts) so a trainer can only author a
 * driving-skills-baseline/-final evaluation for an intern actually enrolled
 * in the truck-driving track for that cohort, not any intern on any track.
 */
export async function isInternOnTruckDrivingTrack(
  payload: Payload,
  internId: ID,
  cohortId: ID,
): Promise<boolean> {
  const { totalDocs } = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { intern: { equals: internId } },
        { cohort: { equals: cohortId } },
        { track: { equals: 'truck-driving' } },
      ],
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return totalDocs > 0
}

/**
 * §6.10: "their logbook history becomes read-only once the cohort ends —
 * they can view past entries but not modify them." Resolves which interns
 * are still mid-cohort (i.e. not yet graduated/resigned/terminated) so
 * Logbook's own-record write access (src/collections/Logbook.ts) can be
 * scoped to them, the same way getGraduatedInternIds/getAlumniInternIds
 * cross-check Enrollment.outcome for Alumna/Announcements below.
 */
export async function getInProgressInternIds(payload: Payload): Promise<ID[]> {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { outcome: { equals: 'in-progress' } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return [...new Set(docs.map((doc) => doc.intern as ID))]
}

/**
 * §6.1: "Resigned (non-completing) alumni are flagged internally as
 * distinct from graduated alumni, so Talent Board eligibility can be
 * limited to actual graduates while both still share the same Alumni Hub
 * access." Alumna itself doesn't record why an intern left — that's
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

/**
 * §6.1: "both still share the same Alumni Hub access" — graduated and
 * resigned interns alike. Used to gate Announcements read (§4 "Alumni Hub
 * announcements"), which the matrix doesn't grant to still-in-progress
 * interns or other roles.
 */
export async function getAlumniInternIds(payload: Payload): Promise<ID[]> {
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { outcome: { in: ['graduated', 'resigned'] } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return [...new Set(docs.map((doc) => doc.intern as ID))]
}

/**
 * Files (src/collections/Files.ts) is shared plumbing under Contracts,
 * Documents, and Notes, each of which already scopes who may
 * reference a given row (e.g. only a document's own intern, only a
 * contract's own trainer). This resolves the set of File ids a given user
 * is entitled to see by walking those same relationships, plus their own
 * uploads — e.g. a trainer must be able to download a contract *admin*
 * uploaded, which "only the uploader" would have wrongly blocked.
 */
export async function getAccessibleFileIds(payload: Payload, userId: ID): Promise<ID[]> {
  const [ownUploads, documents, contracts, notes] = await Promise.all([
    payload.find({
      collection: 'files',
      where: { uploadedBy: { equals: userId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'documents',
      where: { intern: { equals: userId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'contracts',
      where: { trainer: { equals: userId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'notes',
      where: { trainer: { equals: userId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const ids = new Set<ID>()
  for (const file of ownUploads.docs) ids.add(file.id as ID)
  for (const doc of documents.docs) if (doc.file) ids.add(doc.file as ID)
  for (const contract of contracts.docs) if (contract.file) ids.add(contract.file as ID)
  for (const note of notes.docs) {
    if (note.slideDeck) ids.add(note.slideDeck as ID)
    if (note.assignment) ids.add(note.assignment as ID)
    if (note.assessmentReport) ids.add(note.assessmentReport as ID)
  }
  return [...ids]
}

/**
 * §4 "Media library access… unless granted per cohort" — Cohort.mediaAccessGrantedTo
 * (added for this) is admin's per-cohort allowlist of trainers. Resolves
 * which cohorts a given trainer has been granted into.
 */
export async function getMediaGrantedCohortIds(payload: Payload, trainerId: ID): Promise<ID[]> {
  const { docs } = await payload.find({
    collection: 'cohorts',
    where: { mediaAccessGrantedTo: { equals: trainerId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return docs.map((doc) => doc.id as ID)
}
