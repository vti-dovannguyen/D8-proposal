import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canDeleteMeeting, canEditMeeting, getEeNorm } from "@/lib/meetings";
import { canManagePmMeeting, projectVisibilityWhere } from "@/lib/projects";
import { getCategoryMap } from "@/lib/master-data-db";
import { MeetingForm } from "../../meeting-form";
import { MeetingButtons } from "../meeting-buttons";
import { updateMeeting } from "../../actions";
import type { MeetingFormData } from "@/types/meeting";

/** DateTime -> "YYYY-MM-DD" for a `type="date"` input; "" when unset. */
function toDateInputValue(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const { role, id: userId } = session!.user;
  const m = await db.meeting.findUnique({
    where: { id },
    include: {
      eeRows: true, raRows: true, risks: true, milestones: true, nextWeekPlans: true,
      groups: { orderBy: { order: "asc" }, include: { milestones: true, risks: true, nextWeekPlans: true } },
      divisionIssues: true, companyIssues: true, project: { select: { picPms: { select: { id: true } } } },
    },
  });
  if (!m) notFound();
  if (!canEditMeeting(role, m.status)) redirect(`/meetings/${id}`);
  if (role === "PM" && !canManagePmMeeting(userId, m.projectId, m.ownerId, m.project?.picPms ?? [])) redirect(`/meetings/${id}`);

  const [people, projectRows] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({
      // Always include the meeting's already-assigned project even if this PM
      // isn't its PIC PM, so editing doesn't silently drop it from the select.
      where: { OR: [projectVisibilityWhere(role, userId), ...(m.projectId ? [{ id: m.projectId }] : [])] },
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, category: true, section: true, pmTool: true, pmUrl: true, accessKey: true, hasSubProjects: true },
    }),
  ]);
  const projects = projectRows.map(({ pmTool, pmUrl, accessKey, ...p }) => ({
    ...p,
    pmConfigured: Boolean(pmTool && pmUrl && accessKey),
  }));
  const { MEETING: categories, MEETING_SECTION: sections } = await getCategoryMap(["MEETING", "MEETING_SECTION"]);
  const deletable = canDeleteMeeting(role, userId, m.ownerId);

  const initial: MeetingFormData = {
    week: m.week, weekRange: m.weekRange, section: m.section, category: m.category, projectStatus: m.projectStatus, divisionEE: m.divisionEE, status: m.status,
    projectId: m.projectId ?? undefined,
    execSummary: m.execSummary ?? "", teamSummary: m.teamSummary ?? "", opportunities: m.opportunities ?? "",
    otherInfo: m.otherInfo ?? "", additionalNote: m.additionalNote ?? "",
    eeRows: m.eeRows.map((r) => ({ project: r.project, plan: r.plan, actual: r.actual, note: r.note ?? "" })),
    raRows: m.raRows.map((r) => ({ name: r.name, project: r.project, from: r.from, effort: r.effort, status: r.status })),
    // Only meeting-level (groupId null) rows — grouped rows are mapped into `groups` below.
    risks: m.risks.filter((r) => !r.groupId).map((r) => ({
      type: r.type,
      title: r.title,
      impact: r.impact,
      actionPlan: r.actionPlan ?? "",
      notes: r.notes ?? "",
      status: r.status,
      planDate: toDateInputValue(r.planDate),
    })),
    milestones: m.milestones.filter((ms) => !ms.groupId).map((ms) => ({
      name: ms.name,
      planDate: toDateInputValue(ms.planDate),
      status: ms.status,
      note: ms.note ?? "",
    })),
    nextWeekPlans: m.nextWeekPlans.filter((p) => !p.groupId).map((p) => ({ keyActivity: p.keyActivity, note: p.note ?? "" })),
    groups: m.groups.map((g) => ({
      name: g.name,
      status: g.status,
      progressNote: g.progressNote ?? "",
      milestones: g.milestones.map((ms) => ({
        name: ms.name,
        planDate: toDateInputValue(ms.planDate),
        status: ms.status,
        note: ms.note ?? "",
      })),
      risks: g.risks.map((r) => ({
        type: r.type,
        title: r.title,
        impact: r.impact,
        actionPlan: r.actionPlan ?? "",
        notes: r.notes ?? "",
        status: r.status,
        planDate: toDateInputValue(r.planDate),
      })),
      nextWeekPlans: g.nextWeekPlans.map((p) => ({ keyActivity: p.keyActivity, note: p.note ?? "" })),
    })),
    divisionIssues: m.divisionIssues.map((i) => ({ title: i.title, severity: i.severity, ownerId: i.ownerId, status: i.status })),
    companyIssues: m.companyIssues.map((i) => ({ title: i.title, severity: i.severity, ownerId: i.ownerId, status: i.status })),
  };

  async function action(data: MeetingFormData, filesFormData: FormData) {
    "use server";
    await updateMeeting(id, data, filesFormData);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-900">Sửa: {m.week}</h1>
        <MeetingButtons id={m.id} status={m.status} canEdit={false} canDelete={deletable} />
      </div>
      <MeetingForm initial={initial} people={people} projects={projects} categories={categories} sections={sections} role={role} currentUserId={userId} onSubmit={action} eeNorm={getEeNorm()} />
    </div>
  );
}
