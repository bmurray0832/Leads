import { prisma } from "@/lib/prisma";
import TaskList, { type TaskView } from "./TaskList";

export const dynamic = "force-dynamic";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ done: "asc" }, { dueDate: "asc" }],
    include: { lead: { select: { id: true, name: true, company: true } } },
  });

  const today = todayStr();
  const views: TaskView[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    leadId: t.lead.id,
    leadName: t.lead.name,
    company: t.lead.company,
  }));

  const open = views.filter((t) => !t.done);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = open.filter((t) => t.dueDate === today);
  const upcoming = open.filter((t) => !t.dueDate || t.dueDate > today);
  const done = views.filter((t) => t.done);

  return (
    <>
      <div className="page-head">
        <h1>Tasks &amp; follow-ups</h1>
        <span className="subtle">{open.length} open</span>
      </div>
      <TaskList
        sections={[
          { title: `Overdue (${overdue.length})`, tasks: overdue },
          { title: `Due today (${dueToday.length})`, tasks: dueToday },
          { title: `Upcoming (${upcoming.length})`, tasks: upcoming },
          { title: `Completed (${done.length})`, tasks: done },
        ]}
      />
    </>
  );
}
