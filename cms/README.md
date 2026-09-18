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
the existing Users collection (already admin-only, no extra guard needed).
Covered by `tests/int/register.int.spec.ts`.

Not modeled: single-use tokens (an invite can register multiple accounts
until it expires or is revoked, matching "anyone with it can create an
account"); rate-limiting the endpoint.

## Not yet implemented

This is a data-model scaffold. Still to build, per the proposal:

- Email reminders job queue (§6.3) — also needed to actually email the
  invite link above once an email adapter is wired up
- Public Talent Board frontend (§6.9) — the API-level access rules
  (opted-in-only for public) are in place
- Excel export endpoints (§6.11)

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
