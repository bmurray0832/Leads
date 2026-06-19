import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { processFormBackstop } from "@/lib/meta";
import { syncLeadToMailerLite } from "@/lib/mailerliteSync";

export const dynamic = "force-dynamic";

// Nightly backstop (Railway cron): re-pulls recent Meta leads for the configured
// forms so nothing is lost if a webhook was missed. Dedupe makes it idempotent.
//
// Auth: CRON_SECRET via the x-cron-secret header or ?secret= query param.
// Configure META_FORM_IDS as a comma-separated list of lead form ids.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-cron-secret") ??
      req.nextUrl.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const formIds = (process.env.META_FORM_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (formIds.length === 0 || !process.env.META_GRAPH_TOKEN) {
    return NextResponse.json({ ok: true, skipped: true, reason: "not configured" });
  }

  const { results, errors } = await processFormBackstop(prisma, formIds);
  const created = results.filter((r) => r.created).length;

  // Sync the brand-new ones to MailerLite (best-effort).
  for (const r of results) {
    if (r.created) await syncLeadToMailerLite(r.id);
  }

  return NextResponse.json({
    ok: true,
    forms: formIds.length,
    processed: results.length,
    created,
    errors,
  });
}
