import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyMetaSignature,
  verifyChallenge,
  parseLeadgenPayload,
  mapGraphLeadToRaw,
  processLeadgenPayload,
  type GraphLead,
} from "@/lib/meta";
import type { IngestDb } from "@/lib/ingest";
import type { NormalizedLead } from "@/lib/normalize";

const APP_SECRET = "test-app-secret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(body).digest("hex");
}

// Mock IngestDb that remembers which lead ids exist, counting writes.
function mockDb() {
  const leads = new Set<string>();
  const calls = { leadCreate: 0, taskCreate: 0, activityCreate: 0 };
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
        calls.activityCreate++;
        return {};
      },
    },
  };
  return { db, calls };
}

const SAMPLE_GRAPH_LEAD: GraphLead = {
  id: "999000111",
  created_time: "2026-06-18T10:00:00+0000",
  field_data: [
    { name: "full_name", values: ["Jane Pastor"] },
    { name: "email", values: ["jane@example.org"] },
    { name: "phone_number", values: ["+15551234567"] },
  ],
  campaign_name: "Seat At The Table",
  adset_name: "Carousel",
  ad_name: "New Leads Ad",
  form_id: "form-1",
  platform: "ig",
};

const SAMPLE_PAYLOAD = {
  object: "page",
  entry: [
    {
      id: "page-1",
      time: 1,
      changes: [
        {
          field: "leadgen",
          value: {
            leadgen_id: "999000111",
            form_id: "form-1",
            page_id: "page-1",
            created_time: 1,
          },
        },
      ],
    },
  ],
};

describe("Meta signature verification", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify(SAMPLE_PAYLOAD);
    expect(verifyMetaSignature(body, sign(body), APP_SECRET)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const body = JSON.stringify(SAMPLE_PAYLOAD);
    expect(verifyMetaSignature(body, "sha256=deadbeef", APP_SECRET)).toBe(false);
    expect(verifyMetaSignature(body, sign(body + "x"), APP_SECRET)).toBe(false);
    expect(verifyMetaSignature(body, null, APP_SECRET)).toBe(false);
  });
});

describe("Meta GET handshake", () => {
  it("echoes the challenge when the token matches", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "tok",
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params, "tok")).toEqual({ ok: true, challenge: "12345" });
  });

  it("rejects a wrong token", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "nope",
      "hub.challenge": "12345",
    });
    expect(verifyChallenge(params, "tok")).toEqual({ ok: false });
  });
});

describe("payload parsing + mapping", () => {
  it("extracts leadgen entries", () => {
    const entries = parseLeadgenPayload(SAMPLE_PAYLOAD);
    expect(entries).toHaveLength(1);
    expect(entries[0].leadgenId).toBe("999000111");
    expect(entries[0].formId).toBe("form-1");
  });

  it("maps Graph fields into the export shape with an l: id", () => {
    const raw = mapGraphLeadToRaw(SAMPLE_GRAPH_LEAD);
    expect(raw.id).toBe("l:999000111");
    expect(raw.name).toBe("Jane Pastor");
    expect(raw.email).toBe("jane@example.org");
    expect(raw.phone).toBe("+15551234567");
    expect(raw.campaign).toBe("Seat At The Table");
  });
});

describe("processLeadgenPayload", () => {
  it("upserts a lead, fires the follow-up task, and dedupes on re-send", async () => {
    const { db, calls } = mockDb();
    const fetchLead = async () => SAMPLE_GRAPH_LEAD;

    const first = await processLeadgenPayload(db, SAMPLE_PAYLOAD, { fetchLead });
    expect(first.results).toEqual([{ id: "l:999000111", created: true }]);
    expect(calls.leadCreate).toBe(1);
    expect(calls.taskCreate).toBe(1); // new-lead automation

    // Re-send of the same leadgen event: no duplicate, no new task.
    const second = await processLeadgenPayload(db, SAMPLE_PAYLOAD, { fetchLead });
    expect(second.results).toEqual([{ id: "l:999000111", created: false }]);
    expect(calls.leadCreate).toBe(1);
    expect(calls.taskCreate).toBe(1);
  });
});
