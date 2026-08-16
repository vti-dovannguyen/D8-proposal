import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { PointAwardForm } from "./point-award-form";

export default async function NewPointAwardPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "point:award")) redirect("/point-award");

  const [users, projects] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tạo thưởng point</h1>
          <p className="portal-page-subtitle">Vinh danh cá nhân hoặc dự án theo tháng.</p>
        </div>
      </div>
      <PointAwardForm users={users} projects={projects} />
    </div>
  );
}
