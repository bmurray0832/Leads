// Meta Lead Ads (Phase 2): leadgen webhook verification, payload parsing,
// Graph API field mapping, and the processing pipeline. The Graph fetch is
// injectable so the pipeline can be unit tested without network access.

import { createHmac, timingSafeEqual } from "node:crypto";
import { ingestRawLead, type IngestDb, type IngestResult } from "./ingest";
import type { RawLead } from "./normalize";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v19.0";

// ---- Webhook signature ----

// Verifies the X-Hub-Signature-256 header against an HMAC-SHA256 of the raw
// request body keyed by the app secret. Constant-time comparison.
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | undefined,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// GET handshake: confirm the verify token and echo the challenge.
export function verifyChallenge(
  params: URLSearchParams,
  verifyToken: string | undefined,
): { ok: true; challenge: string } | { ok: false } {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token && verifyToken && token === verifyToken && challenge) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

// ---- Payload parsing ----

export interface LeadgenEntry {
  leadgenId: string;
  formId?: string;
  pageId?: string;
  adId?: string;
  createdTime?: string;
}

// Extracts leadgen events from a webhook payload (object: "page").
export function parseLeadgenPayload(payload: unknown): LeadgenEntry[] {
  const out: LeadgenEntry[] = [];
  const p = payload as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          leadgen_id?: string | number;
          form_id?: string | number;
          page_id?: string | number;
          ad_id?: string | number;
          created_time?: string | number;
        };
      }>;
    }>;
  };
  if (!p?.entry) return out;
  for (const entry of p.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen" || !change.value?.leadgen_id) continue;
      const v = change.value;
      out.push({
        leadgenId: String(v.leadgen_id),
        formId: v.form_id != null ? String(v.form_id) : undefined,
        pageId: v.page_id != null ? String(v.page_id) : undefined,
        adId: v.ad_id != null ? String(v.ad_id) : undefined,
        createdTime:
          v.created_time != null ? String(v.created_time) : undefined,
      });
    }
  }
  return out;
}

// ---- Graph API mapping ----

export interface GraphLead {
  id: string;
  created_time?: string;
  field_data?: Array<{ name: string; values?: string[] }>;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  form_id?: string;
  platform?: string;
}

function fieldValue(lead: GraphLead, ...names: string[]): string | undefined {
  for (const fd of lead.field_data ?? []) {
    if (names.includes(fd.name.toLowerCase())) return fd.values?.[0];
  }
  return undefined;
}

// Maps a Graph API lead response into our RawLead export shape. The id is
// prefixed "l:" to match the convention of the seeded Meta export (so a lead
// that arrives via webhook dedupes against the same lead already imported).
export function mapGraphLeadToRaw(lead: GraphLead): RawLead {
  return {
    id: `l:${lead.id}`,
    created: lead.created_time,
    name: fieldValue(lead, "full_name", "name", "first_name"),
    email: fieldValue(lead, "email"),
    phone: fieldValue(lead, "phone_number", "phone"),
    title: fieldValue(lead, "job_title", "title"),
    company: fieldValue(lead, "company_name", "company"),
    platform: lead.platform,
    campaign: lead.campaign_name,
    adset: lead.adset_name,
    ad: lead.ad_name,
    form: lead.form_id,
    source: "Meta leadgen webhook",
  };
}

// ---- Graph fetch ----

export type FetchLead = (leadgenId: string) => Promise<GraphLead>;

// Default fetcher: pulls a lead by id from the Graph API.
export const graphFetchLead: FetchLead = async (leadgenId) => {
  const token = process.env.META_GRAPH_TOKEN;
  if (!token) throw new Error("META_GRAPH_TOKEN is not set");
  const fields =
    "id,created_time,field_data,campaign_name,adset_name,ad_name,form_id,platform";
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}?fields=${fields}&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Graph API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as GraphLead;
};

// ---- Pipeline ----

// Processes a verified leadgen payload: fetch each lead, map it, ingest it
// (dedupe by id + new-lead automation). Errors per-entry are collected so one
// bad lead doesn't drop the rest.
export async function processLeadgenPayload(
  db: IngestDb,
  payload: unknown,
  opts: { fetchLead?: FetchLead } = {},
): Promise<{ results: IngestResult[]; errors: string[] }> {
  const fetchLead = opts.fetchLead ?? graphFetchLead;
  const entries = parseLeadgenPayload(payload);
  const results: IngestResult[] = [];
  const errors: string[] = [];

  for (const entry of entries) {
    try {
      const graphLead = await fetchLead(entry.leadgenId);
      results.push(await ingestRawLead(db, mapGraphLeadToRaw(graphLead)));
    } catch (e) {
      errors.push(`${entry.leadgenId}: ${(e as Error).message}`);
    }
  }
  return { results, errors };
}
