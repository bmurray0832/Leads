// Shared test fixture: the real 695-lead export, normalized through the same
// code path the seed uses.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeRawLead, type RawLead } from "@/lib/normalize";

export const RAW_ROWS = JSON.parse(
  readFileSync(join(process.cwd(), "data", "leads.json"), "utf8"),
) as RawLead[];

export const NORMALIZED = RAW_ROWS.map(normalizeRawLead);
