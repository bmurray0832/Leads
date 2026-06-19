// Phase 4 analytics: CPL, CAC, revenue, ROAS per campaign, plus pipeline value
// by stage. Pure functions over plain inputs so they are unit-testable.

import { LEAD_STATUSES, type LeadStatus } from "./status";

export interface AnalyticsLead {
  campaign?: string | null;
  status: LeadStatus;
  dealValue?: number | null;
}

export interface CampaignMetrics {
  campaign: string;
  leads: number;
  customers: number;
  revenue: number;
  spend: number;
  cpl: number | null; // spend / leads
  cac: number | null; // spend / customers
  roas: number | null; // revenue / spend
}

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export function computeCampaignMetrics(
  leads: AnalyticsLead[],
  spendByCampaign: Record<string, number>,
): CampaignMetrics[] {
  const groups = new Map<string, AnalyticsLead[]>();
  for (const l of leads) {
    const key = l.campaign || "(none)";
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }
  // Include campaigns that have spend but no leads yet.
  for (const key of Object.keys(spendByCampaign)) {
    if (!groups.has(key)) groups.set(key, []);
  }

  const rows: CampaignMetrics[] = [];
  for (const [campaign, rs] of groups) {
    const customers = rs.filter((r) => r.status === "CUSTOMER");
    const revenue = customers.reduce((s, r) => s + (r.dealValue ?? 0), 0);
    const spend = spendByCampaign[campaign] ?? 0;
    rows.push({
      campaign,
      leads: rs.length,
      customers: customers.length,
      revenue,
      spend,
      cpl: div(spend, rs.length),
      cac: div(spend, customers.length),
      roas: div(revenue, spend),
    });
  }
  rows.sort((a, b) => b.leads - a.leads);
  return rows;
}

export interface Totals {
  leads: number;
  customers: number;
  revenue: number;
  spend: number;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
}

export function totalsFrom(rows: CampaignMetrics[]): Totals {
  const leads = rows.reduce((s, r) => s + r.leads, 0);
  const customers = rows.reduce((s, r) => s + r.customers, 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  return {
    leads,
    customers,
    revenue,
    spend,
    cpl: div(spend, leads),
    cac: div(spend, customers),
    roas: div(revenue, spend),
  };
}

// Pipeline value by stage (sum of deal values), for the Kanban headers / KPIs.
export function pipelineValueByStage(
  leads: AnalyticsLead[],
): Record<LeadStatus, number> {
  const out = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
    LeadStatus,
    number
  >;
  for (const l of leads) out[l.status] += l.dealValue ?? 0;
  return out;
}
