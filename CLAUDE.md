# CLAUDE.md — Leads CRM

Guidance for AI agents (and humans) working in this repo.

## What this is

A hosted Leads CRM (Next.js App Router + Prisma + Railway Postgres + Auth0) that
replaces a local HTML file. Pipeline: Contacts, Kanban, Funnel, Duplicates,
Tasks, Lead detail. Integrations: Meta Lead Ads, MailerLite, Stripe, Outlook —
all built and gated behind env vars. Full spec lives in the build document; the
go-live checklist is `docs/SETUP.md`.

## Commands

```bash
npm run dev        # local dev server
npm run seed       # load data/leads.json (asserts 695)
npm test           # vitest (pure logic, no DB needed)
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm run build      # prisma generate + next build
npx prisma migrate dev --name <name>   # new migration (needs DATABASE_URL)
```

Local dev uses `.env` with `AUTH_DISABLED=true` and a local Postgres. Never set
`AUTH_DISABLED` in production.

## Architecture conventions

- **Pure logic in `src/lib/`, thin routes/actions on top.** Integration logic
  (`meta`, `mailerlite`, `stripe`, `outlook`) is split into pure request
  builders + an **injectable `fetch`/db**, so it is unit-tested offline. Follow
  this pattern for new integrations — see `src/lib/leadOps.ts` and
  `src/lib/ingest.ts` for the injectable-db approach.
- **Server actions** live in `src/app/actions.ts` (`"use server"`).
- **DB pages** are `export const dynamic = "force-dynamic"` so `next build`
  doesn't query the database.
- **Status vocabulary** is centralized in `src/lib/status.ts` (enum ↔ label).
  Don't hardcode statuses elsewhere.
- **Ingest dedupes by lead `id`.** `normalize` synthesizes a `legacy:` id for
  blank-id records. Meta webhook leads use an `l:` prefix to match the seed.
- **Best-effort vs. user-initiated:** MailerLite sync is best-effort (logs,
  never throws). Outlook send is user-initiated (surfaces errors).
- Integrations **no-op when their env vars are unset** — keep that property.

## Testing

Tests are in `tests/` and run without a database (they use the real
`data/leads.json` fixture and mock dbs). Known invariants pinned by tests:
total **695** leads; funnel quality 690 / reached 21 / meetings 12 / resolved 3
/ showed 1 / customers 1; **42** shared-email and **35** shared-phone duplicate
groups. Update these only with a deliberate data change.

## Definition of Done (every change)

`tsc` clean · `eslint` clean · `next build` succeeds · `npm test` green ·
migrations apply. CI (`.github/workflows/ci.yml`) enforces all of these.

## Git

Work on the active feature branch; commit at each green checkpoint. Do not push
to other branches without explicit permission. Don't commit secrets (`.env` is
gitignored; `data/leads.json` contains lead PII — see the PII decision in
`docs/SETUP.md`).
