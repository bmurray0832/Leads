import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMailerLiteEvents, isUnsubscribeEvent } from "@/lib/mailerlite";

export const dynamic = "force-dynamic";

// MailerLite inbound webhook (optional, Phase 3). Logs unsubscribes/spam/bounces
// onto the matching lead's timeline so the CRM reflects opt-outs.
//
// Auth: if MAILERLITE_WEBHOOK_SECRET is set, the request must carry it in the
// x-mailerlite-signature header.
export async function POST(req: NextRequest) {
  const secret = process.env.MAILERLITE_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-mailerlite-signature") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events = parseMailerLiteEvents(payload);
  let logged = 0;

  for (const e of events) {
    if (!e.email || !isUnsubscribeEvent(e.type)) continue;
    const lead = await prisma.lead.findFirst({
      where: { email: { equals: e.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!lead) continue;
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: "NOTE",
        body: `MailerLite: ${e.type}`,
      },
    });
    logged++;
  }

  return NextResponse.json({ ok: true, events: events.length, logged });
}
