import { describe, it, expect } from "vitest";
import {
  verifyStripeSignature,
  signStripePayload,
  extractPayment,
  recordStripePayment,
  type StripeDb,
} from "@/lib/stripe";
import type { LeadStatus } from "@/lib/status";

const SECRET = "whsec_test";

describe("Stripe signature verification", () => {
  const body = JSON.stringify({ id: "evt_1", type: "charge.succeeded" });
  const now = 1_700_000_000;

  it("accepts a valid, in-tolerance signature", () => {
    const header = signStripePayload(body, SECRET, now);
    expect(
      verifyStripeSignature(body, header, SECRET, { nowSec: now }),
    ).toBe(true);
  });

  it("rejects a tampered body, wrong secret, and stale timestamp", () => {
    const header = signStripePayload(body, SECRET, now);
    expect(
      verifyStripeSignature(body + "x", header, SECRET, { nowSec: now }),
    ).toBe(false);
    expect(
      verifyStripeSignature(body, header, "wrong", { nowSec: now }),
    ).toBe(false);
    expect(
      verifyStripeSignature(body, header, SECRET, { nowSec: now + 10_000 }),
    ).toBe(false);
    expect(verifyStripeSignature(body, null, SECRET)).toBe(false);
  });
});

describe("extractPayment", () => {
  it("reads checkout.session.completed", () => {
    const p = extractPayment({
      type: "checkout.session.completed",
      data: {
        object: {
          customer_details: { email: "buyer@church.org" },
          amount_total: 250000,
          customer: "cus_123",
        },
      },
    });
    expect(p).toEqual({
      type: "checkout.session.completed",
      email: "buyer@church.org",
      amountCents: 250000,
      customerId: "cus_123",
    });
  });

  it("reads charge.succeeded", () => {
    const p = extractPayment({
      type: "charge.succeeded",
      data: {
        object: {
          billing_details: { email: "buyer@church.org" },
          amount: 5000,
          customer: "cus_9",
        },
      },
    });
    expect(p?.amountCents).toBe(5000);
    expect(p?.email).toBe("buyer@church.org");
  });
});

// Mock StripeDb tracking writes against a single known lead.
function mockDb(status: LeadStatus) {
  const calls = { stageHistory: 0, leadUpdate: 0, activity: 0 };
  let updated: { status: LeadStatus; dealValue: number; stripeCustomerId: string | null } | null =
    null;
  const db: StripeDb = {
    lead: {
      async findFirst() {
        return { id: "lead_1", status };
      },
      async update({ data }) {
        calls.leadUpdate++;
        updated = data;
        return {};
      },
    },
    stageHistory: {
      async create() {
        calls.stageHistory++;
        return {};
      },
    },
    activity: {
      async create() {
        calls.activity++;
        return {};
      },
    },
  };
  return { db, calls, get updated() { return updated; } };
}

describe("recordStripePayment", () => {
  it("flips a non-customer lead to CUSTOMER with deal value + PAYMENT activity", async () => {
    const m = mockDb("MEETING_SCHEDULED");
    const res = await recordStripePayment(
      m.db,
      {
        type: "checkout.session.completed",
        email: "buyer@church.org",
        amountCents: 250000,
        customerId: "cus_123",
      },
      "evt_1",
    );

    expect(res).toEqual({ matched: true, leadId: "lead_1" });
    expect(m.calls.stageHistory).toBe(1);
    expect(m.calls.leadUpdate).toBe(1);
    expect(m.calls.activity).toBe(1);
    expect(m.updated).toEqual({
      status: "CUSTOMER",
      dealValue: 2500,
      stripeCustomerId: "cus_123",
    });
  });

  it("does not write a stage change when already a customer", async () => {
    const m = mockDb("CUSTOMER");
    await recordStripePayment(m.db, {
      type: "charge.succeeded",
      email: "buyer@church.org",
      amountCents: 5000,
    });
    expect(m.calls.stageHistory).toBe(0);
    expect(m.calls.leadUpdate).toBe(1);
  });

  it("no match when the payment has no email", async () => {
    const m = mockDb("NEW");
    const res = await recordStripePayment(m.db, { type: "charge.succeeded" });
    expect(res).toEqual({ matched: false });
    expect(m.calls.leadUpdate).toBe(0);
  });
});
