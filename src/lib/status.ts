// Single source of truth for the pipeline vocabulary.
// DB enums have no spaces; the app renders the display labels below.
// These string-literal unions match the Prisma enums exactly, but live here so
// pure logic (funnel, duplicates, normalize) can be tested without a DB client.

export const LEAD_STATUSES = [
  "NEW",
  "ATTEMPTED",
  "CONTACTED",
  "MEETING_SCHEDULED",
  "MET",
  "CUSTOMER",
  "NO_SHOW",
  "LOST",
  "NOT_QUALIFIED",
  "BAD_LEAD",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PRIORITIES = ["NONE", "HOT", "WARM", "COLD"] as const;
export type Priority = (typeof PRIORITIES)[number];

// Main pipeline (left→right) and terminal/outcome columns shown after it.
export const PIPELINE: LeadStatus[] = [
  "NEW",
  "ATTEMPTED",
  "CONTACTED",
  "MEETING_SCHEDULED",
  "MET",
  "CUSTOMER",
];
export const OUTCOMES: LeadStatus[] = [
  "NO_SHOW",
  "LOST",
  "NOT_QUALIFIED",
  "BAD_LEAD",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  ATTEMPTED: "Attempted",
  CONTACTED: "Contacted",
  MEETING_SCHEDULED: "Meeting Scheduled",
  MET: "Met",
  CUSTOMER: "Customer",
  NO_SHOW: "No Show",
  LOST: "Lost",
  NOT_QUALIFIED: "Not Qualified",
  BAD_LEAD: "Bad Lead",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  NONE: "—",
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
};

// Reverse maps: display label (as found in the HTML export) → DB enum.
export const LABEL_TO_STATUS: Record<string, LeadStatus> = Object.fromEntries(
  (Object.entries(STATUS_LABEL) as [LeadStatus, string][]).map(([k, v]) => [v, k]),
) as Record<string, LeadStatus>;

export const LABEL_TO_PRIORITY: Record<string, Priority> = {
  Hot: "HOT",
  Warm: "WARM",
  Cold: "COLD",
  "": "NONE",
};
