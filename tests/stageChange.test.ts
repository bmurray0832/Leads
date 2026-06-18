import { describe, it, expect } from "vitest";
import { applyStageChange, type StageChangeDb } from "@/lib/leadOps";
import type { LeadStatus } from "@/lib/status";

function mockDb(initial: LeadStatus) {
  const calls = {
    leadUpdate: 0,
    stageHistoryCreate: 0,
    activityCreate: 0,
  };
  let lastActivity: { type: string; body: string } | null = null;
  let lastHistory: { fromStage: LeadStatus | null; toStage: LeadStatus } | null =
    null;

  const db: StageChangeDb = {
    lead: {
      async findUnique() {
        return { status: initial };
      },
      async update() {
        calls.leadUpdate++;
        return {};
      },
    },
    stageHistory: {
      async create(args) {
        calls.stageHistoryCreate++;
        lastHistory = { fromStage: args.data.fromStage, toStage: args.data.toStage };
        return {};
      },
    },
    activity: {
      async create(args) {
        calls.activityCreate++;
        lastActivity = { type: args.data.type, body: args.data.body };
        return {};
      },
    },
  };
  return { db, calls, get lastActivity() { return lastActivity; }, get lastHistory() { return lastHistory; } };
}

describe("applyStageChange", () => {
  it("writes exactly one StageHistory and one Activity on a real move", async () => {
    const m = mockDb("NEW");
    const res = await applyStageChange(m.db, {
      leadId: "l:1",
      toStage: "CONTACTED",
      userId: "u1",
    });

    expect(res.changed).toBe(true);
    expect(m.calls.leadUpdate).toBe(1);
    expect(m.calls.stageHistoryCreate).toBe(1);
    expect(m.calls.activityCreate).toBe(1);
    expect(m.lastHistory).toEqual({ fromStage: "NEW", toStage: "CONTACTED" });
    expect(m.lastActivity?.type).toBe("STATUS_CHANGE");
    expect(m.lastActivity?.body).toBe("New → Contacted");
  });

  it("is a no-op when the stage is unchanged", async () => {
    const m = mockDb("CONTACTED");
    const res = await applyStageChange(m.db, {
      leadId: "l:1",
      toStage: "CONTACTED",
    });

    expect(res.changed).toBe(false);
    expect(m.calls.leadUpdate).toBe(0);
    expect(m.calls.stageHistoryCreate).toBe(0);
    expect(m.calls.activityCreate).toBe(0);
  });
});
