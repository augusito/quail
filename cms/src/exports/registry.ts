import type { CollectionSlug } from 'payload'

import type {
  Alumna,
  Contract,
  Document,
  Enrollment,
  Evaluation,
  Intern,
  Logbook,
  Score,
  Session,
  Trainer,
  User,
} from '../payload-types'
import type { ExportColumn } from './buildWorkbook'
import { displayName, formatBoolean, formatDate, joinValues } from './format'

// §6.11: "Confirmed export destination for v1: a straight Excel download."
// §4 "Bulk export": Admin only. Each entry here is a hand-written column
// list rather than a generic field-dump — a spreadsheet an admin actually
// wants shows human-readable names (via displayName, since collections are
// queried at depth: 1 so relationships arrive populated), not raw
// relationship IDs or JSON blobs, and stays stable when an unrelated field
// gets added to a collection.
//
// This hand-written-column approach is also what satisfies §7's new "not
// exposed in bulk exports" requirement for sensitive fields
// (dateOfBirth, nationalIdNumber, kraPin, shifNumber, nssfNumber, all on
// Trainer/Intern, §5): the `trainers`/`interns` definitions below simply
// never list those columns, rather than needing a separate redaction step.
//
// A narrower, curated set of collections is exposed here rather than every
// collection in the app — group/array-heavy or upload-only collections
// (Logbook's driver/non-driver nested groups aside, which do get a
// flattened column set below) and internal ones (Files, Invites,
// Education, payload-jobs) aren't meaningful as a flat spreadsheet row.
export type ExportDefinition<T> = {
  columns: ExportColumn<T>[]
  label: string
}

// Registry entries are typed per collection; this narrows each definition
// to `unknown` once, here, instead of an `as` cast at every entry below.
function defineExport<T>(label: string, columns: ExportColumn<T>[]): ExportDefinition<unknown> {
  return { label, columns: columns as ExportColumn<unknown>[] }
}

export const exportRegistry: Partial<Record<CollectionSlug, ExportDefinition<unknown>>> = {
  users: defineExport<User>('Users', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Name', get: (d) => d.name ?? '' },
    { header: 'Email', get: (d) => d.email },
    { header: 'Role', get: (d) => d.role },
    { header: 'Status', get: (d) => d.status },
    { header: 'Phone', get: (d) => d.phone ?? '' },
    { header: 'Created At', get: (d) => formatDate(d.createdAt) },
  ]),

  trainers: defineExport<Trainer>('Trainers', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Name', get: (d) => d.name },
    { header: 'Occupation', get: (d) => d.occupation },
    { header: 'Address', get: (d) => d.address ?? '' },
    { header: 'Phone', get: (d) => d.phone },
    { header: 'Email', get: (d) => d.email },
    // §7: nationalIdNumber and kraPin deliberately omitted — sensitive
    // personal data, not exposed in bulk exports.
  ]),

  interns: defineExport<Intern>('Interns', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Name', get: (d) => d.name },
    { header: 'Gender', get: (d) => d.gender },
    { header: 'Nationality', get: (d) => d.nationality },
    { header: 'Address', get: (d) => d.address ?? '' },
    { header: 'Phone', get: (d) => d.phone },
    { header: 'Email', get: (d) => d.email },
    { header: 'Next of Kin Name', get: (d) => d.nextOfKin?.name ?? '' },
    { header: 'Next of Kin Phone', get: (d) => d.nextOfKin?.phone ?? '' },
    // §7: dateOfBirth, nationalIdNumber, kraPin, shifNumber, nssfNumber
    // deliberately omitted — sensitive personal data, not exposed in bulk
    // exports. Next-of-kin contact details aren't the intern's own
    // sensitive data (§7 only names the intern/trainer's own statutory
    // numbers and DOB) so are included as they're useful roster info.
  ]),

  enrollments: defineExport<Enrollment>('Enrollments', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Intern', get: (d) => displayName(d.intern) },
    { header: 'Intern Email', get: (d) => (typeof d.intern === 'object' ? d.intern.email : '') },
    { header: 'Cohort', get: (d) => displayName(d.cohort) },
    { header: 'Track', get: (d) => d.track },
    { header: 'Supervisor', get: (d) => displayName(d.supervisor) },
    { header: 'Outcome', get: (d) => d.outcome ?? '' },
  ]),

  contracts: defineExport<Contract>('Contracts', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Trainer', get: (d) => displayName(d.trainer) },
    { header: 'Cohort', get: (d) => displayName(d.cohort) },
    { header: 'Status', get: (d) => d.status },
    { header: 'Rate Per Session', get: (d) => d.ratePerSession ?? '' },
    { header: 'Release Requested', get: (d) => formatBoolean(d.releaseRequested) },
    { header: 'Media Consent', get: (d) => formatBoolean(d.mediaConsent) },
  ]),

  sessions: defineExport<Session>('Sessions', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Module', get: (d) => displayName(d.module) },
    { header: 'Trainer', get: (d) => displayName(d.trainer) },
    { header: 'Cohort', get: (d) => displayName(d.cohort) },
    { header: 'Scheduled Date', get: (d) => formatDate(d.scheduledDate) },
    { header: 'Status', get: (d) => d.status },
    { header: 'Reminder Status', get: (d) => d.reminderStatus ?? '' },
  ]),

  scores: defineExport<Score>('Scores', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Intern', get: (d) => displayName(d.intern) },
    { header: 'Module', get: (d) => displayName(d.module) },
    { header: 'Value', get: (d) => d.value },
    { header: 'Finalized', get: (d) => formatBoolean(d.finalized) },
    { header: 'Notes', get: (d) => d.notes ?? '' },
  ]),

  evaluations: defineExport<Evaluation>('Evaluations', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Intern', get: (d) => displayName(d.intern) },
    { header: 'Author', get: (d) => displayName(d.author) },
    { header: 'Cohort', get: (d) => displayName(d.cohort) },
    { header: 'Type', get: (d) => d.type },
    { header: 'Outcome', get: (d) => d.outcome ?? '' },
  ]),

  logbooks: defineExport<Logbook>('Logbooks', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Intern', get: (d) => displayName(d.intern) },
    { header: 'Cohort', get: (d) => displayName(d.cohort) },
    { header: 'Type', get: (d) => d.type },
    { header: 'Date', get: (d) => formatDate(d.date) },
    { header: 'Status', get: (d) => d.status ?? '' },
    { header: 'KMs Driven', get: (d) => d.trip?.kmsDriven ?? '' },
    { header: 'Trip Area', get: (d) => d.trip?.area ?? '' },
    { header: 'Week Project', get: (d) => d.week?.projectAssigned ?? '' },
    { header: 'Supervisor Comment', get: (d) => d.supervisorComment ?? '' },
  ]),

  documents: defineExport<Document>('Documents', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Intern', get: (d) => displayName(d.intern) },
    { header: 'Type', get: (d) => d.type },
    { header: 'Verification Status', get: (d) => d.verificationStatus },
    { header: 'Rejection Reason', get: (d) => d.rejectionReason ?? '' },
    { header: 'File', get: (d) => displayName(d.file) },
  ]),

  alumnae: defineExport<Alumna>('Alumnae', [
    { header: 'ID', get: (d) => d.id },
    { header: 'Intern', get: (d) => displayName(d.intern) },
    { header: 'Employment Status', get: (d) => d.employmentStatus ?? '' },
    { header: 'Opted In', get: (d) => formatBoolean(d.optedIn) },
    { header: 'Email', get: (d) => d.email ?? '' },
    { header: 'Phone', get: (d) => d.phone ?? '' },
    { header: 'Courses', get: (d) => joinValues(d.courses?.map((c) => c.name)) },
  ]),
}

export const exportableCollections = Object.keys(exportRegistry) as CollectionSlug[]
