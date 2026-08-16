import type { Role } from "@/types";

export type NavItem = {
  label: string;
  href: string;
  icon: string; // lucide icon name, resolved in sidebar
  visible: (role: Role) => boolean;
};

const ALL = () => true;
const NOT_MEMBER = (r: Role) => r !== "MEMBER";
const MANAGER_ONLY = (r: Role) => r === "ADMIN" || r === "DIVISION_LEADER" || r === "SECTION_MANAGER";
// A PM can view/edit the project(s) they're PIC PM on (see projects/page.tsx), so they need the nav entry too.
const MANAGER_OR_PM = (r: Role) => MANAGER_ONLY(r) || r === "PM";
const ADMIN_ONLY = (r: Role) => r === "ADMIN";

export const NAV_ITEMS: NavItem[] = [
  { label: "Trang chủ", href: "/", icon: "Home", visible: ALL },
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", visible: NOT_MEMBER },
  { label: "Point Award", href: "/point-award", icon: "Trophy", visible: ALL },
  { label: "Thông báo", href: "/announcements", icon: "Megaphone", visible: ALL },
  { label: "Weekly Report", href: "/meetings", icon: "CalendarDays", visible: ALL },
  { label: "Knowledge Center", href: "/knowledge", icon: "BookOpen", visible: ALL },
  { label: "Topics", href: "/topics", icon: "MessagesSquare", visible: ALL },
  { label: "AI Agents", href: "/agents", icon: "Bot", visible: ALL },
  { label: "My Workspace", href: "/workspace", icon: "User", visible: ALL },
  { label: "Projects", href: "/projects", icon: "FolderKanban", visible: MANAGER_OR_PM },
  { label: "List KPI A", href: "/kpi-a", icon: "Target", visible: MANAGER_OR_PM },
  { label: "Danh mục", href: "/master-data/categories", icon: "ListTree", visible: MANAGER_ONLY },
  { label: "Skills", href: "/master-data/skills", icon: "Sparkles", visible: MANAGER_ONLY },
  { label: "Chứng chỉ", href: "/master-data/certificates", icon: "Award", visible: MANAGER_ONLY },
  { label: "Hồ sơ thành viên", href: "/master-data/members", icon: "IdCard", visible: MANAGER_ONLY },
  { label: "Skill Matrix", href: "/master-data/skill-matrix", icon: "Grid3x3", visible: MANAGER_ONLY },
  { label: "Administration", href: "/admin", icon: "Settings", visible: ADMIN_ONLY },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.visible(role));
}
