import type { Role, Capability } from "@/types";

const EDITORS: Role[] = ["ADMIN", "DIVISION_LEADER", "SECTION_MANAGER", "PM"];
const MANAGERS: Role[] = ["ADMIN", "DIVISION_LEADER", "SECTION_MANAGER"];

const RULES: Record<Capability, (role: Role) => boolean> = {
  "dashboard:view": (r) => r !== "MEMBER",
  "meeting:edit": (r) => EDITORS.includes(r),
  "project:manage": (r) => MANAGERS.includes(r),
  "ai-account:manage": (r) => MANAGERS.includes(r),
  "content:edit": (r) => EDITORS.includes(r),
  "topic:create": () => true,
  "admin:access": (r) => r === "ADMIN",
  "master-data:manage": (r) => MANAGERS.includes(r),
  "point:award": (r) => MANAGERS.includes(r),
  "announcement:manage": (r) => MANAGERS.includes(r),
};

export function can(role: Role, capability: Capability): boolean {
  return RULES[capability](role);
}

export function isManager(role: Role): boolean {
  return MANAGERS.includes(role);
}
