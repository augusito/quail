# She Delivers Management System — CMS

Payload CMS backend for the She Delivers cohort management system. See
[`../she-delivers-proposal.md`](../she-delivers-proposal.md) for the full
requirements this scaffold implements.

## Stack

- [Payload CMS](https://payloadcms.com) 3.x (Next.js, code-first, auto-generated admin UI)
- **Postgres** in production, **SQLite** for local dev/tests — no external
  database needed to get started (proposal §7, §10)

## Development

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000/admin` and follow the prompts to create your
first admin user. `.env` defaults to SQLite (`PAYLOAD_DATABASE=sqlite`), so
no database setup is required locally.

## Switching to Postgres

Set in `.env`:

```
PAYLOAD_DATABASE=postgres
DATABASE_URL=postgres://user:password@127.0.0.1:5432/she-delivers
```

`docker-compose.yml` can spin up a local Postgres instance for this.

## Collections

Mapped from the proposal's data model (§5):

| Collection | Proposal ref |
| --- | --- |
| `users` | §4 roles: admin / trainer / intern / supervisor |
| `cohorts` | §6.1 |
| `enrollments` | §6.1 |
| `invites` | §6.2 |
| `contracts` | §6.4 |
| `modules`, `training-sessions` | §6.3, §6.4 |
| `module-notes` | §6.4 |
| `scores` | §6.5 |
| `logbook-entries` | §6.6 |
| `evaluations` | §6.5 |
| `workplans` | §5 |
| `documents` | §6.7 |
| `media`, `files`, `media-assets` | uploads (general / documents / consent-tracked cohort media, §6.4) |
| `alumni-profiles` | §6.9, §6.10 |
| `announcements` | §6.10 |

## Access control

Every collection's `access` config enforces the §4 permissions matrix —
see `src/access/roles.ts` for the shared role helpers and the global
principle (admin is always a superuser) and `src/access/scoping.ts` for the
query-based row-level scoping (e.g. "supervisor may only see their assigned
interns", "trainer may only see their own modules"). Sensitive fields
(`Users.role`/`status`, `Documents.verificationStatus`) are additionally
locked to admin-only write via field-level access. Covered by
`tests/int/access.int.spec.ts`.

Known gaps, called out in comments at their collection:

- The §4 "media library access… unless granted per cohort" trainer
  exception isn't modeled (`MediaAssets` is admin-only for now)
- `Files` read access is any-authenticated-user rather than scoped through
  the referencing Contract/Document/ModuleNote, since that needs a
  cross-collection join per request (see comment in `Files.ts`)
- `Announcements` read is any-authenticated-user rather than
  alumni-specific, since "alumni" is an `Enrollment.outcome` value, not a
  `Users.role` this schema can filter collection access by

## Workflow guards

Two `beforeChange` hooks enforce the "plain validation logic, no workflow
engine" guards §6.1/§6.4/§10 ask for, layered on top of (not instead of)
the access control above:

- **Contract lifecycle** (`src/hooks/contractLifecycle.ts`, on `Contracts`)
  — enforces the Draft → Sent → Signed → Active → Released/Discharged
  order one step at a time (no skipping, no going backward) and which role
  may make each specific transition: admin for every step except
  Sent→Signed, which the contract's own trainer may also make (uploading
  their signed scan back). Only admin may ever move a contract to
  Released/Discharged, matching the proposal's confirmed decision. A
  trainer "flagging/requesting completion" (§6.4) is the separate
  `releaseRequested` checkbox — it doesn't itself change `status`.
- **Cohort closing checklist** (`src/hooks/cohortClosingChecklist.ts`, on
  `Cohorts`) — blocks a transition to `closed` unless every
  still-in-progress enrollment in that cohort has at least one Evaluation
  on record and no pending/rejected Document, and every Contract for that
  cohort is Released/Discharged. This is a literal, simplified reading —
  it doesn't check evaluations are complete *per track* (e.g. both
  driving-skills checkpoints for a driver-track intern); see the comment
  in that file.

Both hooks are skipped for trusted system-level calls (local API calls
made with no `req.user`, e.g. seed/migration scripts) the same way access
control is bypassed by `overrideAccess: true`. Covered by
`tests/int/lifecycle.int.spec.ts`.

## Invite-link registration (§6.2)

Admin creates an `Invites` record (`cohort` + `track` — a cohort can run
multiple tracks in parallel, §6.1, so an invite is scoped to one). A
`beforeChange` hook auto-generates the `token` and sets `expiresAt` 24h out
(§6.2); an `afterChange` hook logs the resulting link —
**email integration isn't implemented yet, so this is console-only** for
now (`[invite] cohort=... track=... link=http://.../register?token=...`,
via `payload.logger.info`, wired to `PAYLOAD_PUBLIC_SERVER_URL` if set).

`POST /api/register` (`src/endpoints/register.ts`) is the public,
unauthenticated counterpart: given `{ token, email, password, name? }`, it
validates the invite (exists, not revoked, not expired), then creates the
User and its Enrollment on the registrant's behalf via `overrideAccess`
(both collections are otherwise admin-only). `role` and `status` are
always hardcoded server-side (`intern` / `pending`) — never read from the
request body, so a registrant can't self-assign a role or skip approval.
Admin reviews `status: pending` users and flips them to `active` through
the existing Users collection (already admin-only, no extra guard needed
for *who* can approve). A `beforeLogin` hook
(`src/hooks/restrictPendingLogin.ts`) rejects login outright for
`pending` or `inactive` accounts — without it, "pending approval" would
only be a label, since Payload's local-auth login has no built-in concept
of our custom `status` field and would otherwise let a freshly
self-registered account straight in. Covered by
`tests/int/register.int.spec.ts`, including the full approval loop:
register → blocked login → admin sets `status: active` → login succeeds.

The logged link points at `/register?token=...`, a minimal client-side
form (`src/app/(frontend)/register/page.tsx`) that reads the token from
the URL and posts to the endpoint above — functional, not styled; the
polished public site is still future work (see below).

Not modeled: single-use tokens (an invite can register multiple accounts
until it expires or is revoked, matching "anyone with it can create an
account"); rate-limiting the endpoint. The invite link itself is still
console-only (see below) — emailing it to a specific address isn't wired
up, since an Invite isn't tied to any one recipient.

## Email & session reminders (§6.3)

`src/email/adapter.ts` configures Payload's `email` config via
`@payloadcms/email-nodemailer`. With `SMTP_HOST` set, it sends through
real SMTP (`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`,
`EMAIL_FROM`). With no `SMTP_HOST` (the default), it uses nodemailer's
`jsonTransport` — mail is composed and "sent" without touching the
network, safe for dev/tests. This deliberately does *not* use
nodemailer's built-in ethereal.email test-account fallback: that makes a
live network call on every `getPayload()` init, and a blocked or failed
one would break the whole app (including CI).

`src/jobs/sendSessionReminder.ts` is a Payload job-queue task; the
`scheduleSessionReminder` / `resetReminderStatusOnReschedule` hooks
(`src/hooks/sessionReminders.ts`, on `TrainingSessions`) queue it:

- On create, for 2 hours before `scheduledDate` (§6.3) — or immediately
  if that time has already passed.
- On reschedule, a fresh job for the *new* time. Rather than tracking and
  cancelling the old job, the task itself detects it's been superseded
  (its captured `scheduledDateAtQueueTime` no longer matches the
  session's current one) and no-ops — see the comment in that file.
- Also on reschedule, if interns were already notified under the old
  time: an immediate "rescheduled" notice (§6.3's "should trigger an
  automatic re-notification"), queued for prompt pickup rather than sent
  inline from the hook, same as every other reminder.

Jobs are queued, not sent synchronously, so a slow mail provider never
blocks the request that created/rescheduled a session, and retries are
Payload's job-queue retry rather than hand-rolled. `jobs.autoRun` (every
minute) actually processes the queue — disabled under Vitest so its
interval doesn't keep test processes alive, and per Payload's own
guidance not meant for serverless platforms, which lines up with §7's
"hosting is a persistent server process" decision. Verified against the
real dev server (not just tests): a session's reminder job was queued,
`autoRun`'s cron picked it up autonomously about a minute later, and
`reminderStatus` flipped to `sent` with no manual trigger. Covered by
`tests/int/reminders.int.spec.ts`.

## Excel exports (§6.11)

`GET /api/export/:collection` — admin-only (§4 "Bulk export"), returns a
real `.xlsx` download built with `exceljs`. `src/exports/registry.ts`
defines the exportable collections (`users`, `enrollments`, `contracts`,
`training-sessions`, `scores`, `evaluations`, `logbook-entries`,
`documents`, `alumni-profiles`) with a hand-written, human-readable
column list per collection — relationships resolve to a display name
(via depth: 1 population) rather than a raw ID, since that's what makes
a spreadsheet actually useful to open. It's not a generic "dump every
field of every collection" exporter on purpose: that would surface raw
IDs/JSON for relationships and nested groups, and silently reshape the
spreadsheet whenever a field is added.

`?cohort=<id>` narrows collections that carry a `cohort` field (e.g.
exporting one cohort's roster before closing it, §6.1) — visit
`/api/export/enrollments?cohort=<id>` while logged into `/admin` in the
same browser (session cookie carries over). §6.11 confirmed Excel as the
only v1 export destination — no Google Drive/OAuth integration.

Verified against the real dev server, not just the test suite: logged in
through the actual admin UI, downloaded a real `.xlsx` via the browser's
authenticated session, and opened it back up to confirm the data
round-trips correctly; confirmed a non-admin session gets 403. Covered by
`tests/int/exports.int.spec.ts`.

## Public Talent Board (§6.9)

`/talent-board` (list) and `/talent-board/[id]` (detail) are plain
server-rendered pages — no client-side data fetching, so there's nothing
for a public visitor to bypass. Both fetch through the local API with
`overrideAccess: false, user: null`, i.e. exactly the access rules an
anonymous API request would get (`AlumniProfiles.readAccess`), not a
separately-maintained "public" query that could drift out of sync.

Public fields shown: profile photo, name, courses, work experience, and
the narrative bio (§6.9); email/phone appear only when the alum included
them. View-only — no messaging UI. Instead there's a static "contact us"
mailto link (`ADMIN_CONTACT_EMAIL`) on both pages, matching "Employers…
contact admin directly… admin acts as the intermediary."

Building this surfaced a real gap in the access control from the earlier
pass: `AlumniProfiles.readAccess` checked `optedIn` but never the linked
intern's `Enrollment.outcome`, even though §6.1 explicitly says Talent
Board eligibility should be limited to actual graduates ("Resigned
(non-completing) alumni are flagged internally as distinct from graduated
alumni, so Talent Board eligibility can be limited to actual graduates").
Fixed now via `getGraduatedInternIds` (`src/access/scoping.ts`) — a
resigned-but-opted-in alum can still read/edit their own profile (Alumni
Hub access, §6.10 — unaffected), but is excluded from what anyone else,
public included, can see; confirmed as a direct 404 even by guessing
their profile URL, not just hidden from the listing. Also added
`AlumniProfile.name` (a §6.9 public field the schema was missing) since
the intern's own `Users.name` isn't publicly readable and the two aren't
meant to be the same lookup.

Verified against the real dev server: an opted-in graduate appears on the
listing and detail page as an anonymous visitor; an opted-in *resigned*
alum is absent from the listing and 404s on direct link; the graduate's
photo, bio, courses, and work experience all render correctly. Covered by
`tests/int/talentBoard.int.spec.ts`.

## Status

Every feature in the proposal's phased rollout (§8) is now built: the
full data model (§5), access control (§4), contract lifecycle &
cohort-closing guards (§6.1, §6.4), invite-link registration (§6.2),
session reminders (§6.3), Excel exports (§6.11), and the public Talent
Board (§6.9). What's left is narrower refinement, not missing features —
see the "known gaps" callouts under Access Control above (the
per-cohort media-access exception, `Files`/`Announcements` read scoping)
and the "Not modeled" note under Invite-link registration (single-use
tokens, rate-limiting).

## Testing

```bash
npm run test:int   # Vitest, runs against SQLite
npm run test:e2e   # Playwright
```

## Type generation

After changing a collection, regenerate types:

```bash
npm run generate:types
```
