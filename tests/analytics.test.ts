import { describe, it, expect } from "vitest";
import {
  computeCampaignMetrics,
  totalsFrom,
  pipelineValueByStage,
  type AnalyticsLead,
} from "@/lib/analytics";

const leads: AnalyticsLead[] = [
  { campaign: "Alpha", status: "NEW" },
  { campaign: "Alpha", status: "CONTACTED" },
  { campaign: "Alpha", status: "CUSTOMER", dealValue: 1000 },
  { campaign: "Alpha", status: "CUSTOMER", dealValue: 500 },
  { campaign: "Beta", status: "NEW" },
  { campaign: "Beta", status: "CUSTOMER", dealValue: 2000 },
];

const spend = { Alpha: 600, Beta: 1000 };

describe("computeCampaignMetrics", () => {
  const rows = computeCampaignMetrics(leads, spend);
  const alpha = rows.find((r) => r.campaign === "Alpha")!;
  const beta = rows.find((r) => r.campaign === "Beta")!;

  it("computes CPL, CAC, revenue and ROAS per campaign", () => {
    // Alpha: 4 leads, 2 customers, revenue 1500, spend 600
    expect(alpha.leads).toBe(4);
    expect(alpha.customers).toBe(2);
    expect(alpha.revenue).toBe(1500);
    expect(alpha.cpl).toBe(150); // 600 / 4
    expect(alpha.cac).toBe(300); // 600 / 2
    expect(alpha.roas).toBe(2.5); // 1500 / 600

    // Beta: 2 leads, 1 customer, revenue 2000, spend 1000
    expect(beta.cpl).toBe(500);
    expect(beta.cac).toBe(1000);
    expect(beta.roas).toBe(2);
  });

  it("returns null rates when denominators are zero", () => {
    const rows2 = computeCampaignMetrics(
      [{ campaign: "Gamma", status: "NEW" }],
      { Gamma: 0 },
    );
    const g = rows2[0];
    expect(g.cpl).toBe(0); // spend 0 / leads 1 = 0
    expect(g.cac).toBeNull(); // no customers
    expect(g.roas).toBeNull(); // spend 0
  });

  it("includes campaigns that have spend but no leads", () => {
    const rows3 = computeCampaignMetrics([], { Ghost: 100 });
    expect(rows3[0]).toMatchObject({
      campaign: "Ghost",
      leads: 0,
      cpl: null,
      cac: null,
    });
  });
});

describe("totalsFrom", () => {
  it("aggregates across campaigns", () => {
    const t = totalsFrom(computeCampaignMetrics(leads, spend));
    expect(t.leads).toBe(6);
    expect(t.customers).toBe(3);
    expect(t.revenue).toBe(3500);
    expect(t.spend).toBe(1600);
    expect(t.roas).toBeCloseTo(3500 / 1600, 5);
  });
});

describe("pipelineValueByStage", () => {
  it("sums deal value per stage", () => {
    const v = pipelineValueByStage(leads);
    expect(v.CUSTOMER).toBe(3500);
    expect(v.NEW).toBe(0);
  });
});
