import { prisma } from "@/lib/prisma";
import { serializeLead } from "@/lib/serialize";
import ContactsTable from "./ContactsTable";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: [{ createdTime: "desc" }, { createdAt: "desc" }],
  });
  const dtos = leads.map(serializeLead);

  return (
    <>
      <div className="page-head">
        <h1>Contacts</h1>
        <span className="subtle">{dtos.length} leads</span>
      </div>
      <ContactsTable leads={dtos} />
    </>
  );
}
