# She Delivers Management System — Proposal

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

**Out of scope (v1):** payment/stipend processing, e-learning/LMS content delivery, employer-side applicant tracking, mobile native apps (web-responsive only).

> Note: the sample Trainers Agreement sets a rate (sh.7,500 per 2-hour session, less 5% withholding tax) and has the trainer invoice the company directly. Actual payment stays out of scope for v1 as stated above — the system's role is limited to producing the session-count evidence a trainer needs to raise that invoice (see §6.4).

## 4. User Roles & Permissions Matrix

| Capability                     | Admin         | Trainer                        | Intern                       | Supervisor            | Public |
| ------------------------------ | ------------- | ------------------------------- | ----------------------------- | ---------------------- | ------ |
| Create/close cohorts           | ✅            | ❌                              | ❌                            | ❌                     | ❌     |
| Sign & manage own contract     | ✅ (view all) | ✅ (own)                        | ❌                            | ❌                     | ❌     |
| Pick training dates            | ✅            | ✅ (own modules)                | ❌                            | ❌                     | ❌     |
| Post module notes/scores       | ✅ (view all) | ✅ (own modules only)           | ❌                            | ❌                     | ❌     |
| View scores                    | ✅ (all)      | ✅ (own modules only)           | ✅ (own only)                 | ❌                     | ❌     |
| Register / manage own profile  | ✅            | ✅                              | ✅                            | ✅                     | ❌     |
| Upload statutory documents     | ✅ (any)      | ❌                              | ✅ (own)                      | ❌                     | ❌     |
| Update own logbook             | ❌            | ❌                              | ✅                            | ❌                     | ❌     |
| Review/comment on logbooks     | ✅            | ❌                              | ❌                            | ✅ (assigned interns)  | ❌     |
| Submit workplans & evaluations | ❌            | ❌                              | ❌                            | ✅                     | ❌     |
| Media library access           | ✅ (all)      | ❌ (unless granted per cohort)  | ❌                             | ❌                     | ❌     |
| View talent board               | ✅            | ❌                              | ❌                            | ❌                     | ✅     |
| Edit own talent board listing  | ✅            | ❌                              | ✅ (post-graduation, opt-in)  | ❌                     | ❌     |
| Bulk export                     | ✅            | ❌                              | ❌                            | ❌                     | ❌     |
| Alumni Hub announcements       | ✅            | ❌                              | ❌                            | ❌                     | ❌     |

**Role mapping decisions (confirmed):**
- The Trainers Agreement refers to a *Program Director*, *Program Consultant*, and *Program Coordinator* — these are job titles for people operating the **Admin** account, not separate system roles. No extra permission tier is needed for them.
- The Drivers Logbook's "Mentor Driver" sheet and the proposal's **Supervisor** are the same person/role — the mentor-logged entries (distance driven, area, areas of improvement) are Supervisor-authored records, not a distinct role (see §6.6).

## 5. Core Entities (Data Model Overview)

- **User** → role, contact info, status (active/inactive)
- **Cohort** → name, track(s), start/end date, status (draft → open → active → closed)
- **Enrollment** → links Intern ↔ Cohort ↔ Track (a cohort may run multiple tracks concurrently)
- **Contract** → party (trainer), cohort, status (draft → sent → signed → active → released/discharged), file, agreed rate per session (reference only, not processed for payment)
- **Module** → track, name, curriculum reference
- **TrainingSession** → module, trainer, cohort, scheduled date, status (scheduled/completed/rescheduled/cancelled), reminder status
- **ModuleNote** → session, trainer, content, attachments (session slides, prose write-up, assignment given, end-of-module assessment report)
- **Score** → intern, module, trainer, value, notes, visibility scope
- **LogbookEntry** → intern, week/trip, type (driver/non-driver), author (intern self-entry / supervisor observation), content, supervisor comment, status
- **Evaluation** → intern, author (supervisor; trainer for the driving-skills checkpoints — see §6.5), cohort, criteria, outcome
- **Workplan** → supervisor, intern, cohort, content
- **Document** → intern, type (ID / driving licence / certificate of good conduct / SHA / KRA PIN / NSSF / other), file (PDF/JPEG/other allowed formats), verification status
- **MediaAsset** → cohort, file, visibility scope (admin-only / cohort-extended), consent flag (whether the depicted intern/trainer has consented to promotional use)
- **AlumniProfile** → intern (post-graduation), photo, employment status, opt-in flag, public bio
- **Announcement** → alumni hub, admin-authored

## 6. Feature Specifications & Clarifications Needed

### 6.1 Cohort Management

- A cohort can contain multiple tracks (truck driver/mechanic/ICT/supply chain/business management) running in parallel.
- **Closing a cohort** should be a deliberate, admin-confirmed action (not automatic on end-date) with a checklist: all evaluations submitted, all documents verified, all contracts released — before interns migrate to Alumni Hub.
- An intern who doesn't complete the cohort falls into one of two distinct paths:
  - **Termination** (e.g. disciplinary, policy violation): account is closed entirely — no Alumni Hub access.
  - **Resignation** (voluntary exit): the intern transitions into the Alumni Hub with limited access, same as a graduate, rather than being archived separately.
  - Resigned (non-completing) alumni are flagged internally as distinct from graduated alumni, so Talent Board eligibility can be limited to actual graduates while both still share the same Alumni Hub access.
- The closing checklist itself (all evaluations submitted, all documents verified, all contracts released) is enforced with a straightforward validation check before the status change to "closed" is saved — plain guard logic, not a dedicated workflow engine (see §10).

### 6.2 Registration & Account Provisioning

Interns self-register via a cohort-specific invite link sent via email. Admin generates the link per cohort when it opens; anyone with it can create an account and is auto-enrolled in that cohort's track.

Invite links expire 24 hours after issue, or can be revoked at admin's discretion (e.g. if leaked). Registration is not immediate: after self-registering, the account sits in a pending-approval state until admin reviews and approves it — target turnaround for admin approval is also 24 hours.

### 6.3 Calendar & Reminders

- Channel: email (for now).
- Reminder timing: 2 hours before session
- A trainer can reschedule after interns are already notified, and that should trigger an automatic re-notification.

### 6.4 Trainer Management & Contracts

Keep it simple for now: admin uploads the contract terms; the trainer downloads it, signs physically, scans, and uploads the signed copy.

Contract lifecycle state machine: **Draft → Sent → Signed → Active → Released/Discharged**, giving admin a clear audit trail. Each transition is enforced with a straightforward validation check (which role may move it, and from which prior state) — no dedicated workflow engine needed (see §10).

- **Who moves a contract to Released/Discharged:** **confirmed — admin-only.** A trainer can flag/request completion, but admin makes the final transition, keeping the audit trail clean.

- **Per-session deliverables:** for each completed `TrainingSession`, the trainer submits a slide deck and a prose write-up of what was taught, the assignment given to interns, and an end-of-module assessment report — stored as `ModuleNote` attachments.

- **End-of-module test:** a standard structure of 25 questions (15 multiple-choice, 5 true/false, 1 case study worth 5 structured questions) per module. The trainer marks it and shares results — previously addressed to Program Director/Consultant/Coordinator, now simply visible to **Admin** and that module's **Trainer**, per the existing Score visibility rule in §4.

- **Session-count reference for invoicing:** since payment processing is out of scope (§3), the platform's job is only to give the trainer/admin an accurate count of completed sessions per cohort — the trainer still raises their own invoice against the agreed per-session rate outside the system.

- **Media consent:** the sample Trainers Agreement includes a standing media-release clause (name/photo/video usable in promotional material). Recommend capturing an equivalent consent flag for **interns** too — distinct from the Talent Board opt-in in §6.9 — before any of their photos/video are reused in promotional materials beyond the Media Library itself.

### 6.5 Module Notes & Scores

Once a module completes and its score is finalized, the intern can see that module's score (rather than waiting until end-of-cohort for everything at once).

- **Driving-skills checkpoint assessment (driver track only) — confirmed as `Evaluation`:** the trainer assesses each driver-track intern's driving skills twice — once near the start of engagement (baseline) and once just before graduation (final). These are recorded as two `Evaluation` records tied to the driving track, trainer-authored as an exception to the usual supervisor-authored Evaluation (see §5).

### 6.6 Logbooks

Confirmed field structure for each type (verified against the sample files):

**Driver logbook** — header: **Intern Name**. Per-trip entries: Date, Area, No. of KMs driven, Time (From–To), Activities during trip (dispatch, offloading, fueling, checkpoint), Lessons from trip, Supervisor signature.

**Non-driver logbook** (per-week entries, header + activity rows): Header = Intern Name, Start Date, End Date, Supervisor Name. Per week: Date, Project Assigned/Assignment, Activities/Actions/Required Resources, Notes, Supervisor signature.

- **Supervisor rollup entries (driver track):** alongside the intern's own per-trip entries above, the sample driver logbook has a second sheet where the Supervisor (referred to there as "Mentor" — confirmed as the same role, see §4) logs, per intern under their watch: Date, Distance driven, Area/Region, Areas of improvement, plus their own comment and signature. This is a **Supervisor-authored** rollup of the same intern's driving progress, not a separate intern-facing log — model it as `LogbookEntry` records with `author = supervisor` alongside the intern's own `author = self` entries, distinguished in the UI as "Supervisor observations."

### 6.7 Document Vault

- Add a **verification status** per document (pending / verified / rejected + reason) so admin can track compliance, not just storage.
- **Confirmed document types** (from the pitch deck): National ID, driving licence, certificate of good conduct, SHA, KRA PIN, NSSF — accepted as PDF, JPEG, or other admin-allowed formats.

### 6.8 Supervisors

A departmental head acts as the Supervisor (or designates an appointee who takes on the Supervisor role for that intern). This same role also covers the driver-track "Mentor" rollup logging described in §6.6.

### 6.9 Talent Board (Public)

- Add an explicit opt-in step at graduation where the alumna chooses to appear, and a self-service way to update or remove her listing at any time.
- Public fields: **Profile photo**, Name, Course(s) pursued (e.g. specific driving class certifications, defensive driving certification, diploma/course names and issuing institutions), Work experience, and a narrative skills/ability summary (short written paragraph covering soft skills, technical skills gained, notable achievements). Email and phone number are each optional per listing — several sample alumni profiles list only a phone number, or only an email, not always both.
- The talent board is view-only for the public. Employers interested in a graduate contact admin directly (e.g. via a contact form or listed admin email/phone) rather than messaging the graduate through the platform — admin acts as the intermediary.

### 6.10 Alumni Hub

Alumni can make limited edits to their own profile (e.g. employment status, talent board fields), but their logbook history becomes read-only once the cohort ends — they can view past entries but not modify them.

Since alumni "cannot re-register as new interns," the system needs a check preventing an alumna from being enrolled in a future cohort under the same account.

### 6.11 Admin Exports

- Confirmed export destination for v1: a straight **Excel** download. Google Drive export is dropped from scope for now — no Drive integration/OAuth dependency to build. Can be revisited later if the need comes up.

## 7. Non-Functional Requirements

- **Availability:** define acceptable downtime — this isn't a 24/7 mission-critical system, but reminders and document uploads need to work reliably around training dates.
- **Audit trail:** version history on Contracts, Scores, and Document verification status — who changed what, when, and the prior value, restorable to an earlier version. This is covered by the platform's built-in version history (§10); no separate compliance-grade audit log is needed for v1.
- **Integrations:** outbound email (reminders, §6.3), needed before Phase 2 go-live. No Google Drive integration for v1 (§6.11).
- **Hosting:** confirmed as a persistent server process (not fully serverless) — needed for the reminders job queue to run reliably (§10).

## 8. Suggested Phased Rollout

| Phase | Features                                                                        | Rationale                                                     |
| ----- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | Cohort management, document vault, logbooks (incl. supervisor rollup entries), supervisor access, admin exports | Core daily-use functions; needed from day one of any cohort   |
| 2     | Trainer management & contracts, module notes, scores & assessments (incl. driving-skills checkpoints), calendar & reminders | Delivery and assessment layer                                  |
| 3     | Media library, talent board, alumni hub                                        | Supporting/reporting features                                  |

## 9. Cross-Check Against Supporting Documents — Summary

This pass compared the proposal against the original pitch deck, the sample Drivers logbook (xlsx), the sample Non-drivers logbook (docx), the sample Drivers alumni profiles (pdf), and the sample Trainers Agreement (docx). Resolved items are folded into the sections above; the two structural ambiguities found were resolved with you directly:

- Program Director / Program Consultant / Program Coordinator → all map to the **Admin** role (§4).
- "Mentor" (drivers logbook) → same role as **Supervisor** (§4, §6.6).

Following a technical evaluation (Payload CMS — §10), two earlier implementation questions are now settled rather than open: the audit trail is scoped to the platform's built-in version history, and status transitions (contract lifecycle, cohort-closing checklist) are enforced with plain validation logic rather than a dedicated workflow engine.

All earlier open items are now resolved:

- Contract release/discharge — confirmed admin-only (§6.4).
- The pre/post driving-skills assessment — confirmed as trainer-authored `Evaluation` records (§6.5).
- Hosting — confirmed as a persistent server process (§7, §10).
- Google Drive export — dropped from v1 scope; Excel download only (§6.11).

## 10. Recommended Tech Stack

Proposed build platform: **Payload CMS** (currently v3.x, MIT-licensed, free and self-hosted) — a code-first Node/Next.js framework with an auto-generated admin UI, rather than a traditional content-only CMS. It's a good match here because this proposal is, structurally, about fifteen relational entities (§5) behind fine-grained, per-role, per-record permissions (§4) — exactly what Payload's access-control model is built for.

- **Permissions matrix (§4):** access-control functions run per collection, per field, and per operation, and can return row-level query constraints rather than a flat yes/no — e.g. "trainer may read Scores only where the module's trainer is themself," "supervisor may read logbook entries only for their assigned interns." This maps directly onto the matrix in §4.
- **Admin UI:** the collections in §5 (Cohort, Contract, Module, TrainingSession, Score, LogbookEntry, Document, MediaAsset, AlumniProfile, etc.) get generated admin screens automatically — most of cohort management, the document vault, logbooks, and scores ship as configured collections rather than hand-built screens.
- **Audit trail (§7):** built-in version history covers this — every change to a Contract, Score, or Document verification status is recorded with who, when, and the prior value, and can be restored. That's the audit trail this system needs for v1; no paid add-on required.
- **Status transitions (§6.1, §6.4):** no separate workflow engine — the contract lifecycle and the cohort-closing checklist are each a plain validation check run before a status change saves.
- **File uploads:** the Document Vault and Media Library map to upload-enabled collections with cloud storage (e.g. S3) and MIME-type restrictions (PDF/JPEG).
- **Reminders (§6.3):** a built-in job queue plus an email adapter (Nodemailer/Resend/SendGrid) can schedule the 2-hour-before-session reminder and the reschedule re-notification, running on the confirmed persistent server (§7).
- **Admin exports (§6.11):** Excel download only for v1 — a straightforward export endpoint, no Google Drive/OAuth integration needed.
- **Cost:** core Payload is free and self-hosted; ongoing cost is hosting only (roughly $10–500+/month depending on scale).

## Appendix: Project Team (from pitch deck)

| Workstream          | Owner          | What they do                                                                                                                       |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Project leadership    | Stella Mputhia | Provides strategic direction and approves key decisions.                                                                             |
| Technical build       | Augustus       | Designs, builds, configures, tests, deploys, and maintains the Management System platform based on approved requirements, including integrations, security, functionality, and technical improvements. Shares weekly progress. |
| Project support       | Winnie M       | Provides content and workflows as required, manages adoption and continuous improvement, tests the system from a user perspective. |
| Training users        | Augustus       | —                                                                                                                                    |
