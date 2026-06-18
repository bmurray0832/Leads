// Shared lead-ingest logic for the interim Zapier feed (Phase 1) and the Meta
// leadgen webhook (Phase 2). Upserts by id (dedupe) and, on a brand new lead,
// fires the new-lead automation: a follow-up Task + a timeline note.
//
// Decoupled from PrismaClient (takes an IngestDb) so the dedupe + automation
// behaviour is unit-testable with a lightweight mock.

import { normalizeRawLead, type RawLead } from "./normalize";

export interface IngestDb {
  lead: {
    findUnique(args: {
      where: { id: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: { data: ReturnType<typeof normalizeRawLead> }): Promise<unknown>;
  };
  task: {
    create(args: {
      data: { leadId: string; title: string; dueDate: Date | null };
    }): Promise<unknown>;
  };
  activity: {
    create(args: {
      data: { leadId: string; type: "NOTE"; body: string };
    }): Promise<unknown>;
  };
}

export interface IngestResult {
  id: string;
  created: boolean;
}

// Days out for the auto-created follow-up task on a new lead.
const FOLLOWUP_DAYS = 1;

export async function ingestRawLead(
  db: IngestDb,
  raw: RawLead,
): Promise<IngestResult> {
  const id =
    raw.id && raw.id.trim()
      ? raw.id.trim()
      : `zap:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const data = normalizeRawLead({ ...raw, id });

  const existing = await db.lead.findUnique({
    where: { id: data.id },
    select: { id: true },
  });

  if (existing) {
    // Re-send of a known lead: no duplicate, no new automation.
    return { id: data.id, created: false };
  }

  await db.lead.create({ data });

  // New-lead automation: follow-up task + a timeline note.
  const due = new Date();
  due.setDate(due.getDate() + FOLLOWUP_DAYS);
  await db.task.create({
    data: {
      leadId: data.id,
      title: `Follow up with ${data.name ?? "new lead"}`,
      dueDate: due,
    },
  });
  await db.activity.create({
    data: {
      leadId: data.id,
      type: "NOTE",
      body: `New lead captured via ${data.source ?? "inbound feed"}.`,
    },
  });

  return { id: data.id, created: true };
}
