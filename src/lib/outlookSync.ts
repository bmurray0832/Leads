// Server-side Outlook orchestration. Reads env, sends through Microsoft Graph,
// and logs to the lead timeline. Unlike the best-effort MailerLite sync, these
// are user-initiated actions, so they surface errors to the caller.

import { prisma } from "./prisma";
import { sendMail, createEvent, type OutlookOptions } from "./outlook";

export function outlookConfigured(): boolean {
  return Boolean(
    process.env.MS_TENANT_ID &&
      process.env.MS_CLIENT_ID &&
      process.env.MS_CLIENT_SECRET &&
      process.env.MS_GRAPH_SENDER,
  );
}

function outlookOpts(): OutlookOptions {
  if (!outlookConfigured()) throw new Error("Outlook is not configured");
  return {
    tenantId: process.env.MS_TENANT_ID!,
    clientId: process.env.MS_CLIENT_ID!,
    clientSecret: process.env.MS_CLIENT_SECRET!,
    sender: process.env.MS_GRAPH_SENDER!,
  };
}

// Sends an email to the lead via Outlook, stamps emailedOn, and logs an
// EMAIL_SENT activity (this is what supersedes the manual "Emailed on" log).
export async function sendLeadEmail(
  leadId: string,
  subject: string,
  html: string,
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true },
  });
  if (!lead?.email) throw new Error("Lead has no email address");

  await sendMail(outlookOpts(), { to: lead.email, subject, html });

  await prisma.lead.update({
    where: { id: leadId },
    data: { emailedOn: new Date() },
  });
  await prisma.activity.create({
    data: {
      leadId,
      type: "EMAIL_SENT",
      body: `Sent via Outlook: ${subject}`,
    },
  });
}

// Creates a calendar event inviting the lead and logs a MEETING activity.
export async function createLeadMeeting(
  leadId: string,
  subject: string,
  startIso: string,
  endIso: string,
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true },
  });
  if (!lead?.email) throw new Error("Lead has no email address");

  const res = await createEvent(outlookOpts(), {
    subject,
    startIso,
    endIso,
    attendees: [lead.email],
  });

  await prisma.activity.create({
    data: {
      leadId,
      type: "MEETING",
      body: `Outlook invite: ${subject} (${startIso})`,
      externalId: res.id ?? null,
    },
  });
}
