// Server-side MailerLite orchestration. Best-effort: failures are logged, never
// thrown into the caller, so a MailerLite outage can't block a DB write or a
// webhook 200. No-ops when MAILERLITE_API_KEY is unset.

import { prisma } from "./prisma";
import { syncSubscriber, type MailerLiteOptions } from "./mailerlite";
import type { LeadStatus } from "./status";

function mlOpts(): MailerLiteOptions | null {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) return null;
  return { apiKey, baseUrl: process.env.MAILERLITE_BASE_URL || undefined };
}

function groupIds(): string[] {
  const g = process.env.MAILERLITE_GROUP_ID;
  return g ? [g] : [];
}

// Upserts the lead's subscriber (email, name, crm_status, group) and stores the
// returned MailerLite subscriber id. Covers both new-lead sync and status push.
export async function syncLeadToMailerLite(leadId: string): Promise<void> {
  const opts = mlOpts();
  if (!opts) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      email: true,
      name: true,
      status: true,
      mailerliteSubscriberId: true,
    },
  });
  if (!lead?.email) return;

  try {
    const sub = await syncSubscriber(opts, {
      email: lead.email,
      name: lead.name,
      status: lead.status as LeadStatus,
      groupIds: groupIds(),
    });
    if (sub.id && sub.id !== lead.mailerliteSubscriberId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { mailerliteSubscriberId: sub.id },
      });
    }
  } catch (e) {
    console.error("MailerLite sync failed for", leadId, (e as Error).message);
  }
}
