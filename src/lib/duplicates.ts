// Duplicate detection: leads that share a normalized email or phone.

import { emailKey, phoneKey } from "./normalize";

export interface DupLead {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  createdTime?: Date | string | null;
}

export interface DuplicateGroup<T extends DupLead = DupLead> {
  kind: "email" | "phone";
  key: string;
  leads: T[];
}

// Returns groups of 2+ leads sharing the same email or phone.
// A lead can appear in both an email group and a phone group.
export function findDuplicateGroups<T extends DupLead>(
  leads: T[],
): DuplicateGroup<T>[] {
  const byEmail = new Map<string, T[]>();
  const byPhone = new Map<string, T[]>();

  for (const l of leads) {
    const ek = emailKey(l.email ?? undefined);
    if (ek) {
      const arr = byEmail.get(ek) ?? [];
      arr.push(l);
      byEmail.set(ek, arr);
    }
    const pk = phoneKey(l.phone ?? undefined);
    if (pk) {
      const arr = byPhone.get(pk) ?? [];
      arr.push(l);
      byPhone.set(pk, arr);
    }
  }

  const groups: DuplicateGroup<T>[] = [];
  for (const [key, arr] of byEmail) {
    if (arr.length > 1) groups.push({ kind: "email", key, leads: arr });
  }
  for (const [key, arr] of byPhone) {
    if (arr.length > 1) groups.push({ kind: "phone", key, leads: arr });
  }
  // Largest groups first for a sensible review order.
  groups.sort((a, b) => b.leads.length - a.leads.length);
  return groups;
}
