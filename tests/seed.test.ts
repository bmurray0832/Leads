import { describe, it, expect } from "vitest";
import { RAW_ROWS, NORMALIZED } from "./data";
import { LEAD_STATUSES } from "@/lib/status";

describe("seed dataset", () => {
  it("contains exactly 695 leads", () => {
    expect(RAW_ROWS.length).toBe(695);
  });

  it("every normalized lead has a unique, non-empty id (dedupe key)", () => {
    // The raw export has one blank id; normalize synthesizes a stable
    // `legacy:` key so every dedupe key is valid and unique.
    const ids = new Set(NORMALIZED.map((n) => n.id));
    expect(ids.size).toBe(695);
    expect([...ids].every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
    expect(NORMALIZED.some((n) => n.id.startsWith("legacy:"))).toBe(true);
  });

  it("normalizes every status to a valid enum value", () => {
    for (const n of NORMALIZED) {
      expect(LEAD_STATUSES).toContain(n.status);
    }
  });

  it("strips the Meta 'p:' prefix off phones", () => {
    const withPhone = NORMALIZED.find((n) => n.phone);
    expect(withPhone?.phone?.startsWith("p:")).toBe(false);
  });
});
