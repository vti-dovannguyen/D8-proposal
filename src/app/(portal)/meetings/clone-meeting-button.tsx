"use client";

import { Copy } from "lucide-react";
import { useTransition } from "react";
import { cloneMeeting } from "./actions";

export function CloneMeetingButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => cloneMeeting(id))}
      title="Clone weekly report này"
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Copy size={13} />
      Clone
    </button>
  );
}
