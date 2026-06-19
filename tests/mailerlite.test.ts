import { describe, it, expect } from "vitest";
import {
  buildSubscriberPayload,
  syncSubscriber,
  pushStatus,
  parseMailerLiteEvents,
  isUnsubscribeEvent,
  type MailerLiteOptions,
} from "@/lib/mailerlite";

// Records each request and returns a canned subscriber response.
function recordingFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({ data: { id: "sub_1", email: "jane@example.org" } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("buildSubscriberPayload", () => {
  it("maps status to the crm_status field and lowercases the email", () => {
    const payload = buildSubscriberPayload({
      email: "Jane@Example.org",
      name: "Jane Pastor",
      status: "MEETING_SCHEDULED",
      groupIds: ["g1"],
    });
    expect(payload).toEqual({
      email: "jane@example.org",
      fields: { name: "Jane Pastor", crm_status: "Meeting Scheduled" },
      groups: ["g1"],
    });
  });

  it("omits empty fields and groups", () => {
    expect(buildSubscriberPayload({ email: "a@b.com" })).toEqual({
      email: "a@b.com",
    });
  });
});

describe("syncSubscriber", () => {
  const opts = (fetchImpl: typeof fetch): MailerLiteOptions => ({
    apiKey: "test-key",
    fetchImpl,
  });

  it("posts to /subscribers with the bearer token and returns the id", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const sub = await syncSubscriber(opts(fetchImpl), {
      email: "jane@example.org",
      status: "CONTACTED",
    });

    expect(sub).toEqual({ id: "sub_1", email: "jane@example.org" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/subscribers");
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
  });

  it("is idempotent: identical inputs produce identical request bodies", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const params = { email: "jane@example.org", status: "MET" as const };
    await syncSubscriber(opts(fetchImpl), params);
    await syncSubscriber(opts(fetchImpl), params);

    expect(calls).toHaveLength(2);
    expect(calls[0].init.body).toBe(calls[1].init.body);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      email: "jane@example.org",
      fields: { crm_status: "Met" },
    });
  });

  it("pushStatus reflects the right status label", async () => {
    const { calls, fetchImpl } = recordingFetch();
    await pushStatus(opts(fetchImpl), "jane@example.org", "CUSTOMER", ["g1"]);
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.fields.crm_status).toBe("Customer");
    expect(body.groups).toEqual(["g1"]);
  });

  it("throws without an API key", async () => {
    await expect(
      syncSubscriber({}, { email: "a@b.com" }),
    ).rejects.toThrow(/MAILERLITE_API_KEY/);
  });
});

describe("inbound event parsing", () => {
  it("flattens the events array and detects unsubscribes", () => {
    const events = parseMailerLiteEvents({
      events: [
        { type: "subscriber.unsubscribed", data: { email: "x@y.com" } },
        { type: "subscriber.created", data: { email: "z@y.com" } },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: "subscriber.unsubscribed",
      email: "x@y.com",
    });
    expect(isUnsubscribeEvent(events[0].type)).toBe(true);
    expect(isUnsubscribeEvent(events[1].type)).toBe(false);
  });

  it("tolerates a single-event body", () => {
    const events = parseMailerLiteEvents({
      type: "subscriber.bounced",
      email: "b@c.com",
    });
    expect(events).toEqual([{ type: "subscriber.bounced", email: "b@c.com" }]);
  });
});
