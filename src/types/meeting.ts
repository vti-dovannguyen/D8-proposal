import type { MeetingStatus, Severity } from "@/generated/prisma/enums";

export type EERow = { project: string; plan: number; actual: number; note: string };
export type RARow = { name: string; project: string; from: string; effort: string; status: string };
export type IssueInput = { title: string; severity: Severity; ownerId: string; status: string };

// "impact" is shown in the UI as Priority, "actionPlan" as Mitigation/Action.
export type RiskInput = {
  type: string; // "Issue" | "Risk"
  title: string;
  impact: Severity;
  actionPlan: string;
  status: string;
  planDate: string; // "YYYY-MM-DD" or ""
};

export type MilestoneInput = {
  name: string;
  planDate: string; // "YYYY-MM-DD" or ""
  status: string;
  note: string;
};

export type NextWeekPlanInput = { keyActivity: string; note: string };

// A sub-project group on the "CHI TIẾT THEO NHÓM / SUB-PROJECT" section,
// shown instead of the flat Milestone/Issues-Risks/Next Week Plan sections
// when the meeting's project has `hasSubProjects` set.
export type MeetingGroupInput = {
  name: string;
  status: string;
  progressNote: string;
  milestones: MilestoneInput[];
  risks: RiskInput[];
  nextWeekPlans: NextWeekPlanInput[];
};

export type MeetingFormData = {
  week: string;
  weekRange: string;
  weekStart?: string;
  weekEnd?: string;
  section: string;
  category?: string;
  projectStatus: string;
  divisionEE: number | null;
  status: MeetingStatus;
  projectId?: string;
  execSummary: string;
  teamSummary: string;
  opportunities: string;
  otherInfo: string;
  additionalNote: string;
  eeRows: EERow[];
  raRows: RARow[];
  risks: RiskInput[];
  milestones: MilestoneInput[];
  nextWeekPlans: NextWeekPlanInput[];
  groups: MeetingGroupInput[];
  divisionIssues: IssueInput[];
  companyIssues: IssueInput[];
};
