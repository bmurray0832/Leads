"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { STATUS_LABEL, type LeadStatus } from "@/lib/status";
import { mergeLeads } from "@/app/actions";

interface DupLeadView {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  createdTime: string | null;
}
interface GroupView {
  kind: "email" | "phone";
  key: string;
  leads: DupLeadView[];
}

export default function DuplicateGroups({ groups }: { groups: GroupView[] }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  if (groups.length === 0) {
    return <div className="panel empty">No duplicate leads found. 🎉</div>;
  }

  function merge(primaryId: string, duplicateId: string) {
    setBusy(duplicateId);
    startTransition(() => {
      mergeLeads(primaryId, duplicateId).finally(() => setBusy(null));
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map((g) => {
        const primary = g.leads[0];
        return (
          <div key={`${g.kind}:${g.key}`} className="panel">
            <div className="column-head">
              <span className="badge">{g.kind}</span>{" "}
              <strong>{g.key}</strong>{" "}
              <span className="subtle">· {g.leads.length} leads</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {g.leads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/leads/${encodeURIComponent(l.id)}`}>
                        {l.name ?? "(no name)"}
                      </Link>
                      {l.id === primary.id ? (
                        <span className="subtle"> · primary</span>
                      ) : null}
                    </td>
                    <td>{l.email ?? "—"}</td>
                    <td>{l.phone ?? "—"}</td>
                    <td>{STATUS_LABEL[l.status as LeadStatus] ?? l.status}</td>
                    <td className="subtle">
                      {l.createdTime ? l.createdTime.slice(0, 10) : "—"}
                    </td>
                    <td>
                      {l.id === primary.id ? null : (
                        <button
                          className="btn ghost"
                          disabled={pending && busy === l.id}
                          onClick={() => merge(primary.id, l.id)}
                        >
                          {busy === l.id ? "Merging…" : "Merge into primary"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
