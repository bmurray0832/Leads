"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeadDTO } from "@/lib/serialize";
import {
  PIPELINE,
  OUTCOMES,
  STATUS_LABEL,
  type LeadStatus,
} from "@/lib/status";
import { changeStage } from "@/app/actions";

const COLUMNS: LeadStatus[] = [...PIPELINE, ...OUTCOMES];

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function KanbanBoard({ leads }: { leads: LeadDTO[] }) {
  const router = useRouter();
  const [items, setItems] = useState<LeadDTO[]>(leads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [, startTransition] = useTransition();

  const byColumn = useMemo(() => {
    const map = new Map<LeadStatus, LeadDTO[]>();
    for (const c of COLUMNS) map.set(c, []);
    for (const l of items) map.get(l.status)?.push(l);
    return map;
  }, [items]);

  function onDrop(toStage: LeadStatus) {
    setOver(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.status === toStage) return;

    // Optimistic move.
    setItems((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: toStage } : l)),
    );
    startTransition(() => {
      changeStage(id, toStage)
        .then(() => router.refresh())
        .catch(() => {
          // Roll back on failure.
          setItems((prev) =>
            prev.map((l) => (l.id === id ? { ...l, status: lead.status } : l)),
          );
        });
    });
  }

  return (
    <div className="board">
      {COLUMNS.map((col) => {
        const cards = byColumn.get(col) ?? [];
        const total = cards.reduce((s, l) => s + (l.dealValue ?? 0), 0);
        return (
          <div
            key={col}
            className={`column${over === col ? " dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (over !== col) setOver(col);
            }}
            onDragLeave={() => setOver((o) => (o === col ? null : o))}
            onDrop={() => onDrop(col)}
          >
            <div className="column-head">
              <div className="name">{STATUS_LABEL[col]}</div>
              <div className="meta">
                {cards.length} · {money(total)}
              </div>
            </div>
            <div className="column-body">
              {cards.map((l) => (
                <div
                  key={l.id}
                  className="card"
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                >
                  <div className="card-name">
                    <Link href={`/leads/${encodeURIComponent(l.id)}`}>
                      {l.name ?? "(no name)"}
                    </Link>
                  </div>
                  {l.company ? <div className="card-sub">{l.company}</div> : null}
                  {l.dealValue ? (
                    <div className="card-deal">{money(l.dealValue)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
