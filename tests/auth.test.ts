import { describe, it, expect } from "vitest";
import { gateDecision } from "@/lib/gate";

describe("auth gate", () => {
  it("blocks an unauthenticated visit", () => {
    expect(gateDecision({ authDisabled: false, hasSession: false })).toBe(
      "login",
    );
  });

  it("allows an authenticated visit", () => {
    expect(gateDecision({ authDisabled: false, hasSession: true })).toBe(
      "allow",
    );
  });

  it("bypasses the gate only when explicitly disabled (local dev)", () => {
    expect(gateDecision({ authDisabled: true, hasSession: false })).toBe(
      "allow",
    );
  });
});
