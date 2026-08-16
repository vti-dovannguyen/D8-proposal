export const ROLES = ["ADMIN", "DIVISION_LEADER", "SECTION_MANAGER", "PM", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];
// Alias for clarity in role-sync tests
export type AppRole = Role;

export const EMPLOYEE_TYPES = ["OFFICIAL", "INTERN"] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number];
export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  OFFICIAL: "Chính thức",
  INTERN: "Intern",
};

export type Capability =
  | "dashboard:view"
  | "meeting:edit"
  | "project:manage"
  | "ai-account:manage"
  | "content:edit"
  | "topic:create"
  | "admin:access"
  | "master-data:manage"
  | "point:award"
  | "announcement:manage";
