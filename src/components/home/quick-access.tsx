import Link from "next/link";
import * as Icons from "lucide-react";
import { navForRole } from "@/lib/nav";
import type { Role } from "@/types";

export function QuickAccess({ role }: { role: Role }) {
  const items = navForRole(role).filter((i) => i.href !== "/").slice(0, 6);
  return (
    <section className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white/82 p-4 shadow-[var(--sh-1)] backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vti-sepia,#8A5A32)]">Shortcuts</p>
          <h2 className="text-base font-semibold text-slate-950">Truy cập nhanh</h2>
        </div>
        <span className="rounded-md border border-[var(--vti-line,#E7DED2)] bg-[var(--vti-warm,#F7F0E7)] px-2 py-1 text-xs font-medium text-[var(--vti-sepia,#8A5A32)]">
          {items.length}
        </span>
      </div>
      <div className="grid gap-2">
        {items.map((i) => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[i.icon];
          return (
            <Link
              key={i.href}
              href={i.href}
              className="group flex min-h-12 items-center gap-3 rounded-lg border border-transparent bg-[var(--vti-porcelain,#FFFCF7)] px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--vti-line,#E7DED2)] hover:bg-white hover:text-[var(--vti-ink,#0B1B3B)]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-[var(--vti-sepia,#8A5A32)] shadow-sm">
                {Icon ? <Icon size={17} /> : null}
              </span>
              <span className="truncate">{i.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
