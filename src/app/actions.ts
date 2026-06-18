"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureCurrentUserId } from "@/lib/auth";
import { applyStageChange } from "@/lib/leadOps";
import type { LeadStatus, Priority } from "@/lib/status";

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateAll(leadId?: string) {
  revalidatePath("/contacts");
  revalidatePath("/kanban");
  revalidatePath("/funnel");
  revalidatePath("/duplicates");
  revalidatePath("/tasks");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

// Stage change — used by both the Kanban drag and the Contacts status dropdown.
// Writes StageHistory + Activity on a real change (see applyStageChange).
export async function changeStage(leadId: string, toStage: LeadStatus) {
  const userId = await ensureCurrentUserId();
  const res = await applyStageChange(prisma, { leadId, toStage, userId });
  revalidateAll(leadId);
  return res;
}

export interface LeadPatch {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  priority?: Priority;
  dealValue?: number | null;
  notes?: string | null;
  nextFollowup?: string | null;
  lastContacted?: string | null;
}

export async function updateLead(leadId: string, patch: LeadPatch) {
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
      ...(patch.company !== undefined ? { company: patch.company } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.dealValue !== undefined ? { dealValue: patch.dealValue } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.nextFollowup !== undefined
        ? { nextFollowup: parseDate(patch.nextFollowup) }
        : {}),
      ...(patch.lastContacted !== undefined
        ? { lastContacted: parseDate(patch.lastContacted) }
        : {}),
    },
  });
  revalidateAll(leadId);
}

// Manual "Emailed on [date]" quick-log (Outlook stand-in). Stamps the field and
// drops an EMAIL_SENT activity on the timeline.
export async function logEmailedOn(leadId: string, dateStr: string) {
  const userId = await ensureCurrentUserId();
  const date = parseDate(dateStr) ?? new Date();
  await prisma.lead.update({
    where: { id: leadId },
    data: { emailedOn: date },
  });
  await prisma.activity.create({
    data: {
      leadId,
      userId,
      type: "EMAIL_SENT",
      body: `Emailed on ${date.toISOString().slice(0, 10)}`,
    },
  });
  revalidateAll(leadId);
}

export async function addNote(leadId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const userId = await ensureCurrentUserId();
  await prisma.activity.create({
    data: { leadId, userId, type: "NOTE", body: text },
  });
  revalidateAll(leadId);
}

export async function createTask(
  leadId: string,
  title: string,
  dueDate?: string | null,
) {
  const text = title.trim();
  if (!text) return;
  const userId = await ensureCurrentUserId();
  await prisma.task.create({
    data: { leadId, userId, title: text, dueDate: parseDate(dueDate) },
  });
  revalidateAll(leadId);
}

export async function toggleTask(taskId: string, done: boolean) {
  await prisma.task.update({
    where: { id: taskId },
    data: { done, completedAt: done ? new Date() : null },
  });
  revalidateAll();
}

// Merge a duplicate into a primary: move activities/tasks/history over, copy any
// fields the primary is missing, then delete the duplicate.
export async function mergeLeads(primaryId: string, duplicateId: string) {
  if (primaryId === duplicateId) return;
  await prisma.$transaction(async (tx) => {
    const dup = await tx.lead.findUnique({ where: { id: duplicateId } });
    const primary = await tx.lead.findUnique({ where: { id: primaryId } });
    if (!dup || !primary) throw new Error("Lead not found for merge");

    await tx.activity.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId },
    });
    await tx.task.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId },
    });
    await tx.stageHistory.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId },
    });

    // Fill gaps on the primary from the duplicate.
    await tx.lead.update({
      where: { id: primaryId },
      data: {
        email: primary.email ?? dup.email,
        phone: primary.phone ?? dup.phone,
        name: primary.name ?? dup.name,
        company: primary.company ?? dup.company,
        jobTitle: primary.jobTitle ?? dup.jobTitle,
        notes: [primary.notes, dup.notes].filter(Boolean).join("\n---\n") || null,
      },
    });

    await tx.lead.delete({ where: { id: duplicateId } });
  });
  revalidateAll(primaryId);
}
