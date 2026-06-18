import { prisma } from "@/lib/prisma";
import { funnelData, funnelRows, pct } from "@/lib/funnel";
import type { LeadStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const leads = await prisma.lead.findMany({
    select: { status: true, campaign: true },
  });
  const rows = leads.map((l) => ({
    status: l.status as LeadStatus,
    campaign: l.campaign,
  }));

  const overall = funnelData(rows);
  const kpis = funnelRows(overall);

  // Per-campaign breakdown.
  const campaigns = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.campaign || "(none)";
    const arr = campaigns.get(key) ?? [];
    arr.push(r);
    campaigns.set(key, arr);
  }
  const perCampaign = Array.from(campaigns.entries())
    .map(([name, rs]) => ({ name, f: funnelData(rs) }))
    .sort((a, b) => b.f.total - a.f.total);

  return (
    <>
      <div className="page-head">
        <h1>Funnel</h1>
        <span className="subtle">Recalculates live from lead statuses</span>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="panel kpi">
            <div className="label">{k.label}</div>
            <div className="value">{k.value}</div>
            <div className="hint">{k.hint}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Leads</th>
              <th>Quality</th>
              <th>Contact</th>
              <th>Meeting</th>
              <th>Show</th>
              <th>Close</th>
            </tr>
          </thead>
          <tbody>
            {perCampaign.map(({ name, f }) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{f.total}</td>
                <td>{pct(f.quality, f.total)}</td>
                <td>{pct(f.reached, f.total)}</td>
                <td>{pct(f.meetings, f.reached)}</td>
                <td>{pct(f.showed, f.resolvedMtg)}</td>
                <td>{pct(f.customers, f.showed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
