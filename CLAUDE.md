# quail — She Delivers Management System

A Payload CMS app (in `cms/`) for She Delivers, a 6-month internship program training
women in truck driving, automotive mechanics, ICT, supply chain, and business
management. It digitizes cohort management, trainer contracting, training delivery,
compliance documentation, and a post-graduation talent board. See
`she-delivers-proposal.md` at the repo root for the full spec — it's kept in sync with
`cms/` behavior, so update it alongside any PR that changes behavior it describes.

All application code lives under `cms/`; the repo root otherwise holds reference
documents (the proposal, sample agreements, logbook templates) that are source
material, not app code.

## Setup (fresh checkout)

```
cd cms
cp .env.example .env   # set PAYLOAD_SECRET; sqlite is the default local adapter
npm install
```

After pulling changes that touch dependencies, run `rm -rf .next && npm install` —
a stale Turbopack cache has caused silent failures before.

## Commands (run from `cms/`)

- `npm run lint` — ESLint
- `npm run test:int` — Vitest integration tests against SQLite. Vitest does **not**
  auto-load `test.env`, so source it first or every spec fails on "missing secret
  key":
  ```
  set -a && source test.env && set +a && npm run test:int
  ```
- `npm run test:e2e` — Playwright e2e tests
- `npm run generate:types` — regenerate Payload's generated TypeScript types after
  changing a collection schema
- Node 22 (engines allow `^18.20.2 || >=20.9.0`, but develop against 22)

There is no production deployment yet, and no migration tooling is set up (Payload
runs in push mode). A schema or field-key rename does not need a data migration —
just update the collection config and regenerate types.

## Domain rules

These are the conventions that have been clarified over several PRs — follow them
rather than re-deriving behavior from the schema alone.

- **Trainer invites and registration do not require a cohort.** A trainer can be
  invited and self-register before any cohort is lined up.
- **Contracts are always per-cohort and admin-created**, never auto-created at
  trainer registration. A trainer gets exactly one `Contract` per cohort they work
  in; `Contracts.trainer` and `Contracts.cohort` are admin-only to write, even on a
  contract a trainer otherwise owns.
- **Contract lifecycle:** `Draft → Sent → Signed → Active → Released` (single
  status field, single term "Released" — never "Discharged" anywhere in code,
  labels, or docs).
  - Draft→Sent, Signed→Active, and Active→Released are admin-only.
  - Sent→Signed may be done by admin or the trainer themself, but is rejected
    unless a signed `file` is already attached (uploaded in the same request or
    already on the contract).
  - A trainer may set `releaseRequested` only while the contract is Active; the
    flag alone never moves the status — only admin makes the Active→Released
    transition.
  - No skipping a step and no moving backward, for anyone.
  - A trainer's own-contract write access is scoped to `file`, `mediaConsent`,
    `releaseRequested`, and the Sent→Signed transition — nothing else.
- **Interns are tied to a cohort and a track**, including at invite time (unlike
  trainers).
- **"Rename X label" means label only** — keep the underlying field key as-is,
  unless explicitly asked to rename the field itself. Don't substitute your own
  preferred wording once Augusito has picked one (e.g. "Occupation" was kept as-is;
  "Postal Address" was chosen over "Physical Address").
- `she-delivers-proposal.md` is the single source proposal — update it in the same
  PR whenever implemented behavior changes, rather than letting it drift.
- New `(frontend)` pages use the shared `PageShell` layout and the `brand-*` /
  `accent-*` Tailwind tokens for She Delivers branding, not ad-hoc colors.

## Testing conventions

- Add a test for each domain rule you implement or change (e.g. "a trainer can't
  mark a contract Signed without a file attached") — these are exactly the rules
  most likely to regress silently.
- After a field-key rename followed by `test:int`, delete stale `cms/*.db*` files
  first, or drizzle-kit can hang on an interactive prompt.
- Payload auto-titles bare camelCase fields in the admin UI — give new fields an
  explicit `label`.
- A conditional admin field's `admin.condition` must be symmetric with sibling
  conditional fields, or an unset value can break it in an unexpected way.
