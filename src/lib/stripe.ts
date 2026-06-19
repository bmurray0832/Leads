// Stripe integration (Phase 4): webhook signature verification, event payment
// extraction, and recording a payment against a lead. No Stripe SDK dependency
// — the signature scheme is implemented directly. The db is injectable so
// recordStripePayment is unit-testable with a mock.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { LeadStatus } from "./status";

// ---- Signature ----

// Verifies the Stripe-Signature header: "t=<ts>,v1=<hmac>" where the signed
// payload is `${ts}.${rawBody}` HMAC-SHA256'd with the webhook secret.
export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null | undefined,
  secret: string | undefined,
  opts: { nowSec?: number; toleranceSec?: number } = {},
): boolean {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const ts = parts["t"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const tolerance = opts.toleranceSec ?? 300;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > tolerance) return false;

  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Test helper / mirror of how Stripe signs requests.
export function signStripePayload(
  rawBody: string,
  secret: string,
  ts: number,
): string {
  const sig = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  return `t=${ts},v1=${sig}`;
}

// ---- Event extraction ----

export interface PaymentInfo {
  type: string;
  email?: string;
  amountCents?: number;
  customerId?: string;
}

// Pulls the payment essentials out of the event types we care about.
export function extractPayment(event: unknown): PaymentInfo | null {
  const e = event as {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  const type = e?.type;
  const obj = e?.data?.object;
  if (!type || !obj) return null;

  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v ? v : undefined;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" ? v : undefined;

  switch (type) {
    case "checkout.session.completed": {
      const details = obj.customer_details as { email?: string } | undefined;
      return {
        type,
        email: str(details?.email) ?? str(obj.customer_email),
        amountCents: num(obj.amount_total),
        customerId: str(obj.customer),
      };
    }
    case "charge.succeeded": {
      const billing = obj.billing_details as { email?: string } | undefined;
      return {
        type,
        email: str(billing?.email) ?? str(obj.receipt_email),
        amountCents: num(obj.amount),
        customerId: str(obj.customer),
      };
    }
    case "payment_intent.succeeded": {
      return {
        type,
        email: str(obj.receipt_email),
        amountCents: num(obj.amount_received) ?? num(obj.amount),
        customerId: str(obj.customer),
      };
    }
    default:
      return { type };
  }
}

// ---- Recording ----

export interface StripeDb {
  lead: {
    findFirst(args: {
      where: { email: { equals: string; mode: "insensitive" } };
      select: { id: true; status: true };
    }): Promise<{ id: string; status: LeadStatus } | null>;
    update(args: {
      where: { id: string };
      data: {
        status: LeadStatus;
        dealValue: number;
        stripeCustomerId: string | null;
      };
    }): Promise<unknown>;
  };
  stageHistory: {
    create(args: {
      data: { leadId: string; fromStage: LeadStatus | null; toStage: LeadStatus };
    }): Promise<unknown>;
  };
  activity: {
    create(args: {
      data: {
        leadId: string;
        type: "PAYMENT";
        body: string;
        externalId: string | null;
      };
    }): Promise<unknown>;
  };
}

export interface RecordResult {
  matched: boolean;
  leadId?: string;
}

// Matches a payment to a lead by email, flips it to CUSTOMER (logging a stage
// change when it wasn't already), stamps deal value + customer id, and writes a
// PAYMENT activity.
export async function recordStripePayment(
  db: StripeDb,
  payment: PaymentInfo,
  externalId?: string,
): Promise<RecordResult> {
  if (!payment.email) return { matched: false };

  const lead = await db.lead.findFirst({
    where: { email: { equals: payment.email, mode: "insensitive" } },
    select: { id: true, status: true },
  });
  if (!lead) return { matched: false };

  const amount = (payment.amountCents ?? 0) / 100;

  if (lead.status !== "CUSTOMER") {
    await db.stageHistory.create({
      data: { leadId: lead.id, fromStage: lead.status, toStage: "CUSTOMER" },
    });
  }
  await db.lead.update({
    where: { id: lead.id },
    data: {
      status: "CUSTOMER",
      dealValue: amount,
      stripeCustomerId: payment.customerId ?? null,
    },
  });
  await db.activity.create({
    data: {
      leadId: lead.id,
      type: "PAYMENT",
      body: `Stripe payment of $${amount.toFixed(2)} (${payment.type})`,
      externalId: externalId ?? null,
    },
  });

  return { matched: true, leadId: lead.id };
}
