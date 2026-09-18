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

## Not yet implemented

This is a data-model scaffold. Still to build, per the proposal:

- Per-role, per-record access control (§4 permissions matrix)
- Contract lifecycle & cohort-closing validation guards (§6.1, §6.4)
- Email reminders job queue (§6.3)
- Invite-link registration flow (§6.2)
- Public Talent Board frontend (§6.9)
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
