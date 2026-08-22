"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { canDeleteMeeting, canEditMeeting, buildClonePayload, PROJECT_STATUSES } from "@/lib/meetings";
import { canManagePmMeeting } from "@/lib/projects";
import { uploadAttachmentFile, assertUploadableFile, removeFromBucket } from "@/lib/storage";
import { sanitizeMeetingRichTextHtml } from "@/lib/sanitize";
import { fetchWeeklyTasks, isPmConfigured, toDateOnly } from "@/lib/pm-integrations";
import {
  buildWeeklyReportHtml,
  buildNarrativePrompt,
  parseNarrativeResponse,
  computeWeeklyReportStats,
  groupByCategory,
  selectRiskTasks,
  NARRATIVE_SYSTEM_PROMPT,
  type NarrativeResponse,
} from "@/lib/weekly-report-template";
import { generateAgentReply } from "@/lib/openai-agent";
import { sendMeetingReportNotification } from "@/lib/google-chat";
import { queryWeeklySummaryReport, type SummarySectionGroup } from "@/lib/weekly-summary-report";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MeetingFormData, EERow, RiskInput, MilestoneInput, NextWeekPlanInput, MeetingGroupInput } from "@/types/meeting";
import type { Role } from "@/types";
import type { Severity } from "@/generated/prisma/enums";

async function requireEditor(): Promise<{ id: string; role: Role; name: string }> {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "meeting:edit")) {
    throw new Error("Forbidden");
  }
  return { id: session.user.id, role: session.user.role, name: session.user.name ?? "PM" };
}

/**
 * A PM may only RUD/clone a Weekly Meeting tied to a project they are one of
 * the PIC PMs on. When the meeting has no project, only its own creator may
 * RUD/clone it — other PMs get view/read only. Other editors
 * (ADMIN/DIVISION_LEADER/SECTION_MANAGER) are unrestricted.
 */
async function assertProjectAccess(role: Role, userId: string, projectId: string | null, ownerId: string) {
  if (role !== "PM") return;
  if (!projectId) {
    if (!canManagePmMeeting(userId, null, ownerId, [])) {
      throw new Error("Forbidden: chỉ người tạo report này mới có quyền chỉnh sửa/clone");
    }
    return;
  }
  const project = await db.project.findUnique({ where: { id: projectId }, select: { picPms: { select: { id: true } } } });
  if (!project || !canManagePmMeeting(userId, projectId, ownerId, project.picPms)) {
    throw new Error("Forbidden: bạn không phải PIC PM của dự án này");
  }
}

function meetingCategory(form: MeetingFormData) {
  return form.category?.trim() || "Weekly";
}

function meetingWeekRange(form: MeetingFormData) {
  if (form.weekStart && form.weekEnd) return `${form.weekStart} - ${form.weekEnd}`;
  return form.weekRange.trim();
}

/** "YYYY-MM-DDTHH:MM" (datetime-local) -> Date, or null when blank/invalid. */
function parseWeekDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM-DD" (date input) -> Date, or null when blank/invalid. Shared by Risk/Milestone plan dates. */
function parseDateOnly(value?: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function risksData(risks: RiskInput[]) {
  return risks.map((r) => ({
    type: r.type,
    title: r.title,
    impact: r.impact,
    actionPlan: r.actionPlan,
    notes: r.notes,
    status: r.status,
    planDate: parseDateOnly(r.planDate),
  }));
}

function milestonesData(milestones: MilestoneInput[]) {
  return milestones.map((ms) => ({
    name: ms.name,
    planDate: parseDateOnly(ms.planDate),
    status: ms.status,
    note: ms.note,
  }));
}

function nextWeekPlansData(nextWeekPlans: NextWeekPlanInput[]) {
  return nextWeekPlans.map((p) => ({ keyActivity: p.keyActivity, note: p.note }));
}

function groupsData(groups: MeetingGroupInput[]) {
  return groups.map((g, i) => ({
    name: g.name,
    status: g.status,
    progressNote: g.progressNote,
    order: i,
    milestones: { create: milestonesData(g.milestones) },
    risks: { create: risksData(g.risks) },
    nextWeekPlans: { create: nextWeekPlansData(g.nextWeekPlans) },
  }));
}

function validate(form: MeetingFormData) {
  if (form.status === "DRAFT") return; // drafts may be incomplete
  if (!form.week?.trim() || !meetingWeekRange(form) || !form.section?.trim() || !meetingCategory(form)) {
    throw new Error("Validation: week, weekRange and section are required");
  }
}

/**
 * Validate every staged file against the same allowlist/size-cap rules the
 * single-file upload path enforces, BEFORE any database write happens. This
 * must run ahead of db.meeting.create/update so a rejected file (bad
 * extension, over the size cap, or otherwise) never leaves behind a
 * half-created/duplicated meeting for the user to retry into.
 */
function validateAttachmentFiles(files: File[]) {
  for (const file of files) {
    if (file.size === 0) continue;
    assertUploadableFile(file);
  }
}

async function persistAttachmentFiles(meetingId: string, files: File[]) {
  for (const file of files) {
    if (file.size === 0) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${meetingId}/${Date.now()}_${safeName}`;
    await uploadAttachmentFile(path, file);
    await db.attachment.create({ data: { meetingId, fileName: file.name, fileUrl: path, fileSize: file.size } });
  }
}

function filesFrom(formData: FormData | undefined, key: string): File[] {
  if (!formData) return [];
  return formData.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}

export async function createMeeting(form: MeetingFormData, filesFormData?: FormData) {
  const user = await requireEditor();
  validate(form);
  await assertProjectAccess(user.role, user.id, form.projectId || null, user.id);
  const stagedFiles = filesFrom(filesFormData, "files");
  validateAttachmentFiles(stagedFiles);
  const created = await db.meeting.create({
    data: {
      week: form.week.trim(),
      weekRange: meetingWeekRange(form),
      weekStart: parseWeekDate(form.weekStart),
      weekEnd: parseWeekDate(form.weekEnd),
      category: meetingCategory(form),
      projectStatus: form.projectStatus.trim() || PROJECT_STATUSES[0],
      divisionEE: form.divisionEE,
      section: form.section.trim(),
      status: form.status,
      execSummary: sanitizeMeetingRichTextHtml(form.execSummary),
      teamSummary: sanitizeMeetingRichTextHtml(form.teamSummary),
      opportunities: sanitizeMeetingRichTextHtml(form.opportunities),
      otherInfo: sanitizeMeetingRichTextHtml(form.otherInfo),
      additionalNote: form.additionalNote,
      ownerId: user.id,
      projectId: form.projectId || null,
      eeRows: { create: form.eeRows },
      raRows: { create: form.raRows },
      risks: { create: risksData(form.risks) },
      milestones: { create: milestonesData(form.milestones) },
      nextWeekPlans: { create: nextWeekPlansData(form.nextWeekPlans) },
      groups: { create: groupsData(form.groups) },
      divisionIssues: {
        create: form.divisionIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
      companyIssues: {
        create: form.companyIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
    },
  });
  await persistAttachmentFiles(created.id, stagedFiles);
  const projects = [...new Set(form.eeRows.map((r) => r.project.trim()).filter(Boolean))];
  await sendMeetingReportNotification({
    pmName: user.name,
    projects,
    section: created.section,
    meetingUrl: process.env.APP_URL ? `${process.env.APP_URL}/meetings/${created.id}` : "",
  });
  revalidatePath("/meetings");
  redirect(`/meetings/${created.id}`);
}

export async function updateMeeting(id: string, form: MeetingFormData, filesFormData?: FormData) {
  const user = await requireEditor();
  validate(form);
  const existing = await db.meeting.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");
  if (!canEditMeeting(user.role, existing.status)) {
    throw new Error("This meeting is locked (CLOSED)");
  }
  await assertProjectAccess(user.role, user.id, existing.projectId, existing.ownerId);
  await assertProjectAccess(user.role, user.id, form.projectId || null, existing.ownerId);
  const stagedFiles = filesFrom(filesFormData, "files");
  validateAttachmentFiles(stagedFiles);
  await db.meeting.update({
    where: { id },
    data: {
      week: form.week.trim(),
      weekRange: meetingWeekRange(form),
      weekStart: parseWeekDate(form.weekStart),
      weekEnd: parseWeekDate(form.weekEnd),
      category: meetingCategory(form),
      projectStatus: form.projectStatus.trim() || PROJECT_STATUSES[0],
      divisionEE: form.divisionEE,
      section: form.section.trim(),
      status: form.status,
      execSummary: sanitizeMeetingRichTextHtml(form.execSummary),
      teamSummary: sanitizeMeetingRichTextHtml(form.teamSummary),
      opportunities: sanitizeMeetingRichTextHtml(form.opportunities),
      otherInfo: sanitizeMeetingRichTextHtml(form.otherInfo),
      additionalNote: form.additionalNote,
      projectId: form.projectId || null,
      eeRows: { deleteMany: {}, create: form.eeRows },
      raRows: { deleteMany: {}, create: form.raRows },
      risks: { deleteMany: {}, create: risksData(form.risks) },
      milestones: { deleteMany: {}, create: milestonesData(form.milestones) },
      nextWeekPlans: { deleteMany: {}, create: nextWeekPlansData(form.nextWeekPlans) },
      groups: { deleteMany: {}, create: groupsData(form.groups) },
      divisionIssues: {
        set: [],
        create: form.divisionIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
      companyIssues: {
        set: [],
        create: form.companyIssues.map((i) => ({
          title: i.title,
          severity: i.severity,
          status: i.status,
          ownerId: i.ownerId,
        })),
      },
    },
  });
  await persistAttachmentFiles(id, stagedFiles);
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
  redirect(`/meetings/${id}`);
}

export async function closeMeeting(id: string) {
  const user = await requireEditor();
  const existing = await db.meeting.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");
  await assertProjectAccess(user.role, user.id, existing.projectId, existing.ownerId);
  await db.meeting.update({ where: { id }, data: { status: "CLOSED" } });
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
  redirect(`/meetings/${id}`);
}

export async function cloneMeeting(id: string) {
  const user = await requireEditor();
  const source = await db.meeting.findUnique({
    where: { id },
    include: {
      eeRows: true, raRows: true, risks: true, milestones: true, nextWeekPlans: true,
      groups: { orderBy: { order: "asc" }, include: { milestones: true, risks: true, nextWeekPlans: true } },
    },
  });
  if (!source) throw new Error("Not found");
  await assertProjectAccess(user.role, user.id, source.projectId, source.ownerId);

  const riskInput = (r: { type: string; title: string; impact: Severity; actionPlan: string | null; notes: string | null; status: string; planDate: Date | null }): RiskInput => ({
    type: r.type,
    title: r.title,
    impact: r.impact,
    actionPlan: r.actionPlan ?? "",
    notes: r.notes ?? "",
    status: r.status,
    planDate: r.planDate ? r.planDate.toISOString().slice(0, 10) : "",
  });
  const milestoneInput = (ms: { name: string; planDate: Date | null; status: string; note: string | null }): MilestoneInput => ({
    name: ms.name,
    planDate: ms.planDate ? ms.planDate.toISOString().slice(0, 10) : "",
    status: ms.status,
    note: ms.note ?? "",
  });
  const nextWeekPlanInput = (p: { keyActivity: string; note: string | null }): NextWeekPlanInput => ({ keyActivity: p.keyActivity, note: p.note ?? "" });

  const payload = buildClonePayload(
    {
      week: source.week, weekRange: source.weekRange, section: source.section, category: source.category,
      projectId: source.projectId, projectStatus: source.projectStatus, divisionEE: source.divisionEE,
      execSummary: source.execSummary, teamSummary: source.teamSummary,
      opportunities: source.opportunities, otherInfo: source.otherInfo, additionalNote: source.additionalNote,
      eeRows: source.eeRows.map((r) => ({ project: r.project, plan: r.plan, actual: r.actual, note: r.note ?? "" })),
      raRows: source.raRows.map((r) => ({ name: r.name, project: r.project, from: r.from, effort: r.effort, status: r.status })),
      // Only meeting-level (groupId null) rows — grouped rows are cloned via `groups` below.
      risks: source.risks.filter((r) => !r.groupId).map(riskInput),
      milestones: source.milestones.filter((ms) => !ms.groupId).map(milestoneInput),
      nextWeekPlans: source.nextWeekPlans.filter((p) => !p.groupId).map(nextWeekPlanInput),
      groups: source.groups.map((g) => ({
        name: g.name,
        status: g.status,
        progressNote: g.progressNote ?? "",
        milestones: g.milestones.map(milestoneInput),
        risks: g.risks.map(riskInput),
        nextWeekPlans: g.nextWeekPlans.map(nextWeekPlanInput),
      })),
    },
    { week: source.week + " (copy)", weekRange: source.weekRange }
  );

  const created = await db.meeting.create({
    data: {
      week: payload.week, weekRange: payload.weekRange, category: payload.category, section: payload.section, status: "DRAFT",
      projectId: payload.projectId, projectStatus: payload.projectStatus, divisionEE: payload.divisionEE,
      execSummary: payload.execSummary, teamSummary: payload.teamSummary, opportunities: payload.opportunities,
      otherInfo: payload.otherInfo, additionalNote: payload.additionalNote, ownerId: user.id,
      eeRows: { create: payload.eeRows },
      raRows: { create: payload.raRows },
      risks: { create: risksData(payload.risks) },
      milestones: { create: milestonesData(payload.milestones) },
      nextWeekPlans: { create: nextWeekPlansData(payload.nextWeekPlans) },
      groups: { create: groupsData(payload.groups) },
    },
  });
  const projects = [...new Set(payload.eeRows.map((r) => r.project.trim()).filter(Boolean))];
  await sendMeetingReportNotification({
    pmName: user.name,
    projects,
    section: payload.section,
    meetingUrl: process.env.APP_URL ? `${process.env.APP_URL}/meetings/${created.id}` : "",
  });
  revalidatePath("/meetings");
  redirect(`/meetings/${created.id}/edit`);
}

export async function deleteMeeting(id: string) {
  const user = await requireEditor();
  const existing = await db.meeting.findUnique({
    where: { id },
    select: { ownerId: true, attachments: { select: { fileUrl: true } } },
  });
  if (!existing) throw new Error("Not found");
  if (!canDeleteMeeting(user.role, user.id, existing.ownerId)) throw new Error("Forbidden");

  await db.meeting.delete({ where: { id } });
  for (const attachment of existing.attachments ?? []) {
    try {
      await removeFromBucket(attachment.fileUrl);
    } catch (e) {
      console.error("Failed to remove meeting attachment:", e);
    }
  }
  revalidatePath("/meetings");
  redirect("/meetings");
}

export type WeeklySyncResult = {
  summaryHtml: string;
  eeRows: EERow[];
  taskCount: number;
};

function formatDmy(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Ask the LLM to fill the report's narrative slots (overall status sentence,
 * escalation note, next-week plan) from the already-computed numbers. Never
 * throws to the caller — returns null on any failure (no API key, bad JSON,
 * network error) so the caller falls back to a deterministic sentence.
 */
async function generateNarrative(input: Parameters<typeof buildNarrativePrompt>[0]): Promise<NarrativeResponse | null> {
  try {
    const { text } = await generateAgentReply({
      agent: { name: "Weekly Report Narrator", prompt: NARRATIVE_SYSTEM_PROMPT, description: null, useCase: null },
      messages: [{ role: "user", text: buildNarrativePrompt(input) }],
    });
    return parseNarrativeResponse(text);
  } catch {
    return null;
  }
}

/**
 * Pull the week's tasks from a project's configured PM tool (Redmine/Backlog)
 * and assemble the Weekly Progress Report template into the Executive
 * Summary (deterministic tables/numbers + a best-effort AI narrative
 * overlay), plus an EE effort row. The project's access token is read
 * server-side only and never returned.
 */
export async function syncWeeklyTasks(
  projectId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeeklySyncResult> {
  const user = await requireEditor();
  await assertProjectAccess(user.role, user.id, projectId, user.id);
  if (!weekStart?.trim() || !weekEnd?.trim()) {
    throw new Error("Validation: cần nhập khoảng tuần (Từ / Đến) trước khi sync");
  }
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Not found");
  if (!isPmConfigured(project)) {
    throw new Error("Dự án chưa cấu hình đầy đủ PM tool / URL / token.");
  }

  const tasks = await fetchWeeklyTasks(project, weekStart, weekEnd);
  const start = toDateOnly(weekStart);
  const end = toDateOnly(weekEnd);

  const narrative = await generateNarrative({
    projectName: project.name,
    stats: computeWeeklyReportStats(tasks, start, end),
    risks: selectRiskTasks(tasks),
    groups: groupByCategory(tasks),
  });

  const summaryHtml = buildWeeklyReportHtml({
    projectName: project.name,
    weekLabel: `${formatDmy(start)} – ${formatDmy(end)}`,
    reporterName: user.name,
    weekStart: start,
    weekEnd: end,
    tasks,
    overallNote: narrative?.overallNote,
    escalationNote: narrative?.escalationNote,
    nextWeekPlan: narrative?.nextWeekPlan,
  });

  const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);
  const eeRows: EERow[] =
    tasks.length === 0
      ? []
      : [
          {
            project: project.name,
            plan: 0,
            actual: Math.round(totalHours),
            note: `Đồng bộ ${tasks.length} task từ ${project.pmTool}`,
          },
        ];

  return { summaryHtml, eeRows, taskCount: tasks.length };
}

export async function uploadAttachment(meetingId: string, formData: FormData) {
  const user = await requireEditor();
  // meetingId is also used as a storage path segment — reject anything that
  // isn't a plain cuid to prevent path traversal / unexpected keys.
  if (!/^[a-z0-9]{20,}$/i.test(meetingId)) throw new Error("Validation: bad meeting id");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Validation: no file");

  // Editor + not-CLOSED parity with updateMeeting: a closed meeting is locked.
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Not found");
  if (!canEditMeeting(user.role, meeting.status)) {
    throw new Error("This meeting is locked (CLOSED)");
  }
  await assertProjectAccess(user.role, user.id, meeting.projectId, meeting.ownerId);

  await persistAttachmentFiles(meetingId, [file]);
  revalidatePath(`/meetings/${meetingId}`);
}

/**
 * Client-facing action behind the create form's "Tổng hợp report" button —
 * only a Section Manager or Division Leader may pick the Summary Weekly
 * category. The actual query lives in `@/lib/weekly-summary-report` (a plain
 * module, not a server action) so it can never be invoked directly by the
 * client without this gate.
 */
export async function getWeeklySummaryReport(weekStart: string, weekEnd: string): Promise<SummarySectionGroup[]> {
  const user = await requireEditor();
  if (user.role !== "SECTION_MANAGER" && user.role !== "DIVISION_LEADER") {
    throw new Error("Forbidden: chỉ Section Manager hoặc Division Leader mới xem được Summary Weekly");
  }
  return queryWeeklySummaryReport(weekStart, weekEnd);
}
