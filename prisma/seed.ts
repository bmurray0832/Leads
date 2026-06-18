// Seeds the existing leads from data/leads.json (the export the current HTML
// "Save" produces). Upserts by id so re-runs never clobber edits.
//
//   npm run seed   (alias for: tsx prisma/seed.ts)
//
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import { normalizeRawLead, type RawLead } from "../src/lib/normalize";

const db = new PrismaClient();

async function main() {
  const file = join(process.cwd(), "data", "leads.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as RawLead[];

  let created = 0;
  for (const raw of rows) {
    const data = normalizeRawLead(raw);
    const res = await db.lead.upsert({
      where: { id: data.id },
      update: {}, // don't clobber edits on re-run
      create: data,
    });
    if (res) created++;
  }
  console.log(`Seeded ${created} leads (source rows: ${rows.length})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
