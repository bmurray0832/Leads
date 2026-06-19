import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyStripeSignature,
  extractPayment,
  recordStripePayment,
} from "@/lib/stripe";
import { syncLeadToMailerLite } from "@/lib/mailerliteSync";

export const dynamic = "force-dynamic";

// Stripe payment webhook (Phase 4). Verifies the signature over the raw body,
// then on a successful payment matches the lead by email, flips it to CUSTOMER,
// stamps deal value + stripeCustomerId, and writes a PAYMENT activity.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!verifyStripeSignature(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const payment = extractPayment(event);
  const eventId = (event as { id?: string })?.id;

  if (!payment || !payment.amountCents) {
    // Not a payment event we act on.
    return NextResponse.json({ ok: true, matched: false, ignored: true });
  }

  const result = await recordStripePayment(prisma, payment, eventId);
  if (result.matched && result.leadId) {
    await syncLeadToMailerLite(result.leadId); // reflect Customer status
  }

  return NextResponse.json({ ok: true, matched: result.matched });
}
