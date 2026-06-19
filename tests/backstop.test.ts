import { describe, it, expect } from "vitest";
import { processFormBackstop, type GraphLead } from "@/lib/meta";
import type { IngestDb } from "@/lib/ingest";
import type { NormalizedLead } from "@/lib/normalize";

function mockDb() {
  const leads = new Set<string>();
  const calls = { leadCreate: 0, taskCreate: 0 };
  const db: IngestDb = {
    lead: {
      async findUnique({ where }) {
        return leads.has(where.id) ? { id: where.id } : null;
      },
      async create({ data }: { data: NormalizedLead }) {
        leads.add(data.id);
        calls.leadCreate++;
        return {};
      },
    },
    task: {
      async create() {
        calls.taskCreate++;
        return {};
      },
    },
    activity: {
      async create() {
        return {};
      },
    },
  };
  return { db, calls };
}

const page: GraphLead[] = [
  {
    id: "111",
    created_time: "2026-06-18T10:00:00+0000",
    field_data: [
      { name: "full_name", values: ["A One"] },
      { name: "email", values: ["a@x.com"] },
    ],
  },
  {
    id: "222",
    created_time: "2026-06-18T11:00:00+0000",
    field_data: [
      { name: "full_name", values: ["B Two"] },
      { name: "email", values: ["b@x.com"] },
    ],
  },
];

describe("processFormBackstop", () => {
  it("ingests recent form leads and dedupes on a second run", async () => {
    const { db, calls } = mockDb();
    const fetchFormLeads = async () => page;

    const first = await processFormBackstop(db, ["form-1"], { fetchFormLeads });
    expect(first.results.map((r) => r.created)).toEqual([true, true]);
    expect(calls.leadCreate).toBe(2);
    expect(calls.taskCreate).toBe(2);

    const second = await processFormBackstop(db, ["form-1"], { fetchFormLeads });
    expect(second.results.map((r) => r.created)).toEqual([false, false]);
    expect(calls.leadCreate).toBe(2); // no new creates
  });

  it("collects per-form errors without stopping", async () => {
    const { db } = mockDb();
    const fetchFormLeads = async (formId: string) => {
      if (formId === "bad") throw new Error("boom");
      return page;
    };
    const res = await processFormBackstop(db, ["bad", "form-1"], {
      fetchFormLeads,
    });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toContain("bad: boom");
    expect(res.results).toHaveLength(2);
  });
});
