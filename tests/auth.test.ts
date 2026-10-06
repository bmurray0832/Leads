import { describe, it, expect } from "vitest";
import { allowlistFromEnv, gateDecision, isAllowedUser } from "@/lib/gate";

describe("auth gate", () => {
  it("sends an unauthenticated visit to login", () => {
    expect(
      gateDecision({ authDisabled: false, hasSession: false, allowed: false }),
    ).toBe("login");
  });

  it("allows an authenticated, allowlisted visit", () => {
    expect(
      gateDecision({ authDisabled: false, hasSession: true, allowed: true }),
    ).toBe("allow");
  });

  it("forbids an authenticated visit that isn't allowlisted", () => {
    expect(
      gateDecision({ authDisabled: false, hasSession: true, allowed: false }),
    ).toBe("forbidden");
  });

  it("bypasses the gate only when explicitly disabled (local dev)", () => {
    expect(
      gateDecision({ authDisabled: true, hasSession: false, allowed: false }),
    ).toBe("allow");
  });
});

describe("allowlist", () => {
  const list = allowlistFromEnv({
    ALLOWED_AUTH0_SUBS: "auth0|abc123, google-oauth2|999",
    ALLOWED_EMAILS: " Braden@HolyInsights.org ",
  });

  it("parses comma-separated env lists, lowercasing only emails", () => {
    expect(list.subs).toEqual(["auth0|abc123", "google-oauth2|999"]);
    expect(list.emails).toEqual(["braden@holyinsights.org"]);
  });

  it("admits an allowlisted sub regardless of email", () => {
    expect(isAllowedUser({ sub: "auth0|abc123" }, list)).toBe(true);
  });

  it("treats subs as case-sensitive", () => {
    expect(isAllowedUser({ sub: "AUTH0|ABC123" }, list)).toBe(false);
  });

  it("admits an allowlisted email only when it is verified", () => {
    const email = "braden@holyinsights.org";
    expect(isAllowedUser({ sub: "auth0|x", email, email_verified: true }, list)).toBe(
      true,
    );
    expect(isAllowedUser({ sub: "auth0|x", email, email_verified: false }, list)).toBe(
      false,
    );
    expect(isAllowedUser({ sub: "auth0|x", email }, list)).toBe(false);
  });

  it("matches emails case-insensitively", () => {
    expect(
      isAllowedUser(
        { sub: "auth0|x", email: "BRADEN@holyinsights.org", email_verified: true },
        list,
      ),
    ).toBe(true);
  });

  it("rejects other Holy Insights users sharing the tenant", () => {
    expect(
      isAllowedUser(
        { sub: "auth0|pastor", email: "pastor@church.org", email_verified: true },
        list,
      ),
    ).toBe(false);
  });

  it("fails closed when no allowlist is configured", () => {
    const empty = allowlistFromEnv({});
    expect(
      isAllowedUser(
        { sub: "auth0|abc123", email: "braden@holyinsights.org", email_verified: true },
        empty,
      ),
    ).toBe(false);
  });
});
