# She Delivers Management System — Proposal

> This document reflects what is actually implemented in `she-delivers-web/` as of the latest merged PR, not just what was originally proposed. Where the build diverged from the original plan (a field dropped, a flow simplified, a field added), that decision is called out in place.

## 1. Purpose

She Delivers is a 6-month internship program closing the gender gap in transport, logistics, and supply chain by training women in truck driving, automotive mechanics, ICT, supply chain, and business management.

This system digitizes cohort management, training delivery, compliance documentation, and post-graduation employability tracking — replacing manual/paper-based coordination with a single role-based platform.

## 2. Objectives

- Reduce admin overhead in running a cohort (scheduling, contracts, document collection)
- Give trainers and supervisors a structured way to record progress and evaluations
- Give interns a single place to track their own requirements and progress
- Maintain an auditable record of statutory documents and signed contracts
- Convert graduates into a searchable, consent-based talent pipeline for employers

## 3. Scope

**In scope:** cohort lifecycle, user management, contracts, module notes, scores, logbooks, document vault, evaluations, media library, alumni hub, public talent board, exports, notifications.

**Out of scope (v1):** payment/stipend processing, e-learning/LMS content delivery, employer-side applicant tracking, mobile native apps (web-responsive only), intern education history (dropped — see §5), minimum-age enforcement at registration.

> Note: the sample Trainers Agreement sets a rate (sh.7,500 per 2-hour session, less 5% withholding tax) and has the trainer invoice the company directly. Actual payment stays out of scope for v1 as stated above — the system's role is limited to producing the session-count evidence a trainer needs to raise that invoice (see §6.4).

## 4. User Roles & Permissions Matrix

| Capability                      | Admin         | Trainer                        | Intern                        | Supervisor            | Public |
| -------------------------------- | ------------- | ------------------------------- | ------------------------------ | ---------------------- | ------ |
| Create/close cohorts              | ✅            | ❌                              | ❌                             | ❌                     | ❌     |
| Sign & manage own contract        | ✅ (view all) | ✅ (own)                        | ❌                             | ❌                     | ❌     |
| Pick training dates               | ✅            | ✅ (own modules)                | ❌                             | ❌                     | ❌     |
| Post module notes/scores          | ✅ (view all) | ✅ (own modules only)           | ❌                             | ❌                     | ❌     |
| View scores                       | ✅ (all)      | ✅ (own modules only)           | ✅ (own, once finalized)       | ❌                     | ❌     |
| Register / manage own profile     | ✅            | ✅                              | ✅                             | ✅                     | ❌     |
| Upload statutory documents        | ✅ (any)      | ❌                              | ✅ (own)                       | ❌                     | ❌     |
| Update own logbook                | ❌            | ❌                              | ✅ (while still enrolled)      | ❌                     | ❌     |
| Review/comment on logbooks        | ✅            | ❌                              | ❌                             | ✅ (assigned interns)  | ❌     |
| Submit workplans & evaluations    | ❌            | ❌ (except driving-skills, §6.5) | ❌                            | ✅                     | ❌     |
| Media library access              | ✅ (all)      | ❌ (unless granted per cohort)  | ❌                             | ❌                     | ❌     |
| View talent board                 | ✅            | ❌                              | ❌                             | ❌                     | ✅     |
| Edit own talent board listing     | ✅            | ❌                              | ✅ (post-graduation, opt-in)   | ❌                     | ❌     |
| Bulk export                       | ✅            | ❌                              | ❌                             | ❌                     | ❌     |
| Alumni Hub announcements (author) | ✅            | ❌                              | ❌                             | ❌                     | ❌     |
| Alumni Hub announcements (read)   | ✅            | ❌                              | ✅ (graduated or resigned)     | ❌                     | ❌     |

**Role mapping decisions (confirmed):**
- The Trainers Agreement refers to a *Program Director*, *Program Consultant*, and *Program Coordinator* — these are job titles for people operating the **Admin** account, not separate system roles. No extra permission tier is needed for them. As a global principle, Admin always has full CRUD on every collection regardless of what a matrix cell says about who normally *originates* an action.
- The Drivers Logbook's "Mentor Driver" sheet and the proposal's **Supervisor** are the same person/role.

## 5. Core Entities (Data Model Overview)

- **User** → email, name, role (admin/trainer/intern/supervisor), status (active/inactive/pending approval), phone. The single auth/role anchor for every role.
- **Trainer** → user, name, occupation, organization (optional), postal address, phone, email, ID number, KRA PIN — profile fields collected at self-registration, additive to `User`.
- **Intern** → user, name, date of birth, nationality, postal address, phone, email, ID number, KRA PIN, SHIF number, NSSF number, next of kin (name, relationship, address, phone, email — exactly one required contact, folded in as flat fields, not a separate entity).
- **Invite** → role (intern/trainer), email, cohort (intern only), track (intern only), token, status (sent/used/expired/revoked), expires at, created by.
- **Cohort** → name, tracks (multi-select), start/end date, status (draft → open → active → closed), media-access grant list (which trainers may see this cohort's cohort-extended media).
- **Enrollment** → links Intern ↔ Cohort ↔ Track ↔ Supervisor, outcome (in-progress/graduated/resigned/terminated).
- **Contract** → trainer, cohort (required — a contract is always per-cohort), status (draft → sent → signed → active → released), file, media consent, release-requested flag.
- **Module** → track, name, curriculum reference.
- **Session** → module, trainer, cohort, scheduled date, status (scheduled/completed/rescheduled/cancelled), reminder status.
- **Note** → session, trainer, content (prose write-up), slide deck, assignment, end-of-module assessment report (all file attachments).
- **Score** → intern, module, value, notes, finalized flag.
- **Logbook** → intern, cohort, type (driver/non-driver), date, driver-trip fields or non-driver-week fields, supervisor comment, status (draft/submitted/reviewed).
- **Evaluation** → intern, author, cohort, type (standard / driving-skills baseline / driving-skills final), criteria, outcome.
- **Workplan** → supervisor, intern, cohort, content.
- **Document** → intern, type (national ID / driving licence / certificate of good conduct / SHA-SHIF / KRA PIN / NSSF / other), file, verification status (pending/verified/rejected), rejection reason.
- **Media** → cohort, visibility scope (admin-only / cohort-extended), consent-given flag, upload (image/video). The cohort media library — distinct from `Images`, the generic image-upload collection used elsewhere (e.g. alumna photos).
- **Alumna** → intern, public display name, photo, employment status, courses (repeatable), work experience (repeatable), bio, email, phone, opted-in flag.
- **Announcement** → title, content, author, published at.

**Naming notes:** entities use the single-word naming settled on during the technical evaluation of Payload CMS (Trainer, Intern, Invite, Cohort, Enrollment, Contract, Module, Session, Note, Score, Logbook, Evaluation, Workplan, Document, Media, Alumna, Announcement). `Session` keeps that name despite colliding with the auth/login "session" concept — the two live in clearly different parts of the codebase and aren't confused in practice. There is no separate `Education` collection: intern education history was scoped into the original build but **dropped from v1** (the collection and its registration-wizard step were removed; the README notes how to restore it if the program wants it back). There is also no `gender` field on `Intern` — it was collected in an earlier iteration and then removed outright (collection, registration wizard, API, CSV export, and types) at the program's request; `Trainer` never had one.

## 6. Feature Specifications & Clarifications Needed

### 6.1 Cohort Management

- A cohort can contain multiple tracks (truck driver/mechanic/ICT/supply chain/business management) running in parallel.
- **Closing a cohort** is a deliberate, admin-only action (access control restricts `Cohort.update` to admin), gated by a checklist enforced server-side before the status change to "closed" is saved: every trainer contract for the cohort must be `released`, and every still-in-progress intern in the cohort must have at least one `Evaluation` on record for that cohort and no unverified/rejected `Document`. This is plain validation logic, not a dedicated workflow engine.
- An intern who doesn't complete the cohort falls into one of two distinct paths, tracked on `Enrollment.outcome`:
  - **Termination:** account closed entirely — no Alumni Hub access.
  - **Resignation:** the intern transitions into the Alumni Hub with the same limited access as a graduate, rather than being archived separately.
  - Resigned (non-completing) interns are flagged internally as distinct from graduated ones, so Talent Board eligibility is limited to actual graduates while both still share the same Alumni Hub access.

### 6.2 Registration & Account Provisioning

Both interns and trainers self-register via an invite link personalized to their email. Admin creates an `Invite` record — email, role, and (for intern invites only) cohort and track; trainer invites carry no cohort, since a trainer isn't tied to one until admin prepares a contract for them later (§6.4). Only the invited email address can complete registration with the resulting link.

Invite links expire 24 hours after issue (checked lazily when the link is used, not via a cron) or can be revoked at admin's discretion. Registration is not immediate: after self-registering, the account sits in a `pending` status until admin reviews and approves it.

Registration runs as a multi-step wizard (`/register?token=...`):
- **Account** — name, password.
- **Profile** (trainer) / **Personal details** (intern) — occupation/organization/phone/postal address, or date of birth/nationality/phone/postal address.
- **Identification** — ID number and KRA PIN for both roles; SHIF and NSSF numbers additionally for interns.
- **Next of kin** (intern only) — name, relationship, phone (required), address and email (optional).
- **Review** — before final submit.

The wizard's own per-step checks are a UX convenience only; `POST /api/register` re-validates everything server-side and is the source of truth. Role and account email always come from the invite record, never from the request body, so a registrant can't self-assign a role or register under a different email. On registration, the endpoint creates the `User`, the role-appropriate profile row (`Intern` + `Enrollment`, or `Trainer`), and marks the invite `used`; if any step after the `User` create fails, everything created so far is rolled back and the invite is left `sent` so the same link can be retried. Both registration endpoints are rate-limited (5 attempts per 15 minutes per IP) since they're public and unauthenticated.

- **Minimum-age requirement:** not enforced at registration. Date of birth is still collected for statutory/records purposes.

### 6.3 Calendar & Reminders

- Channel: email (via Nodemailer).
- Reminder timing: 2 hours before session, sent by a queued background job.
- A trainer rescheduling a session (changing `scheduledDate`) resets its `reminderStatus` and queues a fresh reminder job targeted at the new time; the superseded job for the old time is left in the queue and detects at run time that a newer job already covers the session, so it's a safe no-op rather than sending a stale reminder.

### 6.4 Trainer Management & Contracts

Keep it simple: admin uploads the contract terms; the trainer downloads it, signs physically, scans, and uploads the signed copy. Trainer profile fields (occupation, organization, ID number, KRA PIN) are captured at self-registration (§6.2).

Contract lifecycle: **Draft → Sent → Signed → Active → Released**. Each single-step transition is checked against both access control (admin: any contract; trainer: only their own) and a role/from-state gate: Draft→Sent and Signed→Active and Active→Released are admin-only; Sent→Signed may be done by admin or the trainer themself. No other transition (skipping a step, moving backward) is permitted for anyone.

- **Who moves a contract to Released:** admin-only. A trainer can set `releaseRequested` to flag/request completion, but that field alone never moves the status — admin makes the final transition. Requesting release only makes sense once the engagement is actually underway, so `releaseRequested` can only be raised while the contract is Active.
- **Signing requires the signed scan:** the Sent→Signed transition is rejected unless a contract `file` (the signed, scanned copy) is already attached — either uploaded in the same request or already on the contract — so "Signed" can't be claimed without the evidence it's meant to record.
- A contract is always per-cohort — **not** auto-created at trainer self-registration (a trainer isn't tied to a cohort yet at that point, §6.2). Admin creates each `Contract` separately, once a cohort is lined up for that trainer; a trainer gets one contract per cohort they participate in.
- **Trainer row-level access is scoped to their own part of the process:** a trainer can write their own contract's `file`, `mediaConsent` and `releaseRequested`, and move `status` from Sent to Signed — but never repoint which `trainer` or `cohort` the contract belongs to; those two fields stay admin-only to write, even on a contract the trainer otherwise owns.
- **Per-session deliverables:** for each completed `Session`, the trainer submits a slide deck, a prose write-up of what was taught, the assignment given to interns, and an end-of-module assessment report — stored as `Note` attachments.
- **End-of-module test:** a standard structure of 25 questions (15 multiple-choice, 5 true/false, 1 case study worth 5 structured questions) per module, marked by the trainer, with results visible to **Admin** and that module's **Trainer** per the Score visibility rule in §4.
- **Session-count reference for invoicing:** since payment processing is out of scope (§3), the platform's job is only to give the trainer/admin an accurate count of completed sessions per cohort — the trainer still raises their own invoice against the agreed per-session rate outside the system.
- **Media consent:** `Contract.mediaConsent` captures the standing media-release clause from the Trainers Agreement (name/photo/video usable in promotional material). `Media.consentGiven` captures the equivalent per-asset consent for depicted interns/trainers.

### 6.5 Module Notes & Scores

Once a module completes and its score is finalized (`Score.finalized`), the intern can see that module's score immediately, rather than waiting until end-of-cohort for everything at once. A trainer's "own modules" scope is derived from which modules they've run sessions for (`Session.trainer`), since `Module` itself carries no trainer field.

- **Driving-skills checkpoint assessment (driver track only):** modeled as `Evaluation` records with `type` set to `driving-skills-baseline` or `driving-skills-final` — trainer-authored as an exception to the usual supervisor-authored `Evaluation`, and only for an intern actually enrolled in the truck-driving track for the named cohort.

### 6.6 Logbooks

Confirmed field structure for each type:

**Driver logbook** — per-trip entries: date, area, KMs driven, time (from–to), activities during the trip (dispatch, offloading, fueling, checkpoint), lessons from the trip.

**Non-driver logbook** — per-week entries: start date, end date, project assigned, activities/actions/required resources, notes.

Each intern keeps a single logbook, self-authored, with the Supervisor reviewing and commenting (`supervisorComment`) rather than authoring separate rollup entries — the sample driver logbook's second "Mentor Driver" sheet (a supervisor-authored rollup of distance driven/area/areas of improvement) was evaluated and dropped from the model as unnecessary. An intern may create or edit her own logbook entries only while her enrollment is still `in-progress`; once she's graduated, resigned, or been terminated, her logbook history becomes read-only (still visible, not editable) to her and to admin/her supervisor.

### 6.7 Document Vault

- Each document carries a **verification status** (pending / verified / rejected + reason) so admin can track compliance, not just storage. An intern can re-upload after a rejection but can't self-verify.
- **Confirmed document types:** National ID, driving licence, certificate of good conduct, SHA/SHIF, KRA PIN, NSSF, other.
- **Numbers vs. proof:** the vault holds the scanned/uploaded proof file only. The actual ID/KRA PIN/SHIF/NSSF *numbers* live as text fields on the Trainer/Intern profile (§5) instead — linked but distinct: the number is needed for contracts/records, the document here for compliance verification.

### 6.8 Supervisors

A departmental head acts as the Supervisor for an intern (or designates an appointee who takes on the role), assigned per-enrollment via `Enrollment.supervisor`. This drives which interns' logbooks, workplans, and evaluations a given supervisor can see.

### 6.9 Talent Board (Public)

- An explicit opt-in flag (`Alumna.optedIn`) controls whether a graduate appears; self-service, can be withdrawn at any time by the intern on her own profile.
- Public fields: profile photo, display name, course(s) pursued, work experience, and a narrative bio (soft skills, technical skills gained, notable achievements). Email and phone are each optional per listing.
- The public page (`/talent-board`) supports a keyword search and an employment-status filter, surfaced as query params. Only `optedIn` profiles belonging to actual graduates (not resigned/non-completing alumnae) are shown — enforced by cross-checking the linked intern's `Enrollment.outcome`.
- The talent board is view-only for the public. Employers interested in a graduate contact admin directly rather than messaging the graduate through the platform.

### 6.10 Alumni Hub

Alumni can make limited edits to their own profile (employment status, talent board fields) regardless of graduated/resigned outcome, but their logbook history becomes read-only once they leave the cohort (§6.6). Both graduated and resigned alumnae share the same Alumni Hub read access, including `Announcement`s — a still-in-progress intern, trainer, or supervisor has no Alumni Hub to read announcements in.

### 6.11 Admin Exports

Confirmed export destination: a straight Excel download (`GET /api/export/<collection>`), admin-only. Each exportable collection (Users, Trainers, Interns, Enrollments, Contracts, Sessions, Scores, Evaluations, Logbooks, Documents, Alumnae) has its own hand-written column list with human-readable values rather than a generic field dump of raw relationship IDs. Sensitive personal fields — date of birth, ID number, KRA PIN, SHIF number, NSSF number — are deliberately omitted from every export definition that would otherwise include them (§7). No Google Drive export; can be revisited later if needed.

## 7. Non-Functional Requirements

- **Availability:** not a 24/7 mission-critical system, but reminders and document uploads need to work reliably around training dates.
- **Audit trail:** covered by Payload's built-in version history on collections — who changed what, when, and the prior value, restorable to an earlier version. No separate compliance-grade audit log for v1.
- **Integrations:** outbound email via Nodemailer for reminders (§6.3). No Google Drive integration.
- **Hosting:** a persistent server process (not fully serverless), needed for the reminders job queue to run reliably.
- **Data protection:** national ID/passport numbers, KRA PINs, SHIF/NSSF numbers, and date of birth are sensitive personal data under Kenya's Data Protection Act, 2019. Row-level access control already limits reads of these fields to admin or the record's own owner; bulk exports additionally omit them outright (§6.11), and the public Talent Board (`Alumna`) never references the `Trainer`/`Intern` profile collections that hold them.
- **Abuse resistance:** the public, unauthenticated registration endpoints (`GET`/`POST /api/register`) are rate-limited per source IP to resist token-guessing and signup-flooding.

## 8. Suggested Phased Rollout

| Phase | Features                                                                                                                   | Rationale                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | Cohort management, document vault, logbooks, supervisor access, admin exports                                                 | Core daily-use functions; needed from day one of any cohort   |
| 2     | Trainer management & contracts, module notes, scores & assessments (incl. driving-skills checkpoints), calendar & reminders   | Delivery and assessment layer                                  |
| 3     | Media library, talent board, alumni hub                                                                                       | Supporting/reporting features                                  |

## 9. Cross-Check Against Supporting Documents — Summary

This proposal was checked against the original pitch deck, the sample Drivers logbook (xlsx), the sample Non-drivers logbook (docx), the sample Drivers alumni profiles (pdf), the sample Trainers Agreement (docx), and a technical evaluation of the Payload CMS platform (§10), and then re-checked against the implementation as it was built out over a series of PRs. All items are resolved:

- Program Director / Program Consultant / Program Coordinator → all map to the **Admin** role (§4).
- "Mentor" (drivers logbook) rollup log → dropped, not built (§6.6).
- Audit trail → scoped to the platform's built-in version history, not a compliance-grade log (§7, §10).
- Status transitions (contract lifecycle, cohort-closing checklist) → enforced with plain validation logic, not a workflow engine (§6.1, §6.4, §10).
- Contract release → admin-only (§6.4).
- The pre/post driving-skills assessment → trainer-authored `Evaluation` records (§6.5).
- Hosting → a persistent server process (§7, §10).
- Google Drive export → dropped from v1 scope; Excel download only (§6.11).
- Trainer vs. intern invite mechanism → both self-register via the same email-personalized invite, generated per person by admin; only intern invites carry a cohort (§6.2).
- Minimum-age requirement at registration → not enforced for v1 (§6.2).
- `Session` naming → kept as-is despite the auth-session name collision (§5).
- Intern education history → built, then dropped from v1 after the program decided it wasn't needed yet; can be restored later (§5).
- Intern `gender` field → built, then removed entirely at the program's request — not just the label, the whole field (§5).
- `nationalIdNumber` → renamed to `idNumber` ("ID Number", no passport wording) on Trainer/Intern, the registration API, and the wizard (§5).
- `address` → relabeled "Postal Address" (label only; the underlying field key stays `address`) (§5, §6.2).
- Trainer profile → gained an optional `organization` field, not in the original data model (§5).
- Trainer invites and contracts → trainers are not tied to a cohort at invite or registration time; a contract is always per-cohort and created separately by admin once a cohort is lined up, rather than auto-created at registration (§6.2, §6.4).

**Open — confirm before further build:** none currently outstanding.

## 10. Recommended Tech Stack

Built on **Payload CMS 3.89** on **Next.js 16** (React 19), a code-first Node framework with an auto-generated admin UI. This is a good match because the data model is, structurally, about fifteen relational entities (§5) behind fine-grained, per-role, per-record permissions (§4) — exactly what Payload's access-control model is built for.

- **Permissions matrix (§4):** access-control functions run per collection, per field, and per operation, and return row-level query constraints rather than a flat yes/no — e.g. "trainer may read Scores only where they've run a session for that module," "supervisor may read logbook entries only for their assigned interns." This maps directly onto the matrix in §4.
- **Admin UI:** every collection in §5 gets a generated admin screen automatically — most of cohort management, the document vault, logbooks, and scores ship as configured collections rather than hand-built screens.
- **Audit trail (§7):** Payload's built-in version history covers this — no paid add-on required.
- **Status transitions (§6.1, §6.4):** no separate workflow engine — the contract lifecycle and the cohort-closing checklist are each a plain validation check run in a `beforeChange` hook.
- **File uploads:** the Document Vault and Media Library map to upload-enabled collections (`Files`, `Images`, `Media`) with MIME-type restrictions.
- **Reminders (§6.3):** Payload's job queue plus a Nodemailer email adapter schedule the 2-hour-before-session reminder and the reschedule re-notification, running on a persistent server process.
- **Admin exports (§6.11):** a dedicated `GET /api/export/<collection>` endpoint streams an Excel workbook built from a curated, per-collection column registry — no Google Drive/OAuth integration needed.
- **Frontend:** the public-facing pages (home, Talent Board, self-registration) are built with Tailwind CSS v4 on a shared `PageShell`/`SiteHeader`/`SiteFooter` layout, under the She Delivers brand: mauve (`#977591`) and orange (`#F5882F`) accent palettes, Jost as the display typeface, and the footer tagline "A Pontypridd Holdings Initiative."
- **Cost:** core Payload is free and self-hosted; ongoing cost is hosting only (roughly $10–500+/month depending on scale).

## Appendix: Project Team (from pitch deck)

| Workstream       | Owner          | What they do                                                                                                                         |
| ------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Project leadership | Stella Mputhia | Provides strategic direction and approves key decisions.                                                                                 |
| Technical build    | Augustus       | Designs, builds, configures, tests, deploys, and maintains the Management System platform based on approved requirements, including integrations, security, functionality, and technical improvements. Shares weekly progress. |
| Project support    | Winnie M       | Provides content and workflows as required, manages adoption and continuous improvement, tests the system from a user perspective.     |
| Training users     | Augustus       | —                                                                                                                                         |
