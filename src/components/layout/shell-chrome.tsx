"use client";
import { useState } from "react";
import type { Role } from "@/types";
import { Header } from "./header";
import type { NotificationItem } from "./notification-bell";
import { Sidebar } from "./sidebar";

type SidebarCounts = {
  meetings?: number;
  documents?: number;
  wiki?: number;
  topics?: number;
  agents?: number;
  aiAccounts?: number;
};

export function ShellChrome({
  name,
  role,
  children,
  counts,
  notifications,
}: {
  name: string;
  role: Role;
  children: React.ReactNode;
  counts?: SidebarCounts;
  notifications: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-screen flex-col bg-[#f3f6fb] text-slate-800">
      <Header name={name} role={role} notifications={notifications} onMenuClick={() => setOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar role={role} open={open} onNavigate={() => setOpen(false)} counts={counts} />
        {/* mobile backdrop when the drawer is open */}
        {open && (
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-sm md:hidden"
          />
        )}
        <main
          id="main-content"
          className="flex-1 overflow-auto bg-[#f3f6fb] p-4 sm:p-6 lg:p-8"
        >
          <div className="mx-auto max-w-[var(--container-content,1280px)]">{children}</div>
        </main>
      </div>
    </div>
  );
}
