import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManager } from "@/lib/permissions";
import { isProjectPic } from "@/lib/projects";
import type { Role } from "@/types";

/**
 * Gate for editing an existing project's information (core fields,
 * integration, environments, allocations, monthly detail, server info, …).
 * Managers (ADMIN/DIVISION_LEADER/SECTION_MANAGER) can edit any project; a PM
 * can edit only a project where they are one of the (possibly several) PIC
 * PMs. Creating/deleting projects and bulk import stay manager-only — call
 * sites for those keep using `can(role, "project:manage")` directly.
 */
export async function requireProjectEditAccess(projectId: string): Promise<{ id: string; role: Role }> {
  const session = await auth();
  if (!session?.user) throw new Error("Forbidden");
  const { role, id: userId } = session.user;
  if (isManager(role)) return { id: userId, role };
  if (role === "PM") {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { picPms: { select: { id: true } } } });
    if (project && isProjectPic(project.picPms, userId)) return { id: userId, role };
  }
  throw new Error("Forbidden: bạn không phải PIC PM của dự án này");
}
