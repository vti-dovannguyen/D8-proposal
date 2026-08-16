"use client";
import { useState, type ReactNode } from "react";

export function ProjectTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-[#dbe3ef]">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={"-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition " + (active === t.id ? "border-[var(--vti-deep,#0A3CA8)] text-[var(--vti-deep,#0A3CA8)]" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tabs.map((t) => (
          <div key={t.id} role="tabpanel" hidden={active !== t.id}>{t.content}</div>
        ))}
      </div>
    </div>
  );
}
