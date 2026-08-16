"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Home,
  LayoutDashboard,
  MessageSquare,
  Settings,
  UsersRound,
  BookOpen,
  ListTree,
  Sparkles,
  Award,
  IdCard,
  Grid3x3,
  Trophy,
  Target,
} from "lucide-react";
import type { ComponentType } from "react";
import type { Role } from "@/types";

type SidebarCounts = {
  meetings?: number;
  documents?: number;
  wiki?: number;
  topics?: number;
  agents?: number;
  aiAccounts?: number;
};

type MenuItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  count?: keyof SidebarCounts;
  visible?: (role: Role) => boolean;
};

const managerOnly = (role: Role) => role === "ADMIN" || role === "DIVISION_LEADER" || role === "SECTION_MANAGER";
// A PM can view/edit the project(s) they're PIC PM on (see projects/page.tsx), so they need this entry too.
const managerOrPm = (role: Role) => managerOnly(role) || role === "PM";
const adminOnly = (role: Role) => role === "ADMIN";

const groups: Array<{ title?: string; items: MenuItem[] }> = [
  {
    items: [
      { label: "Trang chủ", href: "/", icon: Home },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, visible: (role) => role !== "MEMBER" },
      { label: "Point Award", href: "/point-award", icon: Trophy },
      { label: "Weekly Report", href: "/meetings", icon: CalendarDays, count: "meetings" },
    ],
  },
  {
    title: "Knowledge Center",
    items: [
      { label: "Documents", href: "/knowledge/documents", icon: FileText, count: "documents" },
      { label: "Wiki", href: "/knowledge/wiki", icon: BookOpen, count: "wiki" },
    ],
  },
  {
    title: "Collaboration",
    items: [
      { label: "Topics", href: "/topics", icon: MessageSquare, count: "topics" },
      { label: "AI Agents", href: "/agents", icon: Bot, count: "agents" },
    ],
  },
  {
    title: "Master Data",
    items: [
      { label: "Danh mục", href: "/master-data/categories", icon: ListTree, visible: managerOnly },
      { label: "Skills", href: "/master-data/skills", icon: Sparkles, visible: managerOnly },
      { label: "Chứng chỉ", href: "/master-data/certificates", icon: Award, visible: managerOnly },
      { label: "Hồ sơ thành viên", href: "/master-data/members", icon: IdCard, visible: managerOnly },
      { label: "Skill Matrix", href: "/master-data/skill-matrix", icon: Grid3x3, visible: managerOnly },
    ],
  },
  {
    title: "Cá nhân",
    items: [
      { label: "My Workspace", href: "/workspace", icon: BriefcaseBusiness },
      { label: "AI Accounts", href: "/ai-accounts", icon: Bot, count: "aiAccounts", visible: managerOnly },
      { label: "Projects", href: "/projects", icon: UsersRound, visible: managerOrPm },
      { label: "List KPI A", href: "/kpi-a", icon: Target, visible: managerOrPm },
      { label: "Administration", href: "/admin", icon: Settings, visible: adminOnly },
    ],
  },
];

export function Sidebar({
  role,
  open,
  onNavigate,
  counts = {},
}: {
  role: Role;
  open: boolean;
  onNavigate: () => void;
  counts?: SidebarCounts;
}) {
  const pathname = usePathname();
  return (
    <aside
      className={
        "w-[240px] shrink-0 border-r border-[#dbe3ef] bg-white " +
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl max-md:transition-transform " +
        (open ? "max-md:translate-x-0" : "max-md:-translate-x-full")
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex h-[64px] items-center gap-3 border-b border-[#dbe3ef] px-5">
          <div className="text-[28px] font-black leading-none tracking-tight text-[#155bd6]">
            VTI<span className="font-semibold text-[#2286ff]">GROUP</span>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group, groupIndex) => {
            const items = group.items.filter((item) => !item.visible || item.visible(role));
            if (items.length === 0) return null;
            return (
              <div key={group.title ?? groupIndex} className="space-y-1">
                {group.title && <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.title}</p>}
                {items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  const count = item.count ? counts[item.count] : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={
                        "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition " +
                        (active ? "bg-[#e8f2ff] text-[#003c9e]" : "text-slate-700 hover:bg-slate-50 hover:text-[#003c9e]")
                      }
                    >
                      <Icon size={17} className={active ? "text-[#0b72ff]" : "text-slate-600 group-hover:text-[#0b72ff]"} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {typeof count === "number" && count > 0 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="p-3">
          <Link href="/agents" onClick={onNavigate} className="block rounded-xl bg-[#1764d8] p-4 text-white shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Bot size={16} />
              AI Assistant
            </div>
            <p className="text-xs font-medium leading-5 text-blue-50">Hỏi đáp trên toàn bộ tri thức của Division - ra mắt Phase 3.</p>
          </Link>
        </div>
      </div>
    </aside>
  );
}
