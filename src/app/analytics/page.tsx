import { prisma } from "@/lib/prisma";
import { toNumber, formatMoney } from "@/lib/money";
import {
  computeCampaignMetrics,
  totalsFrom,
  type AnalyticsLead,
} from "@/lib/analytics";
import type { LeadStatus } from "@/lib/status";
import SpendEditor from "./SpendEditor";

export const dynamic = "force-dynamic";

function fmt(n: number | null, kind: "money" | "x"): string {
  if (n == null) return "—";
  return kind === "money" ? formatMoney(n) : `${n.toFixed(2)}×`;
}

export default async function AnalyticsPage() {
  const [leads, spendRows] = await Promise.all([
    prisma.lead.findMany({
      select: { campaign: true, status: true, dealValue: true },
    }),
    prisma.campaignSpend.findMany(),
  ]);

  const aLeads: AnalyticsLead[] = leads.map((l) => ({
    campaign: l.campaign,
    status: l.status as LeadStatus,
    dealValue: l.dealValue == null ? null : toNumber(l.dealValue),
  }));

  const spendByCampaign: Record<string, number> = {};
  for (const s of spendRows) spendByCampaign[s.campaign] = toNumber(s.spend);

  const rows = computeCampaignMetrics(aLeads, spendByCampaign);
  const totals = totalsFrom(rows);

  return (
    <>
      <div className="page-head">
        <h1>Analytics</h1>
        <span className="subtle">
          CPL / CAC / ROAS — enter ad spend per campaign
        </span>
      </div>

      <div className="kpi-grid">
        <Kpi label="Revenue" value={formatMoney(totals.revenue)} hint={`${totals.customers} customers`} />
        <Kpi label="Ad spend" value={formatMoney(totals.spend)} hint={`${totals.leads} leads`} />
        <Kpi label="CPL" value={fmt(totals.cpl, "money")} hint="spend ÷ leads" />
        <Kpi label="CAC" value={fmt(totals.cac, "money")} hint="spend ÷ customers" />
        <Kpi label="ROAS" value={fmt(totals.roas, "x")} hint="revenue ÷ spend" />
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Leads</th>
              <th>Customers</th>
              <th>Revenue</th>
              <th>Spend</th>
              <th>CPL</th>
              <th>CAC</th>
              <th>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.campaign}>
                <td>{r.campaign}</td>
                <td>{r.leads}</td>
                <td>{r.customers}</td>
                <td>{formatMoney(r.revenue)}</td>
                <td>
                  <SpendEditor campaign={r.campaign} spend={r.spend} />
                </td>
                <td>{fmt(r.cpl, "money")}</td>
                <td>{fmt(r.cac, "money")}</td>
                <td>{fmt(r.roas, "x")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}
