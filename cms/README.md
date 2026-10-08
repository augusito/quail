# She Delivers Management System — CMS

[Payload CMS](https://payloadcms.com) 3.x (Next.js) backend for the She Delivers
cohort management system. [`../she-delivers-proposal.md`](../she-delivers-proposal.md)
is the full spec this app implements; the root [`CLAUDE.md`](../CLAUDE.md) holds
commands and domain rules for anyone (human or Claude) working on this repo.

## Quick start

```bash
cp .env.example .env   # set PAYLOAD_SECRET
npm install
npm run dev
```

Open `http://localhost:3000/admin` and follow the prompts to create your first
admin user. `.env` defaults to SQLite, so no external database is needed to get
started.

After pulling changes that touch dependencies, run `rm -rf .next && npm install`
— a stale Turbopack cache has caused silent failures before.

## Environment variables

See `.env.example` for the full annotated list. The ones worth knowing about:

| Variable | Purpose |
| --- | --- |
| `PAYLOAD_DATABASE` | `sqlite` (default, local dev/tests) or `postgres` (production) |
| `DATABASE_URL` | SQLite file path or Postgres connection string, matching the adapter above |
| `PAYLOAD_SECRET` | required; Payload's signing secret |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | session-reminder email delivery; leave `SMTP_HOST` unset locally and mail is composed via nodemailer's `jsonTransport` instead of sent |
| `PAYLOAD_PUBLIC_SERVER_URL` | base URL used when logging invite links; defaults to `http://localhost:3000` |
| `ADMIN_CONTACT_EMAIL` | contact address shown on the public Talent Board |

To switch to Postgres, set `PAYLOAD_DATABASE=postgres` and `DATABASE_URL` in
`.env`; `docker-compose.yml` can spin up a local Postgres instance for this.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run devsafe` | dev server, clearing `.next` first |
| `npm run build` / `npm run start` | production build / serve |
| `npm run lint` | ESLint |
| `npm run test:int` | Vitest integration tests against SQLite |
| `npm run test:e2e` | Playwright e2e tests |
| `npm run generate:types` | regenerate Payload's generated TypeScript types after changing a collection schema |
| `npm run generate:importmap` | regenerate Payload's admin import map |

Node 22 (engines allow `^18.20.2 || >=20.9.0`, but develop against 22).

## Tests

Vitest does **not** auto-load `test.env`, so source it first or every spec
fails on "missing secret key":

```bash
set -a && source test.env && set +a && npm run test:int
```

`npm run test:e2e` needs a locally resolvable Chromium binary — some cloud
sandboxes don't have one on the expected path, so e2e can fail there with a
browser-launch error even though the suite itself is fine (CI runs it
successfully via `npx playwright install --with-deps chromium`).

Add a test for each domain rule you implement or change — see the root
`CLAUDE.md`'s testing conventions.

## Deployment and go-live caveats

There is no production deployment yet. Worth knowing before changing that:

- **No migration tooling.** Payload runs in push mode; a schema or
  field-key rename doesn't need a data migration, just an update to the
  collection config (and `npm run generate:types`).
- **Invite emails are logged, not sent.** `Invites.ts`'s `afterChange` hook
  logs the registration link instead of emailing it — an admin currently has
  to copy the link out of the server log and send it manually.
  `src/email/adapter.ts` already wires up nodemailer for session reminders,
  so sending invite emails the same way is a small follow-up.
- **No custom Payload admin dashboard.** Admin users work entirely in
  Payload's stock generated UI.
- **`/api/register` rate-limiting is in-memory and single-instance only** —
  it won't hold a limit across multiple server instances behind a load
  balancer.
- **The `Dockerfile` is unexercised in any real deployment.** It builds
  (`next.config.ts` sets `output: 'standalone'`), but nobody has run the
  resulting image against a real Postgres instance.

## Project layout

- `src/collections/` — Payload collection configs (the data model)
- `src/access/` — `roles.ts` (role helpers) and `scoping.ts` (row-level query
  scoping, e.g. "a supervisor may only see their assigned interns")
- `src/hooks/` — workflow guards (contract lifecycle, cohort-closing
  checklist, session reminder scheduling, pending-login restriction)
- `src/endpoints/` — custom REST endpoints (`/api/register`,
  `/api/export/:collection`)
- `src/exports/` — Excel export column definitions and workbook building
- `src/email/`, `src/jobs/` — email adapter and the session-reminder job
- `src/app/(frontend)/` — public-facing pages (homepage, register wizard,
  Talent Board)
- `tests/` — Vitest integration specs (`tests/int/`) and Playwright e2e specs

## Conventions

- Code comments are concise and explain *why*, not *what* — no references to
  the proposal document (no section citations) in code, help text, or test
  names; state the rule in plain words instead.
- Give new fields an explicit `label` — Payload auto-titles bare camelCase
  field names in the admin UI.
- "Rename X label" means label only, not the underlying field key, unless
  explicitly asked to rename the field itself.
- Trainer/supervisor `create` access must check both self-ownership and that
  every referenced intern/session/module is actually theirs, not just the
  self-attributed ownership field.

See the root [`CLAUDE.md`](../CLAUDE.md) for the full domain rules (contract
lifecycle, cohort/track scoping for interns and trainers, etc.) and
[`../she-delivers-proposal.md`](../she-delivers-proposal.md) for the spec this
app implements.
