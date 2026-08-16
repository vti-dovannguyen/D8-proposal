import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ReloadButton } from "@/components/ui/reload-button";
import { SkillManager } from "./skill-manager";
import { createSkill, updateSkill, deleteSkill, type SkillFormData } from "./actions";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const skills = await db.skill.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const rows = skills.map((s) => ({ id: s.id, name: s.name, category: s.category ?? "", active: s.active }));

  async function createAction(data: SkillFormData) { "use server"; await createSkill(data); }
  async function updateAction(id: string, data: SkillFormData) { "use server"; await updateSkill(id, data); }
  async function deleteAction(id: string) { "use server"; await deleteSkill(id); }

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Quản lý Skills</h1>
          <p className="portal-page-subtitle">Danh mục kỹ năng dùng để gán cho thành viên.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-slate-500">{rows.length} skill</span>
          <ReloadButton />
        </div>
      </div>
      <SkillManager skills={rows} onCreate={createAction} onUpdate={updateAction} onDelete={deleteAction} />
    </div>
  );
}
