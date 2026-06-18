import type { Lead } from "@prisma/client";
import { toNumber } from "./money";
import type { LeadStatus, Priority } from "./status";

// Plain, serializable shape handed from server components to client components.
export interface LeadDTO {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  company: string | null;
  platform: string | null;
  campaign: string | null;
  adset: string | null;
  ad: string | null;
  form: string | null;
  inboxUrl: string | null;
  source: string | null;
  status: LeadStatus;
  priority: Priority;
  dealValue: number | null;
  createdTime: string | null;
  nextFollowup: string | null; // yyyy-mm-dd
  lastContacted: string | null; // yyyy-mm-dd
  emailedOn: string | null; // yyyy-mm-dd
  notes: string | null;
}

const dateOnly = (d: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

export function serializeLead(l: Lead): LeadDTO {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    jobTitle: l.jobTitle,
    company: l.company,
    platform: l.platform,
    campaign: l.campaign,
    adset: l.adset,
    ad: l.ad,
    form: l.form,
    inboxUrl: l.inboxUrl,
    source: l.source,
    status: l.status as LeadStatus,
    priority: l.priority as Priority,
    dealValue: l.dealValue == null ? null : toNumber(l.dealValue),
    createdTime: l.createdTime ? l.createdTime.toISOString() : null,
    nextFollowup: dateOnly(l.nextFollowup),
    lastContacted: dateOnly(l.lastContacted),
    emailedOn: dateOnly(l.emailedOn),
    notes: l.notes,
  };
}
