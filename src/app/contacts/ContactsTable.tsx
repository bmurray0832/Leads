"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { LeadDTO } from "@/lib/serialize";
import {
  LEAD_STATUSES,
  PRIORITIES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type LeadStatus,
  type Priority,
} from "@/lib/status";
import { changeStage, updateLead } from "@/app/actions";

export default function ContactsTable({ leads }: { leads: LeadDTO[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.name, l.email, l.phone, l.company, l.campaign]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [leads, query, statusFilter]);

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, email, phone, company, campaign…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="subtle">
          {filtered.length} of {leads.length}
        </span>
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Campaign</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Next follow-up</th>
              <th>Last contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/leads/${encodeURIComponent(l.id)}`}>
                    {l.name ?? "(no name)"}
                  </Link>
                  {l.jobTitle ? (
                    <div className="subtle">{l.jobTitle}</div>
                  ) : null}
                </td>
                <td>{l.company ?? "—"}</td>
                <td>{l.email ?? "—"}</td>
                <td>{l.phone ?? "—"}</td>
                <td>{l.campaign ?? "—"}</td>
                <td>
                  <select
                    defaultValue={l.status}
                    onChange={(e) =>
                      startTransition(() =>
                        changeStage(l.id, e.target.value as LeadStatus).then(
                          () => undefined,
                        ),
                      )
                    }
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    defaultValue={l.priority}
                    onChange={(e) =>
                      startTransition(() =>
                        updateLead(l.id, {
                          priority: e.target.value as Priority,
                        }),
                      )
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    defaultValue={l.nextFollowup ?? ""}
                    onChange={(e) =>
                      startTransition(() =>
                        updateLead(l.id, {
                          nextFollowup: e.target.value || null,
                        }),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    defaultValue={l.lastContacted ?? ""}
                    onChange={(e) =>
                      startTransition(() =>
                        updateLead(l.id, {
                          lastContacted: e.target.value || null,
                        }),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  No leads match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
