import type { Role } from "@/types";
import type { EERow, RiskInput, MilestoneInput, NextWeekPlanInput, MeetingGroupInput } from "@/types/meeting";

const EDITORS: Role[] = ["ADMIN", "DIVISION_LEADER", "SECTION_MANAGER", "PM"];

/** Special meeting category: only a Section Manager or Division Leader can select it (see meeting-form.tsx). */
export const SUMMARY_WEEKLY_CATEGORY = "Summary Weekly";

/**
 * Auto-filled into Executive Summary when a Section Manager or Division
 * Leader picks the Summary Weekly category on an empty report (see
 * meeting-form.tsx) — never overwrites existing content.
 */
export const SUMMARY_WEEKLY_TEMPLATE =
  "<p>Phần Report của Tâm</p><p><br></p><p><br></p><p>Phần Report của Pháp</p>";

/** Issues/Risks row type — an Issue (already happening) vs a Risk (may happen). */
export const RISK_TYPES = ["Issue", "Risk"];

/** Fixed risk status list for the Weekly Report Risk section. */
export const RISK_STATUSES = ["Open", "Mitigating", "Resolved", "Closed"];

/** Fixed milestone status list for the Weekly Report Milestone section. */
export const MILESTONE_STATUSES = ["On Track", "At Risk", "Not Started", "Completed"];

/** Pill color classes for a milestone status value. */
export function milestoneStatusClass(status: string): string {
  if (status === "On Track") return "bg-emerald-50 text-emerald-700";
  if (status === "At Risk") return "bg-amber-50 text-amber-700";
  if (status === "Completed") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-500"; // Not Started
}

/** Fixed project status list for the Weekly Report form (not Master-Data-driven). */
export const PROJECT_STATUSES = ["On Schedule", "Late", "Issues"];

/** Default EE% threshold when the `NORM` env var is unset/invalid (matches monthly-detail.ts's EE_THRESHOLDS.green). */
export const EE_NORM_DEFAULT = 90;

/** EE% threshold from the `NORM` env var, used on the meeting detail page to color the Division EE value. */
export function getEeNorm(): number {
  const raw = Number(process.env.NORM);
  return Number.isFinite(raw) ? raw : EE_NORM_DEFAULT;
}

/** Pill color classes for a project status value (On Schedule/Late/Issues) — shared by the detail page and Summary Weekly report. */
export function projectStatusClass(status: string): string {
  if (status === "Late") return "bg-amber-50 text-amber-700";
  if (status === "Issues") return "bg-red-50 text-red-700";
  return "bg-emerald-50 text-emerald-700";
}

/** Pill color classes for a Division EE value against the NORM threshold — red below, green at/above, gray when unset. */
export function eeStatusClass(divisionEE: number | null, norm: number): string {
  if (divisionEE == null) return "bg-slate-100 text-slate-500";
  return divisionEE < norm ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700";
}

const DMY = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** Date-only "dd/MM/yyyy – dd/MM/yyyy" from structured weekStart/weekEnd; falls back to the raw stored weekRange text when either is missing (legacy rows). */
export function formatDateOnlyRange(weekStart: Date | null, weekEnd: Date | null, fallback: string): string {
  if (!weekStart || !weekEnd) return fallback;
  return `${DMY(weekStart)} – ${DMY(weekEnd)}`;
}

/** A meeting is editable only by editor roles, and only while not CLOSED. */
export function canEditMeeting(role: Role, status: string): boolean {
  if (!EDITORS.includes(role)) return false;
  return status !== "CLOSED";
}

export function eeTotals(rows: Array<Pick<EERow, "plan" | "actual"> & Partial<EERow>>): {
  plan: number; actual: number; variance: number;
} {
  const plan = rows.reduce((s, r) => s + r.plan, 0);
  const actual = rows.reduce((s, r) => s + r.actual, 0);
  return { plan, actual, variance: actual - plan };
}

type CloneSource = {
  week: string; weekRange: string; section: string; category?: string | null;
  projectId?: string | null; projectStatus?: string | null; divisionEE?: number | null;
  execSummary?: string | null; teamSummary?: string | null; opportunities?: string | null;
  otherInfo?: string | null; additionalNote?: string | null;
  eeRows: EERow[];
  raRows: { name: string; project: string; from: string; effort: string; status: string }[];
  risks: RiskInput[];
  milestones: MilestoneInput[];
  nextWeekPlans: NextWeekPlanInput[];
  groups: MeetingGroupInput[];
};

/** Produce a new-DRAFT payload from an existing meeting, with a fresh week label. */
export function buildClonePayload(source: CloneSource, next: { week: string; weekRange: string }) {
  return {
    status: "DRAFT" as const,
    week: next.week,
    weekRange: next.weekRange,
    category: source.category ?? "Weekly",
    section: source.section,
    projectId: source.projectId ?? null,
    projectStatus: source.projectStatus ?? PROJECT_STATUSES[0],
    divisionEE: source.divisionEE ?? null,
    execSummary: source.execSummary ?? "",
    teamSummary: source.teamSummary ?? "",
    opportunities: source.opportunities ?? "",
    otherInfo: source.otherInfo ?? "",
    additionalNote: source.additionalNote ?? "",
    eeRows: source.eeRows,
    raRows: source.raRows,
    risks: source.risks,
    milestones: source.milestones,
    nextWeekPlans: source.nextWeekPlans,
    groups: source.groups,
  };
}
