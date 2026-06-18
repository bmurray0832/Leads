// Funnel KPIs — a faithful port of the funnelData() logic from the original
// Holy Insights Leads CRM HTML, so numbers match what the user already trusts.

import { LEAD_STATUSES, type LeadStatus } from "./status";

export interface FunnelInput {
  status: LeadStatus;
  campaign?: string | null;
}

export interface FunnelData {
  counts: Record<LeadStatus, number>;
  total: number;
  reached: number;
  meetings: number;
  resolvedMtg: number;
  showed: number;
  customers: number;
  quality: number;
}

export function funnelData(rows: FunnelInput[]): FunnelData {
  const counts = Object.fromEntries(
    LEAD_STATUSES.map((s) => [s, 0]),
  ) as Record<LeadStatus, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const total = rows.length;
  const reached =
    counts.CONTACTED +
    counts.MEETING_SCHEDULED +
    counts.MET +
    counts.CUSTOMER +
    counts.NO_SHOW +
    counts.LOST;
  const meetings =
    counts.MEETING_SCHEDULED + counts.MET + counts.NO_SHOW + counts.CUSTOMER;
  const resolvedMtg = counts.MET + counts.NO_SHOW + counts.CUSTOMER;
  const showed = counts.MET + counts.CUSTOMER;
  const customers = counts.CUSTOMER;
  const quality = total - counts.BAD_LEAD - counts.NOT_QUALIFIED;

  return { counts, total, reached, meetings, resolvedMtg, showed, customers, quality };
}

// Percentage with one decimal; "—" when the denominator is zero.
export function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "—";
}

export interface FunnelRow {
  label: string;
  value: string;
  hint: string;
}

export function funnelRows(f: FunnelData): FunnelRow[] {
  return [
    { label: "Total leads", value: String(f.total), hint: "" },
    { label: "Lead quality", value: pct(f.quality, f.total), hint: `${f.quality} usable` },
    { label: "Contact rate", value: pct(f.reached, f.total), hint: `${f.reached} reached` },
    { label: "Meeting rate", value: pct(f.meetings, f.reached), hint: `${f.meetings} booked` },
    { label: "Show rate", value: pct(f.showed, f.resolvedMtg), hint: `${f.showed} showed` },
    { label: "Close rate", value: pct(f.customers, f.showed), hint: `${f.customers} customers` },
  ];
}
