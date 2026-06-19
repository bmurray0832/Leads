import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestRawLead } from "@/lib/ingest";
import { syncLeadToMailerLite } from "@/lib/mailerliteSync";
import type { RawLead } from "@/lib/normalize";

export const dynamic = "force-dynamic";

// Interim inbound feed: Zapier posts new Facebook leads here until the Meta
// leadgen webhook (Phase 2) is approved. Accepts a single lead object or an
// array of them, in the same shape as the HTML/CSV export.
//
// Auth: shared secret in the `x-webhook-secret` header (set ZAPIER_INBOUND_SECRET).
export async function POST(req: NextRequest) {
  const secret = process.env.ZAPIER_INBOUND_SECRET;
  if (secret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const rows: RawLead[] = Array.isArray(payload)
    ? (payload as RawLead[])
    : [payload as RawLead];

  const results = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const res = await ingestRawLead(prisma, row);
    results.push(res);
    // Push brand-new leads to MailerLite (best-effort).
    if (res.created) await syncLeadToMailerLite(res.id);
  }

  const created = results.filter((r) => r.created).length;
  return NextResponse.json({ ok: true, received: rows.length, created, results });
}
