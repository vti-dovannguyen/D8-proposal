"use client";
import { useState, useTransition } from "react";
import type { CategoryFormData } from "./actions";

export type CategoryRow = { id: string; type: string; value: string; order: number; active: boolean };
type Group = { type: string; label: string; rows: CategoryRow[] };

export function CategoryManager({
  groups,
  onCreate,
  onUpdate,
  onDelete,
}: {
  groups: Group[];
  onCreate: (data: CategoryFormData) => Promise<void>;
  onUpdate: (id: string, data: CategoryFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.type} className="rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{g.label} <span className="text-slate-400">({g.type})</span></h2>
          <div className="flex flex-wrap gap-2">
            {g.rows.map((r) => (
              <span key={r.id} className={"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm " + (r.active ? "bg-slate-50" : "bg-slate-100 text-slate-400 line-through")}>
                {r.value}
                <button type="button" className="text-xs text-slate-500" title={r.active ? "Ẩn" : "Hiện"} onClick={() => start(() => onUpdate(r.id, { type: r.type, value: r.value, order: r.order, active: !r.active }))}>{r.active ? "ẩn" : "hiện"}</button>
                <button type="button" className="text-xs text-red-500" onClick={() => start(() => onDelete(r.id))}>xóa</button>
              </span>
            ))}
            {g.rows.length === 0 && <span className="text-sm text-slate-400">Chưa có mục nào</span>}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = (draft[g.type] ?? "").trim();
              if (!value) return;
              start(async () => {
                await onCreate({ type: g.type, value, order: g.rows.length, active: true });
                setDraft((d) => ({ ...d, [g.type]: "" }));
              });
            }}
          >
            <input className="rounded border px-2 py-1 text-sm" placeholder="Thêm giá trị mới…" value={draft[g.type] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [g.type]: e.target.value }))} />
            <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Thêm</button>
          </form>
        </section>
      ))}
    </div>
  );
}
