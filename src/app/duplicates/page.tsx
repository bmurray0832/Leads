import { prisma } from "@/lib/prisma";
import { findDuplicateGroups } from "@/lib/duplicates";
import DuplicateGroups from "./DuplicateGroups";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdTime: true,
    },
    orderBy: { createdTime: "asc" },
  });

  const groups = findDuplicateGroups(leads).map((g) => ({
    kind: g.kind,
    key: g.key,
    leads: g.leads.map((l) => ({
      id: l.id,
      name: l.name ?? null,
      email: l.email ?? null,
      phone: l.phone ?? null,
      status: String(l.status),
      createdTime: l.createdTime ? l.createdTime.toISOString() : null,
    })),
  }));

  return (
    <>
      <div className="page-head">
        <h1>Duplicates</h1>
        <span className="subtle">
          {groups.length} groups sharing an email or phone
        </span>
      </div>
      <DuplicateGroups groups={groups} />
    </>
  );
}
