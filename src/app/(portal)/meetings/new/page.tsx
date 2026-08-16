import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { projectVisibilityWhere } from "@/lib/projects";
import { getCategoryMap } from "@/lib/master-data-db";
import { PROJECT_STATUSES, getEeNorm } from "@/lib/meetings";
import { getCurrentWeekOption } from "@/lib/meeting-week-options";
import { MeetingForm } from "../meeting-form";
import { createMeeting } from "../actions";
import type { MeetingFormData } from "@/types/meeting";

export default async function NewMeetingPage() {
  const session = await auth();
  const { role, id: userId } = session!.user;
  if (!can(role, "meeting:edit")) redirect("/meetings");
  const [people, projectRows] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({
      where: projectVisibilityWhere(role, userId),
      orderBy: [{ section: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, category: true, section: true, pmTool: true, pmUrl: true, accessKey: true, hasSubProjects: true },
    }),
  ]);
  const projects = projectRows.map(({ pmTool, pmUrl, accessKey, ...p }) => ({
    ...p,
    pmConfigured: Boolean(pmTool && pmUrl && accessKey),
  }));
  const { MEETING: categories, MEETING_SECTION: sections } = await getCategoryMap(["MEETING", "MEETING_SECTION"]);

  const currentWeek = getCurrentWeekOption();
  const initial: MeetingFormData = {
    week: currentWeek?.week ?? "",
    weekRange: currentWeek ? `${currentWeek.weekStart} - ${currentWeek.weekEnd}` : "",
    weekStart: currentWeek?.weekStart ?? "",
    weekEnd: currentWeek?.weekEnd ?? "",
    section: sections[1] ?? sections[0] ?? "",
    category: categories[0] ?? "",
    projectStatus: PROJECT_STATUSES[0],
    divisionEE: null,
    status: "OPEN",
    execSummary: "",
    teamSummary: "",
    opportunities: "",
    otherInfo: "",
    additionalNote: "",
    eeRows: [],
    raRows: [],
    risks: [],
    milestones: [],
    nextWeekPlans: [],
    groups: [],
    divisionIssues: [],
    companyIssues: [],
  };

  async function action(data: MeetingFormData, filesFormData: FormData) {
    "use server";
    await createMeeting(data, filesFormData);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Tạo Weekly Report</h1>
      <MeetingForm initial={initial} people={people} projects={projects} categories={categories} sections={sections} role={role} currentUserId={userId} onSubmit={action} isNew eeNorm={getEeNorm()} />
    </div>
  );
}
