import { INTERN_EFFORT_FACTOR } from "@/lib/monthly-detail";
import type { EmployeeType, Role } from "@/types";

// Effective resource effort: an intern contributes half the hours of an official member.
export function effectiveHoursPerDay(hoursPerDay: number, employeeType: EmployeeType): number {
  return employeeType === "INTERN" ? hoursPerDay * INTERN_EFFORT_FACTOR : hoursPerDay;
}

/**
 * Row-level visibility for the project list used by the Weekly Meeting screens:
 * a PM only sees projects where they are one of the (possibly several) PIC
 * PMs. Every other role (managers, MEMBER) sees every active project.
 */
export function projectVisibilityWhere(role: Role, userId: string): { active: true; picPms?: { some: { id: string } } } {
  return role === "PM" ? { active: true, picPms: { some: { id: userId } } } : { active: true };
}

/** Whether userId is one of a project's PIC PMs (project.picPms is an id list or objects with .id). */
export function isProjectPic(picPms: Array<{ id: string }>, userId: string): boolean {
  return picPms.some((p) => p.id === userId);
}

/**
 * Whether a PM may manage (edit/close/clone) a Weekly Meeting: PIC PM of its
 * project when one is set, otherwise only the meeting's own creator (other
 * PMs get view/read only on a no-project report).
 */
export function canManagePmMeeting(
  userId: string,
  projectId: string | null,
  ownerId: string,
  picPms: Array<{ id: string }>,
): boolean {
  return projectId ? isProjectPic(picPms, userId) : ownerId === userId;
}

export type AllocationInput = {
  userId: string; role: string; skillId: string; hoursPerDay: number;
  gitAccount?: string; backlogAccount?: string; twoFA?: boolean; active?: boolean;
};
export type AllocationData = {
  userId: string | null; role: string; skillId: string | null; hoursPerDay: number;
  gitAccount: string | null; backlogAccount: string | null; twoFA: boolean; active: boolean;
};

export function normalizeAllocation(r: AllocationInput): AllocationData | null {
  const role = r.role.trim();
  const userId = r.userId.trim();
  const skillId = r.skillId.trim();
  if (!role && !userId && !skillId) return null;
  if (!role) throw new Error("Validation: mỗi dòng phân bổ cần vai trò");
  const hours = Number(r.hoursPerDay);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error("Validation: giờ/ngày phải trong khoảng 0..24");
  return {
    userId: userId || null, role, skillId: skillId || null, hoursPerDay: hours,
    gitAccount: (r.gitAccount ?? "").trim() || null,
    backlogAccount: (r.backlogAccount ?? "").trim() || null,
    twoFA: !!r.twoFA,
    active: r.active ?? true,
  };
}

export function normalizeAllocations(rows: AllocationInput[]): AllocationData[] {
  return rows.map(normalizeAllocation).filter((x): x is AllocationData => x !== null);
}
