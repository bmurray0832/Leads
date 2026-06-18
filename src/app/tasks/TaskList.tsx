"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toggleTask } from "@/app/actions";

export interface TaskView {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  leadId: string;
  leadName: string | null;
  company: string | null;
}

interface Section {
  title: string;
  tasks: TaskView[];
}

export default function TaskList({ sections }: { sections: Section[] }) {
  const [, startTransition] = useTransition();

  function toggle(id: string, done: boolean) {
    startTransition(() => {
      toggleTask(id, done);
    });
  }

  const anyTasks = sections.some((s) => s.tasks.length > 0);
  if (!anyTasks) {
    return <div className="panel empty">No tasks yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sections.map((s) =>
        s.tasks.length === 0 ? null : (
          <div key={s.title} className="panel">
            <div className="column-head">
              <span className="name">{s.title}</span>
            </div>
            <table>
              <tbody>
                {s.tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={(e) => toggle(t.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <span
                        style={{
                          textDecoration: t.done ? "line-through" : "none",
                          opacity: t.done ? 0.6 : 1,
                        }}
                      >
                        {t.title}
                      </span>
                    </td>
                    <td>
                      <Link href={`/leads/${encodeURIComponent(t.leadId)}`}>
                        {t.leadName ?? "(no name)"}
                      </Link>
                      {t.company ? (
                        <span className="subtle"> · {t.company}</span>
                      ) : null}
                    </td>
                    <td className="subtle">{t.dueDate ?? "no date"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
