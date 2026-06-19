import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeLead } from "@/lib/serialize";
import { STATUS_LABEL, type LeadStatus } from "@/lib/status";
import { outlookConfigured } from "@/lib/outlookSync";
import LeadEditor from "./LeadEditor";

export const dynamic = "force-dynamic";

const ACTIVITY_LABEL: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL_SENT: "Email sent",
  EMAIL_RECEIVED: "Email received",
  STATUS_CHANGE: "Stage change",
  MEETING: "Meeting",
  TASK: "Task",
  PAYMENT: "Payment",
};

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id);
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { occurredAt: "desc" } },
      tasks: { orderBy: [{ done: "asc" }, { dueDate: "asc" }] },
    },
  });
  if (!lead) notFound();

  const dto = serializeLead(lead);

  return (
    <>
      <div className="page-head">
        <h1>{dto.name ?? "(no name)"}</h1>
        <span className="subtle">
          {STATUS_LABEL[dto.status]} ·{" "}
          {dto.campaign ?? "no campaign"}
        </span>
      </div>

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LeadEditor lead={dto} outlookEnabled={outlookConfigured()} />

          <div className="panel">
            <div className="column-head">
              <span className="name">Timeline</span>
            </div>
            <div style={{ padding: "4px 14px 12px" }}>
              {lead.activities.length === 0 ? (
                <div className="empty">No activity yet.</div>
              ) : (
                <ul className="timeline">
                  {lead.activities.map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{ACTIVITY_LABEL[a.type] ?? a.type}</strong>
                        {a.body ? ` — ${a.body}` : ""}
                      </div>
                      <div className="when">
                        {a.occurredAt.toISOString().replace("T", " ").slice(0, 16)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="column-head">
            <span className="name">Details</span>
          </div>
          <div style={{ padding: "4px 14px 14px" }}>
            <Field k="Email" v={dto.email} />
            <Field k="Phone" v={dto.phone} />
            <Field k="Company" v={dto.company} />
            <Field k="Title" v={dto.jobTitle} />
            <Field k="Platform" v={dto.platform} />
            <Field k="Campaign" v={dto.campaign} />
            <Field k="Ad set" v={dto.adset} />
            <Field k="Ad" v={dto.ad} />
            <Field k="Form" v={dto.form} />
            <Field k="Source" v={dto.source} />
            <Field
              k="Created"
              v={dto.createdTime ? dto.createdTime.slice(0, 10) : null}
            />
            <Field k="Emailed on" v={dto.emailedOn} />
            {dto.inboxUrl ? (
              <div className="field-row">
                <span className="k">Inbox</span>
                <a href={dto.inboxUrl} target="_blank" rel="noreferrer">
                  open
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="field-row">
      <span className="k">{k}</span>
      <span>{v ?? "—"}</span>
    </div>
  );
}
