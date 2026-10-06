// Pure auth-gate logic — no Prisma/Auth0 imports so it is cheap to import
// from middleware (edge) and to unit test.

export const authDisabled = process.env.AUTH_DISABLED === "true";

// Who may use the CRM. Leads shares the Holy Insights Auth0 tenant, so being
// able to log in is not enough — only allowlisted identities get in.
export interface Allowlist {
  subs: string[]; // Auth0 user ids, e.g. "auth0|abc123" (case-sensitive)
  emails: string[]; // lowercased; only honoured when the email is verified
}

const splitList = (v?: string): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function allowlistFromEnv(
  env: Record<string, string | undefined> = process.env,
): Allowlist {
  return {
    subs: splitList(env.ALLOWED_AUTH0_SUBS),
    emails: splitList(env.ALLOWED_EMAILS).map((e) => e.toLowerCase()),
  };
}

export interface SessionIdentity {
  sub?: string | null;
  email?: string | null;
  email_verified?: boolean | null;
}

// Fails closed: an empty allowlist admits no one. Email matches require a
// verified email so nobody can claim an allowlisted address they don't own.
export function isAllowedUser(u: SessionIdentity, list: Allowlist): boolean {
  if (u.sub && list.subs.includes(u.sub)) return true;
  const email = (u.email ?? "").trim().toLowerCase();
  return Boolean(email && u.email_verified === true && list.emails.includes(email));
}

// AUTH_DISABLED=true bypasses the gate for local dev / CI only. Never in prod.
export function gateDecision(input: {
  authDisabled: boolean;
  hasSession: boolean;
  allowed: boolean;
}): "allow" | "login" | "forbidden" {
  if (input.authDisabled) return "allow";
  if (!input.hasSession) return "login";
  return input.allowed ? "allow" : "forbidden";
}
