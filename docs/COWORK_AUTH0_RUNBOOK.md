# Cowork runbook — connect Leads CRM login to Holy Insights Auth0

**For:** Claude Cowork, acting in Braden's browser.
**Goal:** Braden signs in to the Leads CRM with his Holy Insights superadmin
account (`braden@holyinsights.org`), nobody else can get in, and the
temporary `AUTH_DISABLED` bypass is removed.
**Time:** ~15 minutes. Follow the steps in order. Do not skip the checks.

The code side is already done and deployed. This runbook is only dashboard
work in **Auth0** and **Railway**.

---

## Ground rules (read first)

1. **Never put a secret in chat, a note, or your final report.** Copy the Auth0
   Client Secret straight from Auth0 into Railway with the clipboard, then
   clear it from your working notes. Client IDs, domains and Auth0 user ids
   are not secrets and may be reported.
2. **Holy Insights is read-only.** Do not edit, rotate, or delete anything on
   the existing Holy Insights Auth0 application, its connections' settings, any
   Auth0 user, or the `holy-insights` Railway project. The only thing you do
   there is *read* one variable (Step 1).
3. **In Railway, touch only the `Leads` service** in project
   `alluring-blessing`, environment `production`, and only the variables
   named in Step 5.
4. **Stop and ask Braden** instead of improvising if anything doesn't match
   what this runbook says you'll see. Each step lists what to expect.

## Fixed values

| Name | Value |
|---|---|
| Leads URL | `https://leads-production-9c52.up.railway.app` |
| Leads Railway project / service / env | `alluring-blessing` / `Leads` / `production` |
| Holy Insights Railway project / service | `holy-insights` / `holy-insights` |
| Braden's Holy Insights login | `braden@holyinsights.org` |
| New Auth0 application name | `Leads CRM` |

---

## Step 1 — Find the Holy Insights Auth0 tenant domain (read-only)

1. Open https://railway.com/dashboard → project **holy-insights** → service
   **holy-insights** → **Variables** tab.
2. Find **`AUTH0_DOMAIN`** and click the eye icon to reveal it. It looks like
   `something.us.auth0.com` or a custom domain such as `auth.holyinsights.org`.
3. Write it down as **TENANT_DOMAIN**. Change nothing in this project.

✅ Check: you have a domain with no `https://` and no trailing slash.

## Step 2 — Open that tenant in Auth0

1. Open https://manage.auth0.com and sign in.
2. Use the tenant switcher (top-left) to select the tenant that owns
   TENANT_DOMAIN. To confirm you're in the right one: **Applications →
   Applications** should list the Holy Insights app. Open it, and its
   **Settings → Domain** should equal TENANT_DOMAIN. If TENANT_DOMAIN is a
   custom domain, confirm it under **Branding → Custom Domains** instead.
3. On the Holy Insights application, open the **Connections** tab and note
   exactly which connections are enabled (for example
   `Username-Password-Authentication`, `google-oauth2`). Do not change them.

✅ Check: you're in the tenant whose app domain matches TENANT_DOMAIN, and you
have the list of enabled connections.

## Step 3 — Create (or reuse) the "Leads CRM" application

1. **Applications → Applications.** If an application named `Leads CRM` (or
   one whose Allowed Callback URLs already contain
   `leads-production-9c52.up.railway.app`) already exists **in this tenant**,
   reuse it and skip to sub-step 3. Otherwise click **Create Application**.
2. Name: `Leads CRM`. Type: **Regular Web Applications**. Click **Create**.
   Skip any "choose a technology" quickstart.
3. **Settings** tab → *Application URIs*. Set each field to exactly these
   values (comma-separated, replacing what's there):
   - **Allowed Callback URLs:**
     `https://leads-production-9c52.up.railway.app/api/auth/callback, http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs:**
     `https://leads-production-9c52.up.railway.app, http://localhost:3000`
   - **Allowed Web Origins:**
     `https://leads-production-9c52.up.railway.app, http://localhost:3000`
   - Leave **Application Login URI** empty.
4. Scroll to the bottom and click **Save Changes**. Wait for the "saved"
   confirmation.
5. **Connections** tab: enable exactly the same connections the Holy Insights
   app has (from Step 2.3), and no others. Each toggle saves immediately.

✅ Check: Settings shows the three URL fields as above, and Connections matches
the Holy Insights app.

## Step 4 — Check Braden's Auth0 user (read-only)

1. **User Management → Users** → search `braden@holyinsights.org`.
2. For **each** user record that appears, open it and note:
   - **user_id** (shown near the top, e.g. `auth0|65f…` or `google-oauth2|10…`)
   - **Connection**
   - **Email verified**: yes or no
3. Decide:
   - If at least one record has **Email verified = yes**, you need nothing
     more here. `ALLOWED_EMAILS` (already set) admits verified emails.
   - If **every** record shows Email verified = no, **stop and ask Braden**
     which record (connection) he uses to log in to Holy Insights. You will
     put that record's `user_id` into `ALLOWED_AUTH0_SUBS` in Step 5. Do not
     add a record Braden hasn't confirmed is his: an unverified email can
     belong to someone else.

Do not edit, verify, or delete any user.

## Step 5 — Set the Leads variables in Railway

1. Back in the new Auth0 app → **Settings** → *Basic Information*. You'll copy
   **Client ID** and **Client Secret** from here.
2. Open Railway → project **alluring-blessing** → service **Leads** →
   **Variables**. Set these, creating or editing as needed:

   | Variable | Value |
   |---|---|
   | `AUTH0_ISSUER_BASE_URL` | `https://` + TENANT_DOMAIN (no trailing slash) |
   | `AUTH0_CLIENT_ID` | the new app's Client ID |
   | `AUTH0_CLIENT_SECRET` | the new app's Client Secret (copy, then paste) |
   | `AUTH0_BASE_URL` | `https://leads-production-9c52.up.railway.app` (check it's exactly this, no trailing slash) |
   | `ALLOWED_EMAILS` | `braden@holyinsights.org` (already set, so just confirm it) |
   | `ALLOWED_AUTH0_SUBS` | **only if Step 4 told you to:** the confirmed `user_id` |

3. **Delete** the variable **`AUTH_DISABLED`** entirely. Don't just set it to
   `false`.
4. Leave `AUTH0_SECRET`, `DATABASE_URL`, `META_GRAPH_VERSION`, and every
   `RAILWAY_*` variable untouched.
5. If Railway shows a banner with staged changes, click **Deploy** (or
   **Apply changes**). Open the **Deployments** tab and wait until the newest
   deployment shows **Success / Active** (about 1–2 minutes).

✅ Check: the newest deployment is **Success**, and the Variables list has no
`AUTH_DISABLED`.

## Step 6 — Verify login (expected results matter)

Use a **private/incognito window** for steps 1–3 so you start signed out.

1. Go to `https://leads-production-9c52.up.railway.app/contacts`.
   **Expect:** you're redirected to an Auth0 login page for the Holy Insights
   tenant (not a Leads page, and not an error).
2. Close that tab. Go to `https://leads-production-9c52.up.railway.app/`.
   **Expect:** a "Leads CRM — Please log in" page with a **Log in** button.
3. Click **Log in** and sign in as `braden@holyinsights.org`, using the same
   method he uses for Holy Insights. If Braden must type a password or MFA
   code himself, ask him to do it.
   **Expect:** you land on `/contacts` showing a table of leads, with a count
   in the top-right such as "695 leads".
4. Open **Kanban** and **Funnel** from the top nav. **Expect:** both load with
   data.
5. Click **Log out** (top-right). **Expect:** you're returned to the
   "Please log in" page.

### If something else happens

| You see | Meaning | Do this |
|---|---|---|
| "No access to Leads CRM" page | Logged in, but not allowlisted (email not verified) | Report the **Auth0 id** shown on that page to Braden. Once he confirms it's his, add it as `ALLOWED_AUTH0_SUBS` in Railway, deploy, and retry step 3. |
| Auth0 error "Callback URL mismatch" | A URL in Step 3.3 is wrong | Recheck **Allowed Callback URLs** character by character. |
| Auth0 error about the connection, or "no connections enabled" | Step 3.5 missed a connection | Enable the missing connection on **Leads CRM**. |
| Leads shows a 500 / "Application error" | A variable is wrong or missing | Recheck Step 5 (common causes: `https://` missing from `AUTH0_ISSUER_BASE_URL`, a trailing slash, or a mistyped secret). Then report the latest deployment's logs. |
| `/contacts` loads, but the count is **0** or the table is empty | Production database not seeded | Don't try to fix it. Report it. Seeding is done separately (`docs/LOCAL_SESSION.md` §3). |
| Step 1 shows Leads pages **without** asking you to log in | `AUTH_DISABLED` is still active | Make sure the variable is deleted and the new deployment is Success, then retry. |

## Step 7 — Report back to Braden

Reply with this filled in. **Do not include the Client Secret.**

```
Leads CRM ↔ Holy Insights Auth0 — result
- Tenant domain used: <TENANT_DOMAIN>
- Auth0 app: <created new "Leads CRM" | reused "<name>">, Client ID <id>
- Connections enabled on Leads CRM: <list>  (matches Holy Insights: yes/no)
- Braden's user record(s): <user_id — connection — verified yes/no>, ...
- ALLOWED_AUTH0_SUBS set: <no | yes: user_id>
- AUTH_DISABLED deleted: yes/no
- Latest Leads deployment: <Success/Failed> at <time>
- Signed-out /contacts redirected to Auth0 login: yes/no
- Login as braden@holyinsights.org landed on /contacts: yes/no
- Lead count shown: <number>
- Logout worked: yes/no
- Anything unexpected: <details or "none">
```
