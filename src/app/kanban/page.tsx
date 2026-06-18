import { prisma } from "@/lib/prisma";
import { serializeLead } from "@/lib/serialize";
import KanbanBoard from "./KanbanBoard";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const leads = await prisma.lead.findMany({
    orderBy: [{ priority: "asc" }, { createdTime: "desc" }],
  });
  const dtos = leads.map(serializeLead);

  return (
    <>
      <div className="page-head">
        <h1>Kanban board</h1>
        <span className="subtle">Drag a card to change its stage</span>
      </div>
      <KanbanBoard leads={dtos} />
    </>
  );
}
