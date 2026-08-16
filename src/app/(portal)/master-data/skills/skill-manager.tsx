"use client";
import { useState, useTransition } from "react";
import type { SkillFormData } from "./actions";

export type SkillRow = { id: string; name: string; category: string; active: boolean };

export function SkillManager({
  skills,
  onCreate,
  onUpdate,
  onDelete,
}: {
  skills: SkillRow[];
  onCreate: (data: SkillFormData) => Promise<void>;
  onUpdate: (id: string, data: SkillFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2 rounded-lg border border-[var(--vti-line,#E7DED2)] bg-white p-4 shadow-[var(--sh-1)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => { await onCreate({ name, category, active: true }); setName(""); setCategory(""); });
        }}
      >
        <input className="rounded border px-2 py-1 text-sm" placeholder="Tên skill" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border px-2 py-1 text-sm" placeholder="Nhóm (tùy chọn)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--vti-deep,#0A3CA8)] px-3 py-1 text-sm font-medium text-white disabled:opacity-50">Thêm skill</button>
      </form>
      <div className="portal-table-card">
        <table className="portal-table">
          <thead><tr><th>Skill</th><th>Nhóm</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold text-slate-900">{s.name}</td>
                <td className="portal-table-muted">{s.category || "-"}</td>
                <td><span className={"portal-pill " + (s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{s.active ? "Active" : "Inactive"}</span></td>
                <td className="text-right">
                  <button type="button" className="mr-3 text-[var(--vti-deep,#0A3CA8)]" onClick={() => start(() => onUpdate(s.id, { name: s.name, category: s.category, active: !s.active }))}>{s.active ? "Ẩn" : "Hiện"}</button>
                  <button type="button" className="text-red-600" onClick={() => start(() => onDelete(s.id))}>Xóa</button>
                </td>
              </tr>
            ))}
            {skills.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa có skill</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
