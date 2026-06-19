# Leads CRM — Phase 1

Hosted CRM that replaces the local HTML file. New Facebook leads arrive
automatically (interim via Zapier), edits save instantly to Postgres, and it's
usable from any device. Owns the pipeline: **Contacts, Kanban, Funnel,
Duplicates, Tasks/Follow-ups**, with an activity timeline and the manual
"Emailed on" log. Built per the Leads CRM Build Document.

**Stack:** Next.js (App Router) · Prisma · Railway Postgres · Auth0.

## What's in Phase 1

| Area | Status |
|---|---|
| Prisma schema + migration (`User`, `Lead`, `Activity`, `StageHistory`, `Task`) | ✅ |
| Seed of the 695 existing leads (`data/leads.json`, upsert by id) | ✅ |
| Contacts — searchable table, inline status/priority/date edits | ✅ |
| Kanban — drag to change stage, deal value on cards + column totals | ✅ |
| Funnel — KPIs + per-campaign breakdown (faithful port of the HTML logic) | ✅ |
| Duplicates — shared email/phone groups with merge | ✅ |
| Tasks/Follow-ups — overdue / due-today / upcoming queues | ✅ |
| Lead detail — full record, timeline, notes, "Emailed on" quick-log | ✅ |
| Auth0 login gate (middleware) | ✅ |
| Interim Zapier inbound endpoint + new-lead automation (auto follow-up task) | ✅ |

### Phases 2–4 (also built)

| Area | Status |
|---|---|
| **Phase 2** — Meta `leadgen` webhook: signature verify, Graph fetch, dedupe upsert, auto task | ✅ |
| **Phase 3** — MailerLite two-way sync: idempotent subscriber upsert, status→`crm_status`, status push on stage change, inbound unsubscribe webhook | ✅ |
| **Phase 4** — Stripe webhook → CUSTOMER + deal value + PAYMENT activity; CPL/CAC/ROAS analytics with per-campaign ad spend | ✅ |
| **Phase 5** — Outlook / Microsoft Graph: send email from a lead record + calendar invites, logged to the timeline (supersedes manual "Emailed on") | ✅ groundwork |

Live integrations stay behind the interim Zapier feed until Meta App Review
approves the webhook, and every integration no-ops (or hides its UI) until its
keys are set. Outlook needs an Azure app (Mail.Send, Calendars.ReadWrite) — the
send-email box only appears on a lead once `MS_*` env vars are configured.

CI (`.github/workflows/ci.yml`) runs the full gate suite — migrate, seed (asserts
695), typecheck, lint, test, build — against a Postgres service on every push.

## Local setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL; set AUTH_DISABLED=true for local dev
npx prisma migrate dev        # creates the tables
npm run seed                  # loads data/leads.json (695 leads)
npm run dev                   # http://localhost:3000
```

`AUTH_DISABLED=true` bypasses the Auth0 gate for local development only — never
set it in production.

## Checks (Definition of Done)

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm test             # vitest: seed count, funnel values, duplicates, stage-change, auth gate
npm run build        # prisma generate + next build
```

The funnel test pins the known values from the seeded data: total **695**,
quality **690**, reached **21**, meetings **12**, resolved **3**, showed **1**,
customers **1**. Duplicate detection finds **42** shared-email and **35**
shared-phone groups.

## Deploy (Railway)

1. Create a Railway project → add a **Postgres** plugin.
2. Add this repo as a service. `railway.json` runs `prisma migrate deploy`
   before `npm start`.
3. Set env vars (see `.env.example`): `DATABASE_URL`, the `AUTH0_*` block,
   `ZAPIER_INBOUND_SECRET`. Leave `AUTH_DISABLED` unset (defaults off).
4. Auth0: Regular Web App → Allowed Callback `https://<domain>/api/auth/callback`,
   Logout `https://<domain>`.
5. After first deploy, seed once: `railway run npm run seed` (or run the seed
   against the Railway `DATABASE_URL`).

## Interim Zapier feed

`POST /api/inbound/zapier` with header `x-webhook-secret: <ZAPIER_INBOUND_SECRET>`
and a lead (or array of leads) in the export shape. Upserts by `id` (no
duplicates on re-send) and, for a brand-new lead, auto-creates a follow-up Task.

## Project map

```
prisma/schema.prisma     # data model (Phase 1 canonical schema)
prisma/seed.ts           # upserts data/leads.json by id
src/lib/                 # status maps, normalize, funnel, duplicates, leadOps, auth gate
src/app/                 # App Router pages + server actions + API routes
src/app/actions.ts       # server actions (stage change, edits, notes, tasks, merge)
tests/                   # vitest: pure logic against the real 695-lead dataset
```
