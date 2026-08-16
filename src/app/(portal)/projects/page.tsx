import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, isManager } from "@/lib/permissions";
import { getCategoryMap, getCategoryValues } from "@/lib/master-data-db";
import { ReloadButton } from "@/components/ui/reload-button";
import { ProjectForm } from "./project-form";
import { createProject, updateProject, deleteProject, importProjects, type ProjectFormData } from "./actions";

export default async function ProjectsPage() {
  const session = await auth();
  const { role, id: userId } = session?.user ?? {};
  // Managers see/manage every project; a PM may only view/edit the project(s) they're PIC PM on.
  if (!role || (!isManager(role) && role !== "PM")) redirect("/");
  const canManage = can(role, "project:manage");

  const [projects, users, skills, { PROJECT: categories, MEETING_SECTION: sections }, roles] = await Promise.all([
    db.project.findMany({
      where: canManage ? {} : { picPms: { some: { id: userId } } },
      orderBy: [{ active: "desc" }, { section: "asc" }, { name: "asc" }],
      include: {
        allocations: { include: { user: { select: { id: true, name: true } }, skill: { select: { id: true, name: true } } } },
        picPms: { select: { id: true } },
      },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getCategoryMap(["PROJECT", "MEETING_SECTION"]),
    getCategoryValues("PROJECT_ROLE"),
  ]);

  const rows = projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code ?? "",
    category: p.category,
    section: p.section,
    active: p.active,
    hasSubProjects: p.hasSubProjects,
    description: p.description ?? "",
    picPmIds: p.picPms.map((u) => u.id),
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : "",
    endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : "",
    budgetedEffortMM: p.budgetedEffortMM != null ? String(p.budgetedEffortMM) : "",
    repoProvider: p.repoProvider ?? "",
    repoUrl: p.repoUrl ?? "",
    pmTool: p.pmTool ?? "",
    pmUrl: p.pmUrl ?? "",
    hasAccessKey: !!p.accessKey,
    allocationCount: p.allocations.length,
    allocations: p.allocations.map((a) => ({ userId: a.userId, role: a.role, skillId: a.skillId, hoursPerDay: a.hoursPerDay })),
  }));

  async function createAction(data: ProjectFormData) { "use server"; await createProject(data); }
  async function updateAction(id: string, data: ProjectFormData) { "use server"; await updateProject(id, data); }
  async function deleteAction(id: string) { "use server"; await deleteProject(id); }
  async function importAction(formData: FormData) { "use server"; return importProjects(formData); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Project Management</h1>
          <p className="portal-page-subtitle">Quản lý dự án và phân bổ nguồn lực (member, vai trò, skill, giờ/ngày).</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-slate-500">{rows.length} project</span>
          <ReloadButton />
        </div>
      </div>
      <ProjectForm
        projects={rows}
        categories={categories}
        sections={sections}
        users={users}
        skills={skills}
        roles={roles}
        canManage={canManage}
        currentUserId={userId!}
        onCreate={createAction}
        onUpdate={updateAction}
        onDelete={deleteAction}
        onImport={importAction}
      />
    </div>
  );
}
