# Local session handoff

Pick up the Leads CRM from your own computer. Paste the prompt at the bottom
into a local Claude Code session, or follow the steps yourself.

## Where things stand (as of 2026-10-06)

- **Live:** https://leads-production-9c52.up.railway.app
  (Railway project `alluring-blessing` → service `Leads` → `production`).
  Latest deploy succeeded from `main` @ `50f3499`. Postgres is attached.
- **Production variables set:** `AUTH0_BASE_URL`, `AUTH0_CLIENT_ID`,
  `AUTH0_ISSUER_BASE_URL`, `AUTH0_SECRET`, `AUTH_DISABLED`, `DATABASE_URL`,
  `META_GRAPH_VERSION`.
- **Open problem:** `AUTH0_CLIENT_SECRET` is **missing** and `AUTH_DISABLED` is
  **set**. If `AUTH_DISABLED` is `true`, the 695 leads are visible to anyone with
  the URL. Fixing this is the first job.
- **Seeding:** unknown whether the 695 leads were seeded in production.

## 1. Finish the production Auth0 fix (do this first)

1. Auth0 → Applications → your Leads app → **Settings**: copy **Client Secret**;
   confirm **Domain** matches `AUTH0_ISSUER_BASE_URL` (as `https://<domain>`) and
   **Client ID** matches `AUTH0_CLIENT_ID`.
2. Auth0 → same app → **Allowed Web Origins**: add
   `https://leads-production-9c52.up.railway.app`.
3. Railway → `Leads` → **Variables**: add `AUTH0_CLIENT_SECRET`, then **delete**
   `AUTH_DISABLED` (or set it to `false`). Railway redeploys on save.
4. Open the URL → **Log in** → you should land on `/contacts`.
5. If `/contacts` is empty, seed (step 3 below).

## 2. Run the CRM on your machine (optional, for testing)

Needs Node 22+ and Docker (or any local Postgres).

```bash
git clone https://github.com/bmurray0832/Leads.git && cd Leads   # or: git pull on main
npm install
docker run --name leads-pg -e POSTGRES_USER=leads -e POSTGRES_PASSWORD=leads \
  -e POSTGRES_DB=leads_crm -p 5432:5432 -d postgres:16
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL="postgresql://leads:leads@localhost:5432/leads_crm?schema=public"
AUTH0_SECRET="<openssl rand -hex 32>"
AUTH0_BASE_URL="http://localhost:3000"
AUTH0_ISSUER_BASE_URL="https://<your-tenant>.us.auth0.com"
AUTH0_CLIENT_ID="<from Auth0>"
AUTH0_CLIENT_SECRET="<from Auth0>"
# Leave AUTH_DISABLED out to test real login.
# Set AUTH_DISABLED="true" only to click around without Auth0.
```

Then:

```bash
npx prisma migrate dev
npm run seed      # expect: Seeded 695 leads
npm run dev       # http://localhost:3000
```

The Auth0 app already allows `http://localhost:3000/api/auth/callback`, so real
login works locally once `AUTH0_CLIENT_SECRET` is in `.env`.

## 3. Seed production from your machine

`railway run` injects the private `postgres.railway.internal` URL, which your
laptop can't reach. Use the public one instead:

1. Railway → **Postgres** service → **Variables** → copy `DATABASE_PUBLIC_URL`.
2. From the repo:

```bash
DATABASE_URL="<DATABASE_PUBLIC_URL>" npm run seed
```

The seed upserts by id, so re-running it never duplicates or overwrites edits.

## Prompt for a local Claude Code session

> I'm continuing work on my Leads CRM (repo `bmurray0832/Leads`, branch `main`
> only). Read `CLAUDE.md` and `docs/LOCAL_SESSION.md`. It's live at
> https://leads-production-9c52.up.railway.app on Railway (project
> `alluring-blessing`, service `Leads`). Production is missing
> `AUTH0_CLIENT_SECRET` and has `AUTH_DISABLED` set. Help me add the client
> secret, remove `AUTH_DISABLED`, confirm login works, and seed the 695 leads
> into production if they're not there. Then get my local dev environment
> running.
