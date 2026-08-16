"use client";

import { FileDown } from "lucide-react";

export function ExportMarkdownButton({ filename, content, className = "" }: { filename: string; content: string; className?: string }) {
  function handleClick() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Export report này ra file Markdown"
      className={
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#dbe3ef] bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 " +
        className
      }
    >
      <FileDown size={16} />
      Export Markdown
    </button>
  );
}
