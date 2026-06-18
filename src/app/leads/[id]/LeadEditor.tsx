"use client";

import { useState, useTransition } from "react";
import type { LeadDTO } from "@/lib/serialize";
import {
  LEAD_STATUSES,
  PRIORITIES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type LeadStatus,
  type Priority,
} from "@/lib/status";
import {
  changeStage,
  updateLead,
  logEmailedOn,
  addNote,
  createTask,
} from "@/app/actions";

export default function LeadEditor({ lead }: { lead: LeadDTO }) {
  const [, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [emailDate, setEmailDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn());

  return (
    <div className="panel">
      <div className="column-head">
        <span className="name">Edit lead</span>
      </div>
      <div
        style={{
          padding: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <label>
          <div className="subtle">Status</div>
          <select
            defaultValue={lead.status}
            onChange={(e) =>
              run(() => changeStage(lead.id, e.target.value as LeadStatus))
            }
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="subtle">Priority</div>
          <select
            defaultValue={lead.priority}
            onChange={(e) =>
              run(() =>
                updateLead(lead.id, { priority: e.target.value as Priority }),
              )
            }
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="subtle">Deal value ($)</div>
          <input
            type="number"
            min="0"
            step="1"
            defaultValue={lead.dealValue ?? ""}
            onBlur={(e) =>
              run(() =>
                updateLead(lead.id, {
                  dealValue: e.target.value === "" ? null : Number(e.target.value),
                }),
              )
            }
          />
        </label>
        <label>
          <div className="subtle">Next follow-up</div>
          <input
            type="date"
            defaultValue={lead.nextFollowup ?? ""}
            onChange={(e) =>
              run(() =>
                updateLead(lead.id, { nextFollowup: e.target.value || null }),
              )
            }
          />
        </label>
        <label>
          <div className="subtle">Last contacted</div>
          <input
            type="date"
            defaultValue={lead.lastContacted ?? ""}
            onChange={(e) =>
              run(() =>
                updateLead(lead.id, { lastContacted: e.target.value || null }),
              )
            }
          />
        </label>
        <label>
          <div className="subtle">Name</div>
          <input
            defaultValue={lead.name ?? ""}
            onBlur={(e) =>
              run(() => updateLead(lead.id, { name: e.target.value || null }))
            }
          />
        </label>
      </div>

      <div style={{ padding: "0 14px 14px" }}>
        <label>
          <div className="subtle">Notes</div>
          <textarea
            defaultValue={lead.notes ?? ""}
            rows={2}
            style={{ width: "100%" }}
            onBlur={(e) =>
              run(() => updateLead(lead.id, { notes: e.target.value || null }))
            }
          />
        </label>
      </div>

      <div className="column-head">
        <span className="name">Quick log</span>
      </div>
      <div
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="toolbar" style={{ margin: 0 }}>
          <input
            type="date"
            value={emailDate}
            onChange={(e) => setEmailDate(e.target.value)}
          />
          <button
            className="btn ghost"
            onClick={() => run(() => logEmailedOn(lead.id, emailDate))}
          >
            Emailed on this date
          </button>
        </div>

        <div className="toolbar" style={{ margin: 0 }}>
          <input
            type="text"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn"
            disabled={!note.trim()}
            onClick={() =>
              run(async () => {
                await addNote(lead.id, note);
                setNote("");
              })
            }
          >
            Add note
          </button>
        </div>

        <div className="toolbar" style={{ margin: 0 }}>
          <input
            type="text"
            placeholder="New task…"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="date"
            value={taskDue}
            onChange={(e) => setTaskDue(e.target.value)}
          />
          <button
            className="btn"
            disabled={!taskTitle.trim()}
            onClick={() =>
              run(async () => {
                await createTask(lead.id, taskTitle, taskDue || null);
                setTaskTitle("");
                setTaskDue("");
              })
            }
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
