import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { LevelLookup } from "@/lib/skill-matrix";
import { ReloadButton } from "@/components/ui/reload-button";
import { SkillMatrix } from "./skill-matrix";

export default async function SkillMatrixPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "master-data:manage")) redirect("/");

  const [users, skills, userSkills] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, title: true, section: true, role: true } }),
    db.skill.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.userSkill.findMany({ select: { userId: true, skillId: true, level: true } }),
  ]);

  const levels: LevelLookup = {};
  for (const us of userSkills) {
    (levels[us.userId] ??= {})[us.skillId] = us.level;
  }

  const rows = users.map((u) => ({ id: u.id, name: u.name, title: u.title, section: u.section, role: u.role as string }));

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Skill Matrix</h1>
          <p className="portal-page-subtitle">Mức thành thạo thực tế của nhân sự theo từng kỹ năng.</p>
        </div>
        <ReloadButton />
      </div>
      <SkillMatrix rows={rows} skills={skills} levels={levels} />
    </div>
  );
}
