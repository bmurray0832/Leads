// MailerLite client (Phase 3). Pure payload building is separated from the HTTP
// call, and fetch is injectable, so the sync logic is unit-testable offline.
//
// Uses the MailerLite "new" API (https://connect.mailerlite.com/api).
// Status is reflected as a custom field `crm_status`; the lead is added to a
// configured group. POST /subscribers is an upsert by email (idempotent).

import { STATUS_LABEL, type LeadStatus } from "./status";

const DEFAULT_BASE = "https://connect.mailerlite.com/api";

export interface MailerLiteOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface SubscriberParams {
  email: string;
  name?: string | null;
  status?: LeadStatus;
  groupIds?: string[];
}

export interface SubscriberPayload {
  email: string;
  fields?: Record<string, string>;
  groups?: string[];
}

// Pure: builds the request body for an upsert. Deterministic for a given input
// (this is what makes the sync idempotent).
export function buildSubscriberPayload(p: SubscriberParams): SubscriberPayload {
  const fields: Record<string, string> = {};
  if (p.name) fields.name = p.name;
  if (p.status) fields.crm_status = STATUS_LABEL[p.status];

  const payload: SubscriberPayload = { email: p.email.trim().toLowerCase() };
  if (Object.keys(fields).length > 0) payload.fields = fields;
  if (p.groupIds && p.groupIds.length > 0) payload.groups = p.groupIds;
  return payload;
}

export async function mlRequest<T = unknown>(
  opts: MailerLiteOptions,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (!opts.apiKey) throw new Error("MAILERLITE_API_KEY is not set");
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${opts.baseUrl ?? DEFAULT_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`MailerLite ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export interface MlSubscriber {
  id: string;
  email: string;
}

// Upserts a subscriber by email (create or update) and returns its id.
export async function syncSubscriber(
  opts: MailerLiteOptions,
  params: SubscriberParams,
): Promise<MlSubscriber> {
  const payload = buildSubscriberPayload(params);
  const json = await mlRequest<{ data: { id: string; email: string } }>(
    opts,
    "POST",
    "/subscribers",
    payload,
  );
  return { id: json.data.id, email: json.data.email };
}

// Reflects the CRM status onto the subscriber (same idempotent upsert).
export async function pushStatus(
  opts: MailerLiteOptions,
  email: string,
  status: LeadStatus,
  groupIds?: string[],
): Promise<MlSubscriber> {
  return syncSubscriber(opts, { email, status, groupIds });
}

// ---- Inbound webhook parsing ----

export interface MlEvent {
  type: string;
  email?: string;
}

// Normalizes a MailerLite webhook body into a flat list of {type, email}.
// Tolerates the array-of-events shape and single-event shapes.
export function parseMailerLiteEvents(payload: unknown): MlEvent[] {
  const p = payload as {
    events?: unknown[];
    type?: string;
    event?: string;
    email?: string;
    data?: { email?: string; subscriber?: { email?: string } };
  };
  const arr: unknown[] = Array.isArray(p?.events)
    ? p.events
    : Array.isArray(payload)
      ? (payload as unknown[])
      : p
        ? [p]
        : [];

  const out: MlEvent[] = [];
  for (const raw of arr) {
    const e = raw as {
      type?: string;
      event?: string;
      email?: string;
      data?: { email?: string; subscriber?: { email?: string } };
    };
    const type = e?.type ?? e?.event;
    const email =
      e?.data?.email ?? e?.email ?? e?.data?.subscriber?.email ?? undefined;
    if (type) out.push({ type: String(type), email: email ? String(email) : undefined });
  }
  return out;
}

// True for events that mean the contact opted out.
export function isUnsubscribeEvent(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("unsubscribe") || t.includes("spam") || t.includes("bounce");
}
