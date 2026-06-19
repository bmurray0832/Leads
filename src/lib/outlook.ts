// Outlook / Microsoft Graph integration (Phase 5). App-only (client credentials)
// auth, sending mail and creating calendar events as a configured sender mailbox.
// Pure request builders + injectable fetch keep it unit-testable offline.
//
// Replaces the manual "Emailed on" field once an Azure app is registered with
// Mail.Send / Calendars.ReadWrite application permissions.

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const LOGIN_BASE = "https://login.microsoftonline.com";

export interface OutlookOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string; // mailbox user id or UPN that mail/events are sent as
  fetchImpl?: typeof fetch;
  graphBase?: string;
  loginBase?: string;
}

// ---- Auth (client credentials) ----

export function buildTokenForm(opts: OutlookOptions): URLSearchParams {
  return new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
}

interface TokenCacheEntry {
  token: string;
  exp: number;
}
const tokenCache = new Map<string, TokenCacheEntry>();

export function _resetTokenCache(): void {
  tokenCache.clear();
}

export async function getAppToken(opts: OutlookOptions): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(opts.clientId);
  if (cached && cached.exp > now + 60_000) return cached.token;

  const f = opts.fetchImpl ?? fetch;
  const url = `${opts.loginBase ?? LOGIN_BASE}/${opts.tenantId}/oauth2/v2.0/token`;
  const res = await f(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildTokenForm(opts).toString(),
  });
  if (!res.ok) throw new Error(`Outlook token ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache.set(opts.clientId, {
    token: json.access_token,
    exp: now + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

// ---- Graph request ----

async function graphRequest(
  opts: OutlookOptions,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const token = await getAppToken(opts);
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${opts.graphBase ?? GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`);
  if (res.status === 202 || res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- Send mail ----

export interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

export function buildSendMailBody(p: SendMailParams) {
  return {
    message: {
      subject: p.subject,
      body: { contentType: "HTML", content: p.html },
      toRecipients: [{ emailAddress: { address: p.to } }],
    },
    saveToSentItems: true,
  };
}

export async function sendMail(
  opts: OutlookOptions,
  p: SendMailParams,
): Promise<void> {
  await graphRequest(
    opts,
    "POST",
    `/users/${encodeURIComponent(opts.sender)}/sendMail`,
    buildSendMailBody(p),
  );
}

// ---- Calendar event ----

export interface EventParams {
  subject: string;
  startIso: string;
  endIso: string;
  attendees: string[];
  bodyHtml?: string;
}

export function buildEventBody(p: EventParams) {
  return {
    subject: p.subject,
    body: { contentType: "HTML", content: p.bodyHtml ?? "" },
    start: { dateTime: p.startIso, timeZone: "UTC" },
    end: { dateTime: p.endIso, timeZone: "UTC" },
    attendees: p.attendees.map((a) => ({
      emailAddress: { address: a },
      type: "required",
    })),
  };
}

export async function createEvent(
  opts: OutlookOptions,
  p: EventParams,
): Promise<{ id?: string }> {
  const json = (await graphRequest(
    opts,
    "POST",
    `/users/${encodeURIComponent(opts.sender)}/events`,
    buildEventBody(p),
  )) as { id?: string } | null;
  return json ?? {};
}
