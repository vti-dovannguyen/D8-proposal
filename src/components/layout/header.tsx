import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";
import type { Role } from "@/types";
import { ChevronDown, Menu, Search, ShieldCheck } from "lucide-react";
import { NotificationBell, type NotificationItem } from "./notification-bell";

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    ADMIN: "Admin",
    DIVISION_LEADER: "Division Leader",
    SECTION_MANAGER: "Section Manager",
    PM: "PM",
    MEMBER: "Member",
  };
  return labels[role];
}

export function Header({ name, role, notifications, onMenuClick }: { name: string; role: Role; notifications: NotificationItem[]; onMenuClick: () => void }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-[64px] items-center justify-between border-b border-[#dbe3ef] bg-white px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Mở menu điều hướng"
          className="rounded-lg border border-[#dbe3ef] bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50 md:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="hidden h-7 w-px bg-[#dbe3ef] md:block" />
        <Link href="/" className="hidden shrink-0 text-sm font-semibold text-slate-700 md:block">
          PM Sharing Portal · D8
        </Link>
        <Link
          href="/knowledge/search"
          className="flex h-10 min-w-0 max-w-xl flex-1 items-center gap-3 rounded-lg bg-slate-100 px-4 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <Search size={17} />
          <span className="truncate">Tìm kiếm meeting, tài liệu, wiki, topic, AI agent...</span>
        </Link>
      </div>
      <div className="ml-4 flex items-center gap-3">
        <div className="hidden h-9 items-center gap-2 rounded-lg border border-[#cbd8ea] bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm lg:flex">
          <ShieldCheck size={16} className="text-[#0b72ff]" />
          {roleLabel(role)}
          <ChevronDown size={15} className="text-slate-400" />
        </div>
        <NotificationBell items={notifications} />
        <Link href="/account" className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-50">
          <div className="grid size-9 place-items-center rounded-full bg-[#0f46c8] text-sm font-bold text-white">{initials || "U"}</div>
          <div className="hidden min-w-0 leading-tight sm:block">
            <div className="max-w-40 truncate text-sm font-semibold text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{roleLabel(role)} - D8</div>
          </div>
        </Link>
        <form action={signOutAction} className="hidden xl:block">
          <button className="rounded-lg border border-[#dbe3ef] px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Đăng xuất</button>
        </form>
      </div>
    </header>
  );
}
