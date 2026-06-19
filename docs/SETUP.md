# Leads CRM — Setup & Go-Live Checklist

Work top to bottom. **Stage 0 + 1 get you a live, usable CRM with automatic lead
capture.** Stage 2 (Meta verification) is slow — start it in parallel today.
Every integration no-ops until its keys are set, so partial setup is safe.

Legend: 👤 = you (account-level) · 🤖 = Claude can wire/verify once you provide creds.

---

## Stage 0 — Deploy the core app  ⏱ ~1 hr · gets you a hosted, login-gated CRM

- [ ] 👤 **Railway project**: create project → add **Postgres** plugin.
- [ ] 👤 Add this repo as a Railway service (deploys from `claude/keen-dirac-pa4c1y`,
      or `main` once merged). `railway.json` runs `prisma migrate deploy` on deploy.
- [ ] 👤 **Auth0**: create a *Regular Web App*.
  - [ ] Allowed Callback URL: `https://<railway-domain>/api/auth/callback`
  - [ ] Allowed Logout URL: `https://<railway-domain>`
  - [ ] Copy Domain, Client ID, Client Secret.
- [ ] 👤 Set Railway env vars:
  - [ ] `DATABASE_URL` (auto-provided by the Postgres plugin)
  - [ ] `AUTH0_SECRET` = output of `openssl rand -hex 32`
  - [ ] `AUTH0_BASE_URL` = `https://<railway-domain>`
  - [ ] `AUTH0_ISSUER_BASE_URL` = `https://<tenant>.us.auth0.com`
  - [ ] `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
  - [ ] **Do NOT set `AUTH_DISABLED`** (it must be off in production)
- [ ] 👤 Deploy. Then seed the 695 leads once: `railway run npm run seed`.
- [ ] ✅ Visit the domain → log in → Contacts + Kanban load with your leads.

## Stage 1 — Automatic lead capture (interim Zapier)  ⏱ ~20 min · leads flow in now

- [ ] 👤 Set `ZAPIER_INBOUND_SECRET` in Railway (any long random string).
- [ ] 👤 **Zapier** Zap: *Facebook Lead Ads → new lead* → **Webhooks by Zapier → POST**:
  - URL: `https://<railway-domain>/api/inbound/zapier`
  - Header: `x-webhook-secret: <ZAPIER_INBOUND_SECRET>`
  - JSON body fields: `id, created, name, email, phone, title, company, platform,
    campaign, adset, ad, form, source`
- [ ] ✅ Submit a test lead → it appears in Contacts with a follow-up task.

---

## Stage 2 — Meta direct (the long pole — start TODAY, runs days–weeks)

- [ ] 👤 Create a **Meta app**; add the **Webhooks** + **Lead Ads** products.
- [ ] 👤 Request the **`leads_retrieval`** permission.
- [ ] 👤 Complete **Business Verification** + **App Review**.
- [ ] 👤 **Publish a privacy policy** (see `docs/PRIVACY_POLICY.md`) and host it at a
      public URL; add that URL in the Meta app settings.
- [ ] 👤 After approval, set Railway env: `META_APP_SECRET`, `META_VERIFY_TOKEN`,
      `META_GRAPH_TOKEN`, `META_GRAPH_VERSION` (default `v19.0`).
- [ ] 👤 In Meta, subscribe the `leadgen` webhook to
      `https://<railway-domain>/api/webhooks/meta` (verify token = `META_VERIFY_TOKEN`).
- [ ] 👤 Set `META_FORM_IDS` (comma-separated) + `CRON_SECRET`; add a **Railway cron**
      service hitting `GET /api/cron/backstop` nightly (missed-webhook safety net).
- [ ] 👤 Once leads arrive natively, turn off the Stage 1 Zapier zap.
- [ ] 🤖 I verify the handshake + a sample lead end-to-end.

---

## Stage 3 — MailerLite  ⏱ ~30 min (independent)

- [ ] 👤 Create a MailerLite API token → set `MAILERLITE_API_KEY`.
- [ ] 👤 Create the "Leads" group; set `MAILERLITE_GROUP_ID` to its id.
- [ ] 👤 Create a **custom field with key `crm_status`** (so status syncs).
- [ ] 👤 (Optional) MailerLite webhook → `https://<domain>/api/webhooks/mailerlite`,
      set `MAILERLITE_WEBHOOK_SECRET` and send it as `x-mailerlite-signature`.
- [ ] ✅ Change a lead's stage → subscriber upserts with the new `crm_status`.

## Stage 4 — Stripe + analytics  ⏱ ~30 min (independent)

- [ ] 👤 Set `STRIPE_SECRET_KEY`.
- [ ] 👤 Add a Stripe webhook → `https://<domain>/api/webhooks/stripe`
      (events: `checkout.session.completed`, `charge.succeeded`,
      `payment_intent.succeeded`); put its signing secret in `STRIPE_WEBHOOK_SECRET`.
- [ ] ✅ A test payment flips the matched lead to **Customer** with a deal value.
- [ ] 👤 On the **Analytics** page, enter ad spend per campaign → CPL/CAC/ROAS populate.

## Stage 5 — Outlook  ⏱ ~45 min (independent, optional)

- [ ] 👤 Register an **Azure app**; add **application** permissions **Mail.Send** +
      **Calendars.ReadWrite**; grant **admin consent**; create a client secret.
- [ ] 👤 Set `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_GRAPH_SENDER`
      (the mailbox to send as).
- [ ] ✅ A "Send email via Outlook" box appears on each lead; sends log to the timeline.

---

## Cross-cutting

- [ ] 👤 Create a `main` branch (or merge this one) so 🤖 can open a **PR** for review.
- [ ] 👤/🤖 Decide **PII-in-git**: keep `data/leads.json` committed, or remove it and
      seed only via `railway run npm run seed`.
- [ ] 👤 Confirm Railway daily **backups** are on (you're storing PII).
- [ ] ✅ CI (`.github/workflows/ci.yml`) runs migrate + seed + typecheck + lint + test
      + build on every push.

## Quick reference — which env var unlocks what

| Feature | Required env vars |
|---|---|
| Login | `AUTH0_SECRET`, `AUTH0_BASE_URL`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` |
| Zapier feed | `ZAPIER_INBOUND_SECRET` |
| Meta webhook | `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_GRAPH_TOKEN` |
| Backstop cron | `CRON_SECRET`, `META_FORM_IDS`, `META_GRAPH_TOKEN` |
| MailerLite | `MAILERLITE_API_KEY`, `MAILERLITE_GROUP_ID` (+ `crm_status` field) |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Outlook | `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_GRAPH_SENDER` |
