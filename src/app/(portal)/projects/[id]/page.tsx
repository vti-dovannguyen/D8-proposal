import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManager } from "@/lib/permissions";
import { isProjectPic } from "@/lib/projects";
import { getCategoryValues } from "@/lib/master-data-db";
import { ProjectDetailHeader } from "./project-detail-header";
import { ProjectTabs } from "./project-tabs";
import { EnvironmentsTab } from "./environments-tab";
import { IntegrationTab } from "./integration-tab";
import { AllocationsTab } from "./allocations-tab";
import { AiAccountsTab } from "./ai-accounts-tab";
import { ServerInfoTab } from "./server-info-tab";
import { MonthlyDetailTab } from "./monthly-detail-tab";
import { KpiTab } from "./kpi-tab";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const project = await db.project.findUnique({
    where: { id },
    include: {
      environments: { orderBy: { name: "asc" } },
      allocations: { include: { user: { select: { id: true, name: true, employeeType: true } }, skill: { select: { id: true, name: true } } } },
      monthlyDetails: { orderBy: { month: "asc" } },
      kpis: { include: { user: { select: { id: true, name: true } } } },
      picPms: { select: { id: true } },
    },
  });
  if (!project) notFound();
  // A PM can edit a project only when they're one of its (possibly several) PIC PMs.
  const canEdit = isManager(session.user.role) || (session.user.role === "PM" && isProjectPic(project.picPms, session.user.id));

  const [users, skills, roles, aiUsers, aiAccountsRaw] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCategoryValues("PROJECT_ROLE"),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    db.aIAccount.findMany({ where: { project: project.name }, orderBy: [{ status: "asc" }, { email: "asc" }], include: { members: true, assignedTo: true } }),
  ]);
  const allocations = project.allocations.map((a) => ({
    id: a.id, userId: a.userId, userName: a.user?.name ?? null, employeeType: a.user?.employeeType ?? null, role: a.role,
    skillId: a.skillId, skillName: a.skill?.name ?? null, hoursPerDay: a.hoursPerDay,
    gitAccount: a.gitAccount, backlogAccount: a.backlogAccount, twoFA: a.twoFA, active: a.active,
  }));

  const kpis = project.kpis.map((k) => ({
    id: k.id, month: k.month, userId: k.userId, userName: k.user.name, note: k.note,
  }));

  const aiAccounts = aiAccountsRaw.map((a) => ({
    id: a.id, email: a.email, provider: a.provider, accountType: a.accountType, project: a.project ?? "",
    assignedToId: a.assignedToId ?? "", assignedToName: a.assignedTo?.name ?? "",
    memberIds: a.members.map((m) => m.id), memberNames: a.members.map((m) => m.name),
    purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : "",
    cost: a.cost == null ? "" : String(a.cost), currency: a.currency, subscriptionType: a.subscriptionType,
    status: a.status, notes: a.notes ?? "",
  }));
  const projectOption = { id: project.id, name: project.name, code: project.code, category: project.category, section: project.section };

  const header = {
    name: project.name, code: project.code ?? "", category: project.category, section: project.section,
    active: project.active, description: project.description ?? "",
  };
  const environments = project.environments.map((e) => ({
    id: e.id, name: e.name, url: e.url ?? "", username: e.username ?? "", note: e.note ?? "", status: e.status, hasPassword: !!e.password,
  }));

  const monthlyDetails = project.monthlyDetails.map((d) => ({
    id: d.id, month: d.month,
    billableProject: d.billableProject, billableDevelop: d.billableDevelop, warrantyEffort: d.warrantyEffort,
    calendarMember: d.calendarMember, calendarIntern: d.calendarIntern, calendarCollaborator: d.calendarCollaborator,
    otMemberEffort: d.otMemberEffort, otInternEffort: d.otInternEffort, otCollaboratorEffort: d.otCollaboratorEffort,
    absent: d.absent, eeToMonth: d.eeToMonth,
  }));

  const integration = {
    repoProvider: project.repoProvider ?? "", repoUrl: project.repoUrl ?? "",
    pmTool: project.pmTool ?? "", pmUrl: project.pmUrl ?? "", accessKey: "",
  };

  const tabs = [
    { id: "env", label: "Môi trường test", content: <EnvironmentsTab projectId={project.id} environments={environments} canEdit={canEdit} /> },
    { id: "git", label: "Git / Backlog / Redmine", content: <IntegrationTab projectId={project.id} initial={integration} hasAccessKey={!!project.accessKey} canEdit={canEdit} /> },
    { id: "alloc", label: "Phân bổ nguồn lực", content: <AllocationsTab projectId={project.id} allocations={allocations} users={users} skills={skills} roles={roles} canEdit={canEdit} /> },
    { id: "monthly", label: "Chi tiết theo tháng", content: <MonthlyDetailTab projectId={project.id} details={monthlyDetails} canEdit={canEdit} /> },
    { id: "kpi", label: "List KPI Loại A", content: <KpiTab projectId={project.id} kpis={kpis} users={users} canEdit={canEdit} /> },
    { id: "server", label: "Thông tin server", content: <ServerInfoTab projectId={project.id} serverInfo={project.serverInfo ?? ""} canEdit={canEdit} /> },
    { id: "ai", label: "AI accounts", content: <AiAccountsTab projectName={project.name} accounts={aiAccounts} projectOption={projectOption} users={aiUsers} canEdit={canEdit} /> },
  ];

  return (
    <div className="space-y-5">
      <ProjectDetailHeader project={header} />
      <ProjectTabs tabs={tabs} />
    </div>
  );
}
