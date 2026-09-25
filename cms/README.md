# She Delivers Management System — CMS

Payload CMS backend for the She Delivers cohort management system. See
[`../she-delivers-proposal_2.md`](../she-delivers-proposal_2.md) for the
full requirements this scaffold implements — a revision of the original
[`../she-delivers-proposal.md`](../she-delivers-proposal.md); where this
README says "the proposal" it means the current, revised one.

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
| `users` | §4 roles: admin / trainer / intern / supervisor — auth/role anchor for every role |
| `trainers`, `interns` | §5, §6.2 — richer profile data collected at self-registration, additive 1:1 extensions of `users` (see Access control below) |
| `education` | §5, §6.2 — an intern's repeatable qualification history, linked to `interns` |
| `cohorts` | §6.1 |
| `enrollments` | §6.1 |
| `invites` | §6.2 — dual-role (intern/trainer), email-personalized, single-use |
| `contracts` | §6.4 |
| `modules`, `sessions` | §6.3, §6.4 (`sessions` renamed from `training-sessions` — §5's naming notes) |
| `notes` | §6.4 (renamed from `module-notes`) |
| `scores` | §6.5 |
| `logbooks` | §6.6 (renamed from `logbook-entries`; no more separate supervisor-authored rollup entries — see below) |
| `evaluations` | §6.5 |
| `workplans` | §5 |
| `documents` | §6.7 — holds the proof file only; the ID/KRA PIN/SHIF/NSSF numbers themselves live on `trainers`/`interns` |
| `images`, `files`, `media` | uploads (generic images / documents / consent-tracked cohort media, §6.4, gated per `Cohorts.mediaAccessGrantedTo`) — `images` renamed from `media`, `media` renamed from `media-assets` (see Access control below) |
| `alumnae` | §6.9, §6.10 (renamed from `alumni-profiles`) |
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

`Files` and `Announcements` read access started as "any authenticated
user" — a known gap, since fixed (see below), as was the §4 "media
library access… unless granted per cohort" trainer exception (also
below). No further documented gaps remain.

### Trainer / Intern / Education profiles (§5, §6.2, §7)

Proposal v2 splits the richer registration-time profile data (personal,
contact, statutory numbers, next of kin, education history) out of
`Users` into two new collections, `Trainer` (`src/collections/Trainer.ts`)
and `Intern` (`src/collections/Intern.ts`), each a `user` relationship
back to a `users` row (unique — one profile per account) rather than a
replacement for it. Every existing collection that references "trainer"
or "intern" (Contracts, Sessions, Documents, Scores, ...) keeps relating
to `users` directly, exactly as before — `Trainer`/`Intern` are additive,
not a foundational schema change to how the rest of the app models
people. `Education` (`src/collections/Education.ts`) is a third,
separate collection for an intern's repeatable qualification history,
relating to `Intern` (not `users`) since it's specifically part of that
richer profile.

Access: admin sees/edits every row; everyone else only their own (via
`user` on Trainer/Intern, or the owning `Intern` row on Education) — §4's
"Register/manage own profile". Building this surfaced a real Payload
quirk: `create` access functions that return a `Where` constraint (the
`adminOrRoleOwnsField` helper, used throughout this codebase, e.g. on
`ModuleNotes`/`Note`) are **not** actually validated against the
submitted data for `create` operations — Payload only checks the result
is truthy (confirmed by reading
`node_modules/payload/dist/collections/operations/create.js`:
`executeAccess`'s resolved constraint is awaited and discarded for
`create`, unlike `read`/`update`/`delete` where it's merged into the
query). A test asserting an intern couldn't create an Education row
under someone else's profile caught this: the naive
`adminOrRoleOwnsField`-style `create` access would have let them. Fixed
with a new `adminOrRoleOwnsFieldOnCreate` (`src/access/roles.ts`, with
the mechanism documented in its own comment) that explicitly checks
`data.<field>` against the caller's id, used for `Trainer`/`Intern`'s own
`create` access and inlined the same way for `Education`'s. (The
pre-existing collections using the unsafe pattern for `create` —
`Note`, `Documents`, `Workplans`, `Alumna` — predate this revision and
are unaffected by it in practice today, since every real write path to
them either goes through `overrideAccess` or a UI where a user has no
reason to submit someone else's id; flagged as a follow-up rather than
fixed here, to keep this change to what the proposal revision asked
for.)

§7 "sensitive personal data" (`dateOfBirth`, `nationalIdNumber`,
`kraPin`, `shifNumber`, `nssfNumber`): row-level access above already
limits reads to admin or the person themself, so there's no other reader
inside the app to restrict further. The actual requirement — "not
exposed in bulk exports or on the public talent board" — is satisfied by
construction: the `trainers`/`interns` export definitions
(`src/exports/registry.ts`) simply never list those columns, and the
public `Alumna` never references `Trainer`/`Intern` at all (see Excel
exports and Public Talent Board below). Covered by
`tests/int/profiles.int.spec.ts`.

### Files & Announcements read scoping

`Files` (`src/collections/Files.ts`) is shared plumbing under Contracts,
Documents, and Notes — each already scopes who may reference a
given row (e.g. only a document's own intern), but the *file itself* was
readable by any authenticated user. `getAccessibleFileIds`
(`src/access/scoping.ts`) now resolves the actual set of File ids a user
is entitled to by walking those same relationships (plus their own
uploads) — e.g. a trainer can read the file attached to *their own*
contract even though admin uploaded it, but not an unrelated intern's
statutory documents.

`Announcements` read was similarly wide open; §4's "Alumni Hub
announcements" implies alumni-only reading, but "alumni" isn't a
`Users.role` — it's `Enrollment.outcome` being `graduated` or `resigned`
(§6.1: "both still share the same Alumni Hub access"). `getAlumniInternIds`
closes that: a still-in-progress intern, trainer, or supervisor gets 403;
a graduated or resigned alum (or admin) reads normally.

Verified against the real dev server, not just tests: a trainer got a 200
reading their own contract's file and a 404 on an unrelated intern's
document file; a still-in-progress intern got 403 on an announcement a
graduated alum could read with 200. Covered by
`tests/int/filesAndAnnouncements.int.spec.ts`.

### Per-cohort media-access grant for trainers

§4's Media library row grants Admin full access and Trainer none —
"unless granted per cohort". `Media` (`src/collections/Media.ts`,
renamed from `MediaAssets` — see the naming note below) previously had no
way to model that grant, so it was admin-only outright.
`Cohorts.mediaAccessGrantedTo` (a `hasMany` relationship to `users`,
filtered to `role: trainer`) is now that per-cohort allowlist — admin
picks which trainers, if any, can see a given cohort's media library;
`getMediaGrantedCohortIds` (`src/access/scoping.ts`) resolves which
cohorts a given trainer has been granted into.

This also gives `Media.visibilityScope` real access-control meaning
for the first time: a granted trainer can only read `cohort-extended`
assets in a cohort they're listed on — `admin-only` assets in that same
cohort stay admin-exclusive. An ungranted trainer, and every other role,
gets nothing. `create`/`update`/`delete` remain admin-only — the matrix
only grants trainers viewing, not management.

Verified against the real dev server: a granted trainer got 200 reading a
`cohort-extended` asset in their granted cohort and 404 on an `admin-only`
asset in that same cohort; an ungranted trainer got 403 on the same
`cohort-extended` asset; the granted trainer's list endpoint returned only
the one asset they're entitled to (admin's list returned both); a PATCH by
the granted trainer was rejected with 403. Covered by
`tests/int/media.int.spec.ts`.

**Naming note (proposal v2, §5):** the entity this proposal calls
`Media` — the cohort media library above — collided with what used to be
this app's slug for generic image uploads (Talent Board photos, rich
text embeds). Rather than rename the proposal's own entity, the old
generic-uploads collection moved to `Images` (`src/collections/Images.ts`,
slug `images`) to free up the name, since it's implementation-only
plumbing with no §5 entity of its own. `Alumna.photo` (see Public Talent
Board below) now relates to `images`.

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

## Logbooks (§6.6)

Proposal v2 drops the v1 supervisor-authored "Mentor Driver" rollup
entries entirely: "the sample driver logbook's second sheet... is
dropped: not needed... Each intern keeps a single logbook, self-authored,
with the Supervisor reviewing and commenting (§4) — no separate rollup
log." `Logbook` (`src/collections/Logbook.ts`, renamed from
`LogbookEntry`) reflects that: no `author` field, no `supervisorRollup`
group, and `create` access no longer grants supervisors anything (they
review/comment on the intern's own entries via the existing
`supervisorComment` field, itself already locked to
admin/supervisor-only write). An intern still creates and owns their
entries; admin and the intern's assigned supervisor still read them —
unchanged from v1.

## Invite-link registration (§6.2)

Proposal v2 changed this significantly from v1: **both interns and
trainers now self-register**, via an invite personalized to one email
address, rather than interns-only via a shareable per-cohort/track link.

Admin creates an `Invites` record: `cohort`, `role` (intern/trainer),
`email`, and `track` (intern invites only — `admin.condition` hides it
for trainer invites, and a field `validate` requires it when
`role: intern`). A `beforeChange` hook auto-generates the `token` and
sets `expiresAt` 24h out (§6.2); an `afterChange` hook logs the resulting
link — **email integration isn't implemented yet, so this is
console-only** for now (`[invite] cohort=... role=... email=... track=...
link=http://.../register?token=...`, via `payload.logger.info`, wired to
`PAYLOAD_PUBLIC_SERVER_URL` if set).

`status` (`sent` / `used` / `expired` / `revoked`) replaces v1's plain
`revoked` checkbox — this is what makes the invite genuinely single-use
now (see "Not modeled" below for why v1 was deliberately left multi-use
and why that reasoning no longer applies).

### `/api/register` (`src/endpoints/register.ts`)

Two routes at the same path, both public and unauthenticated:

- **`GET /api/register?token=...`** — looks up the invite and returns
  `{ role, email, cohortName, track }`, so the registration form
  (`src/app/(frontend)/register/page.tsx`) knows which field set to show
  and can display the target email *before* the person types anything.
  Never returns anything beyond that — no profile data exists yet at
  this point.
- **`POST /api/register`** — given `{ token, password, ...profile }`,
  validates the invite (exists, not used/revoked/expired — lazily
  flipping a stale `sent` invite to `expired` the same "plain validation
  logic, no workflow engine" way the contract-lifecycle and
  cohort-closing guards work, §6.1/§6.4/§10), then creates the User and
  the role-appropriate records on the registrant's behalf via
  `overrideAccess` (all otherwise admin-only):
  - **intern** → an `Intern` profile row (name, DOB, gender, nationality,
    contact, statutory numbers, next of kin) + zero or more `Education`
    rows + an `Enrollment` in the invite's cohort/track, same as v1.
  - **trainer** → a `Trainer` profile row (name, occupation, contact,
    statutory numbers) + a **Draft** `Contract` for the invite's cohort —
    the concrete form "trainers are associated with that cohort ahead of
    their contract" (§6.2/§6.4) takes: a Draft contract is the natural
    next step for admin (upload terms, move to Sent), and `Contract`
    already models trainer+cohort.

  `role` and the account **`email` always come from the invite record,
  never the request body** — a registrant cannot self-assign a role,
  register under a different email than the one admin invited, or skip
  the pending-approval step by sending extra fields. Required
  fields differ by role (see `internBody`/`trainerBody` in
  `tests/int/register.int.spec.ts` for the exact field lists); missing
  ones return `400` naming which fields. On success the invite's
  `status` flips to `used`, so the same token can never register a
  second account.

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

The logged link points at `/register?token=...` — a minimal client-side
form that fetches the `GET` lookup on mount, then renders the
role-appropriate field set (including a repeatable "add education" list
for interns) and posts to `POST` above — functional, not styled; the
polished public site is still future work.

`POST /api/register` (and the `GET` lookup, separately) is rate-limited
per source IP — `checkRateLimit` (`src/lib/rateLimit.ts`), a small
in-memory fixed-window limiter keyed by `X-Forwarded-For` (falling back
to `X-Real-IP`, then a shared `unknown` bucket for direct/local requests
with neither header) — capped at 5 requests per 15 minutes; over the
limit returns `429` with a `Retry-After` header. It's in-process state,
so it resets on redeploy and doesn't share state across multiple app
instances — fine for this app's current single-instance deployment, but
would need a shared store (e.g. Redis) behind a load balancer. Covered
by the "rate limiting" describe block in `tests/int/register.int.spec.ts`,
and verified against the real dev server: 5 requests with a bogus token
returned `404` (normal invalid-token handling) as expected, the 6th
returned `429` with `Retry-After: 900`, and a request from a different IP
was unaffected.

**Single-use tokens are now modeled** (they weren't in v1): proposal v2's
own wording changed from "anyone with it can create an account" (one
shared link per cohort/track) to "only that email address can complete
registration with it" (one invite per person) — so the v1 README note
explaining why single-use was deliberately *not* built no longer applies;
it's built now, via `status: used` above.

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
(`src/hooks/sessionReminders.ts`, on `Session`) queue it:

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
defines the exportable collections (`users`, `trainers`, `interns`,
`enrollments`, `contracts`, `sessions`, `scores`, `evaluations`,
`logbooks`, `documents`, `alumnae`) with a hand-written, human-readable
column list per collection — relationships resolve to a display name
(via depth: 1 population) rather than a raw ID, since that's what makes
a spreadsheet actually useful to open. It's not a generic "dump every
field of every collection" exporter on purpose: that would surface raw
IDs/JSON for relationships and nested groups, and silently reshape the
spreadsheet whenever a field is added.

This hand-written-column approach is also what satisfies §7's new "not
exposed in bulk exports" requirement (proposal v2) for `Trainer`/`Intern`'s
sensitive fields (`dateOfBirth`, `nationalIdNumber`, `kraPin`,
`shifNumber`, `nssfNumber`) — the `trainers`/`interns` definitions simply
never list those columns. Verified with a real `.xlsx`, not just by
re-reading the column list: `tests/int/exports.int.spec.ts` seeds a
trainer/intern with recognizable sentinel values in every sensitive
field, exports both collections, and asserts none of those values appear
anywhere in the resulting file bytes.

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
anonymous API request would get (`Alumna.readAccess`,
`src/collections/Alumna.ts` — renamed from `AlumniProfile` per §5's
naming notes), not a separately-maintained "public" query that could
drift out of sync. `Alumna.intern` relates to `users`, not the newer
`Intern` profile collection (§5) — this is about which login account a
listing belongs to, not the intern's statutory/registration data, and
keeping it on `users` means the public Talent Board never has a path to
the sensitive `Intern` fields (§7) even through a populated relationship.

Public fields shown: profile photo, name, courses, work experience, and
the narrative bio (§6.9); email/phone appear only when the alum included
them. View-only — no messaging UI. Instead there's a static "contact us"
mailto link (`ADMIN_CONTACT_EMAIL`) on both pages, matching "Employers…
contact admin directly… admin acts as the intermediary."

Building this surfaced a real gap in the access control from the earlier
pass: `Alumna.readAccess` checked `optedIn` but never the linked
intern's `Enrollment.outcome`, even though §6.1 explicitly says Talent
Board eligibility should be limited to actual graduates ("Resigned
(non-completing) alumni are flagged internally as distinct from graduated
alumni, so Talent Board eligibility can be limited to actual graduates").
Fixed now via `getGraduatedInternIds` (`src/access/scoping.ts`) — a
resigned-but-opted-in alum can still read/edit their own profile (Alumni
Hub access, §6.10 — unaffected), but is excluded from what anyone else,
public included, can see; confirmed as a direct 404 even by guessing
their profile URL, not just hidden from the listing. Also added
`Alumna.name` (a §6.9 public field the schema was missing) since
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
Board (§6.9), the per-cohort media-access grant for trainers under
Access Control above, and rate-limiting on `POST /api/register` under
Invite-link registration.

Also built: the full proposal v2 revision — `Trainer`/`Intern`/`Education`
profile collections and §7's sensitive-field export exclusion (Access
control above), dual-role email-personalized single-use invites and the
Draft-contract trainer association (Invite-link registration above), the
`Session`/`Note`/`Logbook`/`Media`/`Alumna` renames and the
`Media`/`Images` naming-collision resolution (§5's naming notes,
throughout), and the dropped supervisor logbook rollup (Logbooks above).

What's left is narrower refinement, not missing features — the
"Not modeled" note under Invite-link registration (rate-limiting's
current in-memory, single-instance-only state).

## Testing

```bash
npm run test:int   # Vitest, runs against SQLite
npm run test:e2e   # Playwright
npm run lint       # ESLint
```

`npm run lint` used to crash outright ("TypeError: Converting circular
structure to JSON") rather than report findings. `eslint.config.mjs` was
using `FlatCompat.extends('next/core-web-vitals', 'next/typescript')` —
the older pattern for eslintrc-style shareable configs — but
`eslint-config-next` (as of Next.js 16, which also removed `next lint`)
now ships native flat configs directly. Running an already-flat config
through `FlatCompat`'s legacy validator tripped a schema-validation error
it then couldn't even report, because formatting that error meant
`JSON.stringify`-ing `eslint-plugin-react`'s flat preset, which contains
a deliberate self-reference (`configs.flat.recommended.plugins.react`
pointing back to the plugin itself). Fixed by importing
`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
directly, per Next's current docs
(`node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`).
Also fixed the one real error it then surfaced — an internal
`/talent-board` link using a plain `<a>` instead of `next/link`'s
`<Link>` (`@next/next/no-html-link-for-pages`) — verified against the
real dev server that the link still renders and navigates correctly.
`npm run lint` now exits 0 (a handful of pre-existing unused-var warnings
remain in scaffold/example files, which don't fail the command).

## Type generation

After changing a collection, regenerate types:

```bash
npm run generate:types
```
