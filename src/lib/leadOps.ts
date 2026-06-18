// Core write operations, decoupled from PrismaClient so they can be unit
// tested with a lightweight mock. The server actions pass the real `prisma`.

import { STATUS_LABEL, type LeadStatus } from "./status";

// Minimal slice of the Prisma client these operations touch.
export interface StageChangeDb {
  lead: {
    findUnique(args: {
      where: { id: string };
      select: { status: true };
    }): Promise<{ status: LeadStatus } | null>;
    update(args: {
      where: { id: string };
      data: { status: LeadStatus };
    }): Promise<unknown>;
  };
  stageHistory: {
    create(args: {
      data: { leadId: string; fromStage: LeadStatus | null; toStage: LeadStatus };
    }): Promise<unknown>;
  };
  activity: {
    create(args: {
      data: {
        leadId: string;
        userId: string | null;
        type: "STATUS_CHANGE";
        body: string;
      };
    }): Promise<unknown>;
  };
}

export interface StageChangeParams {
  leadId: string;
  toStage: LeadStatus;
  userId?: string | null;
}

export interface StageChangeResult {
  from: LeadStatus;
  to: LeadStatus;
  changed: boolean;
}

// Moves a lead to a new stage. On an actual change, writes exactly one
// StageHistory row and one STATUS_CHANGE Activity row.
export async function applyStageChange(
  db: StageChangeDb,
  params: StageChangeParams,
): Promise<StageChangeResult> {
  const { leadId, toStage } = params;
  const userId = params.userId ?? null;

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { status: true },
  });
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const from = lead.status;
  if (from === toStage) {
    return { from, to: toStage, changed: false };
  }

  await db.lead.update({ where: { id: leadId }, data: { status: toStage } });
  await db.stageHistory.create({
    data: { leadId, fromStage: from, toStage },
  });
  await db.activity.create({
    data: {
      leadId,
      userId,
      type: "STATUS_CHANGE",
      body: `${STATUS_LABEL[from]} → ${STATUS_LABEL[toStage]}`,
    },
  });

  return { from, to: toStage, changed: true };
}
