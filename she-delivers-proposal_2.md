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

**Role mapping decision (confirmed):** the Trainers Agreement refers to a *Program Director*, *Program Consultant*, and *Program Coordinator* — these are job titles for people operating the **Admin** account, not separate system roles. No extra permission tier is needed for them.

## 5. Core Entities (Data Model Overview)

- **User** → role, status (active/inactive)
- **Trainer** → user, name, occupation, address, phone, email, national identifier/passport number, KRA PIN
- **Intern** → user, name, date of birth, gender, nationality, address, phone, email, national identifier/passport number, KRA PIN, SHIF number, NSSF number, next-of-kin name, next-of-kin relationship, next-of-kin address, next-of-kin phone, next-of-kin email (exactly one required contact — flat fields, not a separate entity; see §9)
- **Education** → intern, school, start date, end date, qualification (repeatable — an intern may list more than one)
- **Invite** → cohort, role (intern/trainer), email, token, status (sent/used/expired/revoked), expires at
- **Cohort** → name, track(s), start/end date, status (draft → open → active → closed)
- **Enrollment** → links Intern ↔ Cohort ↔ Track (a cohort may run multiple tracks concurrently)
- **Contract** → party (trainer), cohort, status (draft → sent → signed → active → released/discharged), file, agreed rate per session (reference only, not processed for payment)
- **Module** → track, name, curriculum reference
- **Session** → module, trainer, cohort, scheduled date, status (scheduled/completed/rescheduled/cancelled), reminder status *(see naming note below)*
- **Note** → session, trainer, content, attachments (session slides, prose write-up, assignment given, end-of-module assessment report)
- **Score** → intern, module, trainer, value, notes, visibility scope
- **Logbook** → intern, week/trip, type (driver/non-driver), content, supervisor comment, status
- **Evaluation** → intern, author (supervisor; trainer for the driving-skills checkpoints — see §6.5), cohort, criteria, outcome
- **Workplan** → supervisor, intern, cohort, content
- **Document** → intern, type (ID / driving licence / certificate of good conduct / SHA/SHIF / KRA PIN / NSSF / other), file (PDF/JPEG/other allowed formats), verification status
- **Media** → cohort, file, visibility scope (admin-only / cohort-extended), consent flag (whether the depicted intern/trainer has consented to promotional use)
- **Alumna** → intern (post-graduation), photo, employment status, opt-in flag, public bio
- **Announcement** → alumni hub, admin-authored

**Naming notes:** every entity above is a single word except where flagged. *Session* is single-word and fits the domain ("training session"); it also happens to be the standard term for a login/auth session in web frameworks (including Payload), but this is **confirmed to keep the name as-is** — the two concepts sit in clearly different parts of the codebase (a `Session` collection vs. Payload's internal auth session) and won't be confused in practice. There is no separate `Kin` entity — next-of-kin is a single required contact, folded into `Intern` as flat fields (§9) — so no naming call was needed there. Every other rename (Trainer, Intern, Education, Session, Note, Logbook, Media, Alumna) reads cleanly on its own.

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

**Both interns and trainers self-register**, via an invite link personalized to their email — admin enters the person's email address (plus their role and cohort) to generate and send it, rather than one shareable link per cohort. Only that email address can complete registration with it: interns are auto-enrolled in that cohort's track, trainers are associated with that cohort ahead of their contract (§6.4).

Invite links expire 24 hours after issue, or can be revoked at admin's discretion (e.g. entered the wrong email, or the person is no longer eligible). Registration is not immediate for either role: after self-registering, the account sits in a pending-approval state until admin reviews and approves it — target turnaround for admin approval is also 24 hours.

- **Intern fields collected at self-registration:** personal (name, date of birth, gender, nationality), contact (address, phone, email), statutory (national identifier/passport number, KRA PIN, SHIF number, NSSF number), education history (school, start date, end date, qualification — repeatable), and next of kin (name, relationship, address, phone, email — exactly one required contact).
- **Trainer fields collected at self-registration:** personal (name, occupation), contact (address, phone, email), statutory (national identifier/passport number, KRA PIN).
- **Minimum-age requirement — confirmed not needed at this point.** Date of birth is still collected (statutory/records purposes), but registration does not enforce an age gate for v1. Can be revisited later if it becomes necessary.

### 6.3 Calendar & Reminders

- Channel: email (for now).
- Reminder timing: 2 hours before session
- A trainer can reschedule after interns are already notified, and that should trigger an automatic re-notification.

### 6.4 Trainer Management & Contracts

Keep it simple for now: admin uploads the contract terms; the trainer downloads it, signs physically, scans, and uploads the signed copy. (Trainer profile fields are captured at self-registration, §6.2 — the KRA PIN there is what the 5% withholding-tax handling below depends on.)

Contract lifecycle state machine: **Draft → Sent → Signed → Active → Released/Discharged**, giving admin a clear audit trail. Each transition is enforced with a straightforward validation check (which role may move it, and from which prior state) — no dedicated workflow engine needed (see §10).

- **Who moves a contract to Released/Discharged:** **confirmed — admin-only.** A trainer can flag/request completion, but admin makes the final transition, keeping the audit trail clean.

- **Per-session deliverables:** for each completed `Session`, the trainer submits a slide deck and a prose write-up of what was taught, the assignment given to interns, and an end-of-module assessment report — stored as `Note` attachments.

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

The sample driver logbook's second sheet ("Mentor Driver" — distance driven, area, areas of improvement per intern) is dropped: not needed, so it's out of the model. Each intern keeps a single logbook, self-authored, with the Supervisor reviewing and commenting (§4) — no separate rollup log.

### 6.7 Document Vault

- Add a **verification status** per document (pending / verified / rejected + reason) so admin can track compliance, not just storage.
- **Confirmed document types** (from the pitch deck): National ID, driving licence, certificate of good conduct, SHA/SHIF, KRA PIN, NSSF — accepted as PDF, JPEG, or other admin-allowed formats.
- **Numbers vs. proof:** the Document Vault holds the scanned/uploaded proof file; the actual ID, KRA PIN, SHIF, and NSSF *numbers* now live as text fields on the Trainer/Intern statutory profile (§5) — the two are linked but distinct, and both are needed (the number for contracts/records, the scanned document for compliance verification).

### 6.8 Supervisors

A departmental head acts as the Supervisor (or designates an appointee who takes on the Supervisor role for that intern).

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
- **Data protection:** national ID/passport numbers, KRA PINs, SHIF/NSSF numbers, and date of birth (§5) are sensitive personal data under Kenya's Data Protection Act, 2019. Recommend field-level access restrictions on these (not exposed in bulk exports or on the public talent board) — see the access-control approach in §10.

## 8. Suggested Phased Rollout

| Phase | Features                                                                        | Rationale                                                     |
| ----- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | Cohort management, document vault, logbooks, supervisor access, admin exports | Core daily-use functions; needed from day one of any cohort   |
| 2     | Trainer management & contracts, module notes, scores & assessments (incl. driving-skills checkpoints), calendar & reminders | Delivery and assessment layer                                  |
| 3     | Media library, talent board, alumni hub                                        | Supporting/reporting features                                  |

## 9. Cross-Check Against Supporting Documents — Summary

This pass compared the proposal against the original pitch deck, the sample Drivers logbook (xlsx), the sample Non-drivers logbook (docx), the sample Drivers alumni profiles (pdf), and the sample Trainers Agreement (docx), plus a technical evaluation of the Payload CMS platform (§10). Resolved items are folded into the sections above; this list is the running record of what's settled and what's still open.

**Resolved:**
- Program Director / Program Consultant / Program Coordinator → all map to the **Admin** role (§4).
- "Mentor" (drivers logbook) rollup log — dropped, not built (§6.6).
- Audit trail — scoped to the platform's built-in version history, not a compliance-grade log (§7, §10).
- Status transitions (contract lifecycle, cohort-closing checklist) — enforced with plain validation logic, not a workflow engine (§6.1, §6.4, §10).
- Contract release/discharge — confirmed admin-only (§6.4).
- The pre/post driving-skills assessment — confirmed as trainer-authored `Evaluation` records (§6.5).
- Hosting — confirmed as a persistent server process (§7, §10).
- Google Drive export — dropped from v1 scope; Excel download only (§6.11).
- Trainer vs. intern invite mechanism — both self-register via the same email-personalized invite, generated per person by admin (§6.2).
- Minimum-age requirement at registration — confirmed not needed for v1 (§6.2).
- `Session` naming — confirmed to keep the name as-is (§5).
- `Education`/next-of-kin cardinality — `Education` stays repeatable (an intern may list more than one qualification); next-of-kin is capped at exactly one required contact and folded into `Intern` as flat fields rather than kept as a separate `Kin` entity (§5).

**Open — confirm before build:** none currently outstanding — all cross-check items above are resolved.

## 10. Recommended Tech Stack

Proposed build platform: **Payload CMS** (currently v3.x, MIT-licensed, free and self-hosted) — a code-first Node/Next.js framework with an auto-generated admin UI, rather than a traditional content-only CMS. It's a good match here because this proposal is, structurally, about fifteen relational entities (§5) behind fine-grained, per-role, per-record permissions (§4) — exactly what Payload's access-control model is built for.

- **Permissions matrix (§4):** access-control functions run per collection, per field, and per operation, and can return row-level query constraints rather than a flat yes/no — e.g. "trainer may read Scores only where the module's trainer is themself," "supervisor may read logbook entries only for their assigned interns." This maps directly onto the matrix in §4.
- **Admin UI:** the collections in §5 (Trainer, Intern, Cohort, Contract, Module, Session, Score, Logbook, Document, Media, Alumna, etc.) get generated admin screens automatically — most of cohort management, the document vault, logbooks, and scores ship as configured collections rather than hand-built screens.
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
