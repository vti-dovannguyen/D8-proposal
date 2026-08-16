"use client";

import { Copy, Lock } from "lucide-react";
import { useTransition } from "react";
import { cloneMeeting, closeMeeting } from "../actions";

export function MeetingButtons({ id, status, canEdit }: { id: string; status: string; canEdit: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      {canEdit && (
        <button
          disabled={pending}
          onClick={() => start(() => cloneMeeting(id))}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Copy size={15} />
          Clone
        </button>
      )}
      {canEdit && status !== "CLOSED" && (
        <button
          disabled={pending}
          onClick={() => start(() => closeMeeting(id))}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lock size={15} />
          Close meeting
        </button>
      )}
    </div>
  );
}
