// Maps a raw lead from the HTML/CSV export shape into our Prisma create input.
// Used by the seed script and the interim Zapier inbound endpoint.

import {
  LABEL_TO_STATUS,
  LABEL_TO_PRIORITY,
  type LeadStatus,
  type Priority,
} from "./status";

// Shape of a row in data/leads.json (the current HTML "Save" output).
export interface RawLead {
  id: string;
  created?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  platform?: string;
  campaign?: string;
  adset?: string;
  ad?: string;
  form?: string;
  status?: string;
  priority?: string;
  followup?: string;
  last_contact?: string;
  notes?: string;
  inbox?: string;
  source?: string;
}

export interface NormalizedLead {
  id: string;
  createdTime: Date | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  platform: string | null;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  form: string | null;
  inboxUrl: string | null;
  source: string | null;
  status: LeadStatus;
  priority: Priority;
  nextFollowup: Date | null;
  lastContacted: Date | null;
  notes: string | null;
}

const toDate = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const trimOrNull = (s?: string): string | null => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

// Meta exports phones as "p:+1404..." and ids as "l:123...". Keep the lead id
// as-is (it is our primary/dedupe key) but strip the "p:" display prefix off
// phones for readability.
export const cleanPhone = (raw?: string): string | null => {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return t.replace(/^p:/i, "").trim() || null;
};

// Digits-only key for duplicate detection (ignores +, spaces, punctuation).
export const phoneKey = (raw?: string): string => (raw ?? "").replace(/\D/g, "");

export const emailKey = (raw?: string): string => (raw ?? "").trim().toLowerCase();

// Tiny deterministic string hash (djb2) — stable across runs without crypto.
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// Some legacy exports have a blank id (a bad dedupe key). Derive a stable
// synthetic id from the record's identifying fields so upserts stay idempotent.
function resolveId(r: RawLead): string {
  const id = (r.id ?? "").trim();
  if (id) return id;
  const basis = [r.name, r.email, r.phone, r.company, r.created]
    .map((v) => (v ?? "").trim())
    .join("|");
  return `legacy:${shortHash(basis)}`;
}

export function normalizeRawLead(r: RawLead): NormalizedLead {
  return {
    id: resolveId(r),
    createdTime: toDate(r.created),
    name: trimOrNull(r.name),
    email: trimOrNull(r.email),
    phone: cleanPhone(r.phone),
    jobTitle: trimOrNull(r.title),
    company: trimOrNull(r.company),
    platform: trimOrNull(r.platform),
    campaign: trimOrNull(r.campaign),
    adset: trimOrNull(r.adset),
    ad: trimOrNull(r.ad),
    form: trimOrNull(r.form),
    inboxUrl: trimOrNull(r.inbox),
    source: trimOrNull(r.source),
    status: LABEL_TO_STATUS[(r.status ?? "").trim()] ?? "NEW",
    priority: LABEL_TO_PRIORITY[(r.priority ?? "").trim()] ?? "NONE",
    nextFollowup: toDate(r.followup),
    lastContacted: toDate(r.last_contact),
    notes: trimOrNull(r.notes),
  };
}
