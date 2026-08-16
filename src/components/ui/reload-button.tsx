"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ReloadButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      title="Tải lại dữ liệu mới nhất"
      className={
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#dbe3ef] bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 " +
        className
      }
    >
      <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
      Tải lại
    </button>
  );
}
