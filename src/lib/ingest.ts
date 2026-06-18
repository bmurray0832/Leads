// Shared lead-ingest logic for the interim Zapier feed (Phase 1) and, later,
// the Meta leadgen webhook (Phase 2). Upserts by id (dedupe) and, on a brand
// new lead, fires the new-lead automation: a follow-up Task.

import { prisma } from "./prisma";
import { normalizeRawLead, type RawLead } from "./normalize";

export interface IngestResult {
  id: string;
  created: boolean;
}

// Days out for the auto-created follow-up task on a new lead.
const FOLLOWUP_DAYS = 1;

export async function ingestRawLead(raw: RawLead): Promise<IngestResult> {
  const id =
    raw.id && raw.id.trim()
      ? raw.id.trim()
      : `zap:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const data = normalizeRawLead({ ...raw, id });

  const existing = await prisma.lead.findUnique({
    where: { id },
    select: { id: true },
  });

  if (existing) {
    // Re-send of a known lead: no duplicate, no new automation.
    return { id, created: false };
  }

  await prisma.lead.create({ data });

  // New-lead automation: follow-up task + a timeline note.
  const due = new Date();
  due.setDate(due.getDate() + FOLLOWUP_DAYS);
  await prisma.task.create({
    data: {
      leadId: id,
      title: `Follow up with ${data.name ?? "new lead"}`,
      dueDate: due,
    },
  });
  await prisma.activity.create({
    data: {
      leadId: id,
      type: "NOTE",
      body: `New lead captured via ${data.source ?? "inbound feed"}.`,
    },
  });

  return { id, created: true };
}
