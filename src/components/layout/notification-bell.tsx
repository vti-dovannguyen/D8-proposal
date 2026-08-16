"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, Pin } from "lucide-react";

export type NotificationItem = { id: string; title: string; preview: string; pinned: boolean };

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const hasItems = items.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Thông báo"
        aria-expanded={open}
        className="relative block rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <Bell size={18} />
        {hasItems && <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-[#dbe3ef] bg-white shadow-lg">
            <div className="border-b border-[#dbe3ef] px-4 py-2.5 text-sm font-semibold text-slate-800">Thông báo</div>
            <ul className="max-h-96 divide-y divide-[#eef2f8] overflow-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href="/announcements" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-slate-50">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      {n.pinned && <Pin size={12} className="text-amber-600" />}
                      <span className="truncate">{n.title}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-slate-500">{n.preview}</p>
                  </Link>
                </li>
              ))}
              {!hasItems && <li className="px-4 py-6 text-center text-sm text-slate-400">Chưa có thông báo</li>}
            </ul>
            <Link href="/announcements" onClick={() => setOpen(false)} className="block border-t border-[#dbe3ef] px-4 py-2.5 text-center text-sm font-medium text-[var(--vti-deep,#0A3CA8)] hover:bg-slate-50">
              Xem tất cả
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
