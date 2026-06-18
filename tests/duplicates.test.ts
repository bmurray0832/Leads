import { describe, it, expect } from "vitest";
import { NORMALIZED } from "./data";
import { findDuplicateGroups } from "@/lib/duplicates";
import { emailKey, phoneKey } from "@/lib/normalize";

describe("duplicate detection on the seeded data", () => {
  const groups = findDuplicateGroups(
    NORMALIZED.map((n) => ({
      id: n.id,
      name: n.name,
      email: n.email,
      phone: n.phone,
    })),
  );

  it("finds the known shared-email and shared-phone groups", () => {
    const email = groups.filter((g) => g.kind === "email");
    const phone = groups.filter((g) => g.kind === "phone");
    expect(email.length).toBe(42);
    expect(phone.length).toBe(35);
  });

  it("every group has 2+ members that actually share the key", () => {
    for (const g of groups) {
      expect(g.leads.length).toBeGreaterThan(1);
      const key = g.kind === "email" ? emailKey : phoneKey;
      for (const l of g.leads) {
        expect(key((g.kind === "email" ? l.email : l.phone) ?? undefined)).toBe(
          g.key,
        );
      }
    }
  });
});
