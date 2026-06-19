import { describe, it, expect, beforeEach } from "vitest";
import {
  buildTokenForm,
  buildSendMailBody,
  buildEventBody,
  getAppToken,
  sendMail,
  _resetTokenCache,
  type OutlookOptions,
} from "@/lib/outlook";

beforeEach(() => _resetTokenCache());

const baseOpts = (fetchImpl: typeof fetch): OutlookOptions => ({
  tenantId: "tenant-1",
  clientId: "client-1",
  clientSecret: "secret-1",
  sender: "sales@church.org",
  fetchImpl,
});

describe("pure builders", () => {
  it("builds the client-credentials token form", () => {
    const form = buildTokenForm(baseOpts(fetch));
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("scope")).toBe("https://graph.microsoft.com/.default");
    expect(form.get("client_id")).toBe("client-1");
  });

  it("builds an HTML sendMail body", () => {
    const body = buildSendMailBody({
      to: "lead@x.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });
    expect(body.message.toRecipients[0].emailAddress.address).toBe("lead@x.com");
    expect(body.message.body.contentType).toBe("HTML");
    expect(body.saveToSentItems).toBe(true);
  });

  it("builds a calendar event body with attendees", () => {
    const body = buildEventBody({
      subject: "Intro call",
      startIso: "2026-07-01T15:00:00",
      endIso: "2026-07-01T15:30:00",
      attendees: ["lead@x.com"],
    });
    expect(body.start.timeZone).toBe("UTC");
    expect(body.attendees[0].emailAddress.address).toBe("lead@x.com");
    expect(body.attendees[0].type).toBe("required");
  });
});

// Fetch stub that answers the token endpoint then the Graph endpoint.
function graphStub() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {} });
    if (u.includes("/oauth2/v2.0/token")) {
      return new Response(
        JSON.stringify({ access_token: "tok-123", expires_in: 3600 }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 202 }); // sendMail returns 202
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("getAppToken", () => {
  it("fetches once and caches the token", async () => {
    const { calls, fetchImpl } = graphStub();
    const opts = baseOpts(fetchImpl);
    const t1 = await getAppToken(opts);
    const t2 = await getAppToken(opts);
    expect(t1).toBe("tok-123");
    expect(t2).toBe("tok-123");
    expect(calls.filter((c) => c.url.includes("/token"))).toHaveLength(1);
  });
});

describe("sendMail", () => {
  it("authenticates then posts sendMail with a bearer token", async () => {
    const { calls, fetchImpl } = graphStub();
    await sendMail(baseOpts(fetchImpl), {
      to: "lead@x.com",
      subject: "Hi",
      html: "<p>x</p>",
    });

    const send = calls.find((c) => c.url.includes("/sendMail"));
    expect(send).toBeTruthy();
    expect(send!.url).toContain("/users/sales%40church.org/sendMail");
    const headers = send!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });

  it("propagates Graph errors", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes("/token")) {
        return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
      }
      return new Response("forbidden", { status: 403 });
    }) as unknown as typeof fetch;
    await expect(
      sendMail(baseOpts(fetchImpl), { to: "a@b.com", subject: "s", html: "h" }),
    ).rejects.toThrow(/Graph 403/);
  });
});
