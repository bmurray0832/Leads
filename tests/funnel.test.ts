import { describe, it, expect } from "vitest";
import { NORMALIZED } from "./data";
import { funnelData, pct } from "@/lib/funnel";

describe("funnel on the seeded 695 leads", () => {
  const f = funnelData(NORMALIZED);

  it("matches known totals", () => {
    expect(f.total).toBe(695);
    expect(f.quality).toBe(690);
    expect(f.reached).toBe(21);
    expect(f.meetings).toBe(12);
    expect(f.resolvedMtg).toBe(3);
    expect(f.showed).toBe(1);
    expect(f.customers).toBe(1);
  });

  it("computes the displayed rates", () => {
    expect(pct(f.quality, f.total)).toBe("99.3%");
    expect(pct(f.reached, f.total)).toBe("3%");
    expect(pct(f.customers, f.showed)).toBe("100%");
    expect(pct(0, 0)).toBe("—");
  });
});
